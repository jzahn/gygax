# Spec 010f: Campaign World Map

## Goal

Add a world map to each Campaign that is accessible from the Campaign page and from any Adventure within that Campaign. The world map uses the existing hex map infrastructure and has fog of war state that persists at the Campaign level, shared across all Adventures.

## Scope

### In Scope

- World map relationship on Campaign model (one-to-one, optional)
- API endpoints to create/access the Campaign world map
- "World Map" access from Campaign detail page
- "World Map" access from Adventure pages (within that Campaign)
- Reuse existing hex map editor (terrain, labels, paths from 010a-010c)
- Fog of war state stored at Campaign level (future: spec 012)

### Out of Scope

- Fog of war reveal mechanics (spec 012)
- Map linking/transitions between world map and Adventure maps (Phase 2)
- Multiple world maps per Campaign
- World map for standalone Adventures (no Campaign)

## Dependencies

**Builds on:**
- Spec 005: Campaigns (Campaign model)
- Spec 010a: Map Foundation (Map model, canvas component)
- Spec 010b: Wilderness Map Drawing (terrain stamping)
- Spec 010c: Map Labels & Paths (labels, paths)

## Detailed Requirements

### 1. Database Schema

**Update Map Model (prisma/schema.prisma):**

```prisma
model Map {
  // ... existing fields

  // Existing: Adventure maps
  adventureId  String?
  adventure    Adventure? @relation(fields: [adventureId], references: [id], onDelete: Cascade)

  // New: Campaign world map (one-to-one)
  campaignId   String?    @unique
  campaign     Campaign?  @relation("CampaignWorldMap", fields: [campaignId], references: [id], onDelete: Cascade)

  @@index([adventureId])
  @@index([campaignId])
  @@map("maps")
}
```

**Update Campaign Model:**

```prisma
model Campaign {
  // ... existing fields

  worldMap    Map?       @relation("CampaignWorldMap")
}
```

**Migration:** `010f_campaign_world_map` adds `campaignId` column to maps table with unique constraint.

**Constraints:**
- A Map has either `adventureId` OR `campaignId`, never both
- `campaignId` is unique (only one world map per Campaign)

### 2. API Endpoints

#### GET /api/campaigns/:id/world-map

Get the Campaign's world map. Returns 404 if no world map exists yet.

**Response (200):**
```json
{
  "map": {
    "id": "clx...",
    "name": "World of Karameikos",
    "description": "The Known World",
    "gridType": "HEX",
    "width": 50,
    "height": 40,
    "cellSize": 40,
    "content": { ... },
    "campaignId": "clx...",
    "createdAt": "2024-01-20T12:00:00.000Z",
    "updatedAt": "2024-01-20T12:00:00.000Z"
  }
}
```

**Errors:**
- 401: Not authenticated
- 403: Email not verified OR not the Campaign owner
- 404: Campaign not found OR no world map exists

#### POST /api/campaigns/:id/world-map

Create the world map for a Campaign. Fails if one already exists.

**Request:**
```json
{
  "name": "World of Karameikos",
  "description": "The Known World",
  "width": 50,
  "height": 40
}
```

**Response (201):**
```json
{
  "map": { ... }
}
```

**Validation:**
- `name`: Required, 1-100 characters, trimmed
- `description`: Optional, max 1000 characters
- `width`: Optional, defaults to 50, range 10-200
- `height`: Optional, defaults to 40, range 10-200
- Grid type is always HEX (world maps are wilderness)

**Errors:**
- 400: Invalid input OR world map already exists
- 401: Not authenticated
- 403: Email not verified OR not the Campaign owner
- 404: Campaign not found

#### DELETE /api/campaigns/:id/world-map

Delete the Campaign's world map.

**Response (200):**
```json
{
  "success": true
}
```

**Errors:**
- 401: Not authenticated
- 403: Email not verified OR not the Campaign owner
- 404: Campaign not found OR no world map exists

**Note:** The existing `PATCH /api/maps/:id` and `GET /api/maps/:id` endpoints work for world maps (authorization checks Campaign ownership).

### 3. Type Definitions (shared/src/types.ts)

```typescript
// Update Map type to include optional campaignId
export interface Map {
  id: string
  name: string
  description: string | null
  gridType: GridType
  width: number
  height: number
  cellSize: number
  content: MapContent | null
  adventureId: string | null  // null for world maps
  campaignId: string | null   // null for adventure maps
  createdAt: string
  updatedAt: string
}

// Update Campaign type to include worldMap reference
export interface Campaign {
  // ... existing fields
  worldMapId: string | null
}

export interface CampaignWithWorldMap extends Campaign {
  worldMap: Map | null
}
```

### 4. Client Implementation

#### Campaign Detail Page Updates

Add a "World Map" section/button to the Campaign page:

