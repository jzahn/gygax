# Spec 010f: Campaign World Map

## Goal

Allow each Campaign to have one optional world map, accessible from the Campaign detail page and from any Adventure within the Campaign. Reuses existing map infrastructure (MapCanvas, drawing tools, import/export).

## Scope

### In Scope

- Schema change: Map can belong to a Campaign (not just an Adventure)
- One world map per Campaign (optional)
- Create/open/delete world map from Campaign detail page
- Open world map from Adventure page (read-only link back to Campaign's map)
- World map defaults to HEX grid (outdoor/wilderness) but DM can choose
- World map uses full existing editor (terrain, labels, paths, features, import/export)

### Out of Scope

- Shared fog of war (spec 012)
- Map linking / clicking a hex to jump to an Adventure map (Phase 2)
- Multiple world maps per Campaign
- Player view of world map (spec 011+)

## Dependencies

- Spec 005: Campaigns (Campaign entity)
- Spec 010a–010e: Map foundation, drawing, labels, indoor, import/export

## Detailed Requirements

### 1. Database Schema

**Update Map model** — make `adventureId` optional, add `campaignId`:

```prisma
model Map {
  id          String   @id @default(cuid())
  name        String
  description String?
  gridType    GridType @default(SQUARE)
  width       Int      @default(30)
  height      Int      @default(30)
  cellSize    Int      @default(40)
  content     Json?
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  adventureId String?
  adventure   Adventure? @relation(fields: [adventureId], references: [id], onDelete: Cascade)

  campaignId  String?   @unique   // At most one world map per campaign
  campaign    Campaign? @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  @@index([adventureId])
  @@map("maps")
}
```

**Update Campaign model** — add relation:

```prisma
model Campaign {
  // ... existing fields
  worldMap    Map?
}
```

Key points:
- `campaignId` has `@unique` — enforces one world map per Campaign
- `adventureId` becomes optional (a map belongs to either an Adventure or a Campaign, never both)
- Application logic validates that exactly one of `adventureId`/`campaignId` is set

**Migration:** `010f_campaign_world_map`

### 2. API Endpoints

#### POST /api/campaigns/:id/world-map

Create the Campaign's world map. Fails if one already exists.

**Request:**
```json
{
  "name": "The Known World",
  "description": "Campaign overworld",
  "gridType": "HEX",
  "width": 40,
  "height": 30
}
```

**Response (201):** `{ "map": { ... } }`

**Errors:**
- 409: Campaign already has a world map

#### GET /api/campaigns/:id/world-map

Get the Campaign's world map (metadata + content).

**Response (200):** `{ "map": { ... } }` or `{ "map": null }` if none exists.

#### DELETE /api/campaigns/:id/world-map

Delete the Campaign's world map.

**Response (200):** `{ "success": true }`

The world map is also a regular Map, so existing endpoints (`GET /api/maps/:id`, `PATCH /api/maps/:id`, content save) continue to work. Ownership check uses Campaign owner instead of Adventure owner.

### 3. Update Existing Map Endpoints

- `PATCH /api/maps/:id` and `GET /api/maps/:id` — ownership check must handle maps with `campaignId` (check campaign owner) in addition to `adventureId` (check adventure owner)
- Map content save endpoint — same ownership adjustment
- Map export — works as-is (operates on map ID)

### 4. Client: Campaign Detail Page

Add a "World Map" section to `CampaignPage.tsx`, above the Adventures list:

**No world map yet:**
```
┌─────────────────────────────────────────┐
│  WORLD MAP                              │
│                                         │
│  No world map yet.                      │
│  Chart the lands your adventures        │
│  will explore.                          │
│                                         │
│  [Create World Map]                     │
└─────────────────────────────────────────┘
```

**World map exists:**
```
┌─────────────────────────────────────────┐
│  WORLD MAP                    [Delete]  │
│  ┌───────────────────────────────────┐  │
│  │  The Known World                  │  │
│  │  40×30 • Hex grid                 │  │
│  │  Click to open ►                  │  │
│  └───────────────────────────────────┘  │
└─────────────────────────────────────────┘
```

Clicking the card navigates to `/maps/:id` (existing MapEditorPage). The "back" link in the editor header should return to the Campaign page (not an Adventure page).

**Create World Map modal** — reuses `CreateMapModal` with defaults adjusted:
- Default grid type: HEX
- Default dimensions: 40×30
- Title: "CHART THE WORLD"

### 5. Client: Adventure Page

Add a small banner/link in the Adventure page when the Adventure belongs to a Campaign that has a world map:

```
┌─────────────────────────────────────────┐
│  🗺 View Campaign World Map →           │
└─────────────────────────────────────────┘
```

This links to `/maps/:worldMapId`. Shown only when `campaign.worldMap` exists.

### 6. Client: MapEditorPage Updates

- Back link logic: if the map has `campaignId`, link back to `/campaigns/:campaignId`. If it has `adventureId`, link back to `/adventures/:adventureId` (existing behavior).
- No other editor changes needed — full drawing tools work.

### 7. Type Updates (shared/src/types.ts)

```typescript
// Add to Campaign type
export interface Campaign {
  // ... existing fields
  worldMap?: Map | null
}

// Update Map type
export interface Map {
  // ... existing fields
  adventureId: string | null  // was required
  campaignId: string | null
}

export interface CreateWorldMapRequest {
  name: string
  description?: string
  gridType?: GridType
  width?: number
  height?: number
}
```

## Acceptance Criteria

### Database
- [ ] Map.adventureId is optional
- [ ] Map.campaignId is optional with unique constraint
- [ ] Campaign has optional worldMap relation
- [ ] Deleting a Campaign cascades to its world map
- [ ] Migration applies cleanly

### API
- [ ] POST /api/campaigns/:id/world-map creates world map
- [ ] POST /api/campaigns/:id/world-map returns 409 if map already exists
- [ ] GET /api/campaigns/:id/world-map returns map or null
- [ ] DELETE /api/campaigns/:id/world-map deletes the map
- [ ] Existing map CRUD endpoints work for campaign world maps
- [ ] Ownership checks work for campaign-owned maps

### Client — Campaign Page
- [ ] Shows empty state when no world map
- [ ] Create button opens modal with HEX defaults
- [ ] World map card shows name, dimensions, grid type
- [ ] Clicking card opens map editor
- [ ] Delete button removes world map with confirmation

### Client — Adventure Page
- [ ] Shows "View Campaign World Map" link when applicable
- [ ] Link navigates to correct map

### Client — Map Editor
- [ ] Back link goes to Campaign page for campaign maps
- [ ] All drawing tools work on world maps
- [ ] Import/export works on world maps

## Verification Steps

1. Create a Campaign, verify no world map section (empty state)
2. Create a world map (HEX, 40×30), verify it appears
3. Open world map, draw terrain, verify auto-save works
4. Navigate back, verify returns to Campaign page
5. Try creating a second world map — verify 409 error
6. Add an Adventure to the Campaign, open it, verify "View World Map" link
7. Click link, verify it opens the world map
8. Delete the world map, verify empty state returns
9. Verify existing Adventure maps still work (no regression)

## Files to Create/Modify

**Modified:**
- `prisma/schema.prisma` — Map model (optional adventureId, add campaignId), Campaign model (add worldMap)
- `server/src/routes/campaigns.ts` — Add world-map endpoints
- `server/src/routes/maps.ts` — Update ownership checks for campaign maps
- `shared/src/types.ts` — Update Map and Campaign types
- `client/src/pages/CampaignPage.tsx` — Add world map section
- `client/src/pages/AdventurePage.tsx` — Add world map link
- `client/src/pages/MapEditorPage.tsx` — Update back link logic
- `client/src/components/CreateMapModal.tsx` — Support world map defaults

**New:**
- Migration file `010f_campaign_world_map`

## Future Considerations

- Fog of war on world map shared across Adventures (spec 012)
- Clicking hexes to link to Adventure maps (Phase 2)
- Player view of world map during sessions (spec 011)