**With World Map:**
```
┌─────────────────────────────────────────────────────┐
│  [Banner Image]                                     │
│  CAMPAIGN NAME                                      │
├─────────────────────────────────────────────────────┤
│                                                     │
│  [World Map Button - Full Width]                    │
│  ┌───────────────────────────────────────────────┐  │
│  │  🗺️  WORLD MAP: World of Karameikos          │  │
│  │      50×40 hexes                         →    │  │
│  └───────────────────────────────────────────────┘  │
│                                                     │
│  ════════════════════════════════════════════════   │
│  ADVENTURES                          [+ New]        │
│  ...                                                │
└─────────────────────────────────────────────────────┘
```

**Without World Map:**
```
│  [Create World Map Button]                          │
│  ┌───────────────────────────────────────────────┐  │
│  │  + CREATE WORLD MAP                           │  │
│  │    Chart the lands of your campaign           │  │
│  └───────────────────────────────────────────────┘  │
```

**Interaction:**
- Click world map button → navigate to `/campaigns/:id/world-map`
- Click create button → open Create World Map modal

#### Adventure Page Updates

Add a "World Map" link in the Adventure page header for Adventures that belong to a Campaign:

```
┌─────────────────────────────────────────────────────┐
│  ← Back to Campaign    |    🗺️ World Map            │
├─────────────────────────────────────────────────────┤
│  ADVENTURE NAME                              [Edit] │
│  ...                                                │
```

Only shown if:
- Adventure belongs to a Campaign (has `campaignId`)
- Campaign has a world map

#### Create World Map Modal

**Title:** "CHART THE WORLD"

**Form Fields:**
```
┌────────────────────────────────────────────┐
│  CHART THE WORLD                       ✕   │
│  ══════════════════════════════════════    │
│                                            │
│  MAP NAME                                  │
│  ┌────────────────────────────────────┐    │
│  │ The Known World                    │    │
│  └────────────────────────────────────┘    │
│                                            │
│  DESCRIPTION (optional)                    │
│  ┌────────────────────────────────────┐    │
│  │ The lands surrounding the Grand    │    │
│  │ Duchy of Karameikos...             │    │
│  └────────────────────────────────────┘    │
│                                            │
│  DIMENSIONS                                │
│  Width: [50] hexes   Height: [40] hexes    │
│  (10-200 range)                            │
│                                            │
│  ℹ️ World maps use hex grids for           │
│     wilderness exploration                 │
│                                            │
│              [Cancel]  [CREATE]            │
└────────────────────────────────────────────┘
```

**Notes:**
- No grid type selector (always HEX)
- Larger default dimensions than adventure maps (50×40 vs 30×30)
- Larger max dimensions (200 vs 100)

#### World Map Editor Page

**Route:** `/campaigns/:campaignId/world-map`

Uses the existing MapEditorPage component with modifications:

**Header:**
```
← Back to Campaign    World of Karameikos    [Edit] [···]
```

**Differences from Adventure Map Editor:**
- Back link goes to Campaign page (not Adventure)
- Delete option removes world map from Campaign
- (Future) Fog of war controls apply Campaign-wide

### 5. Routing Updates

**client/src/App.tsx:**

```tsx
// Add within authenticated routes
<Route path="/campaigns/:id/world-map" element={<CampaignWorldMapPage />} />
```

**New Page:** `CampaignWorldMapPage.tsx`
- Fetches Campaign's world map
- If no world map exists, shows create prompt
- If world map exists, renders MapEditorPage-style editor
- Handles back navigation to Campaign page

### 6. Project Structure Updates

**New Files:**
```
client/src/pages/CampaignWorldMapPage.tsx    # World map editor wrapper
client/src/components/CreateWorldMapModal.tsx # Create world map form
```

**Modified Files:**
```
prisma/schema.prisma           # Add campaignId to Map, relation to Campaign
server/src/routes/campaigns.ts # Add world-map endpoints
server/src/routes/maps.ts      # Update auth to handle Campaign ownership
shared/src/types.ts            # Update Map and Campaign types
client/src/App.tsx             # Add world map route
client/src/pages/CampaignPage.tsx    # Add world map section
client/src/pages/AdventurePage.tsx   # Add world map link (if in Campaign)
```

## Design Details

### World Map Visual Treatment

The world map uses the same hex map aesthetic as Adventure wilderness maps:
- B/X pen-and-ink style terrain icons
- Black ink on white hexes
- Thin grid lines
- Labels and paths supported

### World Map Access Hierarchy

```
Campaign Page
    └── [World Map Button] → /campaigns/:id/world-map
    └── Adventures
            └── Adventure Page
                    └── [World Map Link] → /campaigns/:id/world-map
                    └── Adventure Maps → /maps/:id
```

### Authorization Model

- World map is owned by Campaign owner
- Any endpoint accessing world map checks Campaign ownership
- Adventures within the Campaign can link to world map but don't "own" it

## Acceptance Criteria

### Database
- [ ] Map model has optional `campaignId` field with unique constraint
- [ ] Campaign model has `worldMap` relation
- [ ] A Map can have `adventureId` OR `campaignId`, not both
- [ ] Deleting Campaign cascades to delete world map

### API
- [ ] GET /api/campaigns/:id/world-map returns world map if exists
- [ ] GET /api/campaigns/:id/world-map returns 404 if no world map
- [ ] POST /api/campaigns/:id/world-map creates world map
- [ ] POST /api/campaigns/:id/world-map fails if world map exists
- [ ] POST /api/campaigns/:id/world-map validates dimensions (10-200)
- [ ] POST /api/campaigns/:id/world-map always creates HEX grid
- [ ] DELETE /api/campaigns/:id/world-map removes world map
- [ ] PATCH /api/maps/:id works for world maps (Campaign ownership check)
- [ ] All endpoints enforce authentication and Campaign ownership

### Campaign Page
- [ ] Shows "Create World Map" button when no world map exists
- [ ] Shows world map card/button when world map exists
- [ ] Create button opens modal
- [ ] World map button navigates to editor

### Adventure Page
- [ ] Shows "World Map" link if Adventure belongs to Campaign with world map
- [ ] Does not show link for standalone Adventures
- [ ] Does not show link if Campaign has no world map
- [ ] Link navigates to Campaign's world map editor

### World Map Editor
- [ ] Loads world map data from Campaign
- [ ] Shows Campaign context in header
- [ ] Back link returns to Campaign page
- [ ] All existing map tools work (terrain, labels, paths)
- [ ] Edit modal updates world map metadata
- [ ] Delete removes world map from Campaign

### Create Modal
- [ ] Opens from Campaign page
- [ ] Name field required
- [ ] Dimensions default to 50×40
- [ ] Dimensions validate 10-200 range
- [ ] No grid type selector (always HEX)
- [ ] Submit creates world map and navigates to editor

## Verification Steps

### 1. API Tests

```bash
# Check no world map exists
curl http://localhost:3000/api/campaigns/{campaignId}/world-map \
  -b cookies.txt
# → 404

# Create world map
curl -X POST http://localhost:3000/api/campaigns/{campaignId}/world-map \
  -H "Content-Type: application/json" \
  -d '{"name":"The Known World","width":50,"height":40}' \
  -b cookies.txt
# → 201, map object

# Get world map
curl http://localhost:3000/api/campaigns/{campaignId}/world-map \
  -b cookies.txt
# → 200, map object

# Try to create again (should fail)
curl -X POST http://localhost:3000/api/campaigns/{campaignId}/world-map \
  -H "Content-Type: application/json" \
  -d '{"name":"Another Map"}' \
  -b cookies.txt
# → 400, already exists

# Update world map
curl -X PATCH http://localhost:3000/api/maps/{mapId} \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated World Name"}' \
  -b cookies.txt
# → 200

# Delete world map
curl -X DELETE http://localhost:3000/api/campaigns/{campaignId}/world-map \
  -b cookies.txt
# → 200
```

### 2. Client Flow Tests

1. Open Campaign with no world map
2. Verify "Create World Map" button shows
3. Click button - modal opens
4. Fill name "Test World", leave defaults
5. Submit - world map created, navigates to editor
6. Verify hex grid renders (50×40)
7. Add some terrain stamps
8. Click back - return to Campaign page
9. Verify world map card shows with name
10. Click world map card - editor opens
11. Create an Adventure in this Campaign
12. Open Adventure page
13. Verify "World Map" link appears in header
14. Click link - navigates to world map editor
15. Return to Campaign, delete world map
16. Verify Adventure page no longer shows world map link

### 3. Authorization Tests

1. Create Campaign with world map as User A
2. Login as User B
3. Try to access world map via direct URL - 403
4. Try to create world map via API - 403
5. Try to delete world map via API - 403

## Future Considerations

- **Spec 012 (Fog of War):** World map fog state persists at Campaign level, revealed areas shared across all Adventures
- **Phase 2 (Map Linking):** Click location on world map to jump to corresponding Adventure map
- **Session Display:** During live sessions, DM can show world map to players with fog of war active

## References

- [PRD: Key Concepts - Campaign](/prd.md#key-concepts)
- [PRD: Forge Mode - Campaigns](/prd.md#forge-mode---campaigns) (line 89: world map mention)
- [Spec 005: Campaigns](/specs/005-campaigns.md)
- [Spec 010a: Map Foundation](/specs/010a-map-foundation.md)
- [Spec 010b: Wilderness Map Drawing](/specs/010b-map-drawing.md)
