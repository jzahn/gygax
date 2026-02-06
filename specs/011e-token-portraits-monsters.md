# Spec 011e: Token Portraits, Portrait Hotspots & Monsters

## Context

Map tokens currently show a 2-letter abbreviation or a plain `object-cover` image with no control over which part of the portrait is visible. When a portrait is cropped into a circular token or small player bar icon, the subject's face often gets cut off. Backdrops already have a focal point picker (`FocalPointPicker` component) that lets the DM click/drag to mark the important area — this spec brings that same capability to PC, NPC, and Monster portraits.

Additionally, there's no way to pre-build monsters in an adventure. The +Monster token button only accepts a free-form name with no portrait or stats. This spec adds a Monsters section to adventures (mirroring NPCs) so DMs can create monsters with full stat sheets, equipment, and portraits — then place them as tokens with their portrait visible.

---

## Feature 1: Portrait Hotspots

### What Changes

Add `avatarHotspotX` / `avatarHotspotY` (Float, default 50) to **Character**, **NPC**, and the new **Monster** models. These work identically to backdrop `focusX`/`focusY` — a percentage (0-100) marking the point of interest on the portrait.

### Schema Changes (`prisma/schema.prisma`)

Add to **Character** model (after `avatarUrl`):
```prisma
avatarHotspotX  Float?   @default(50)
avatarHotspotY  Float?   @default(50)
```

Add to **NPC** model (after `avatarUrl`):
```prisma
avatarHotspotX  Float?   @default(50)
avatarHotspotY  Float?   @default(50)
```

### ImageUpload Compact Mode Update (`client/src/components/ImageUpload.tsx`)

Currently, compact mode (used for portraits) has no focal point picker. Add a "Set hotspot" button to the hover overlay (alongside "Change" and "Remove"). Clicking it opens a small dialog containing the existing `FocalPointPicker`. Only appears when `onFocusChange` prop is provided — backward compatible.

### Where Hotspot Gets Applied

Anywhere a portrait is displayed with `object-cover` cropping:

| Location | File | Current | Change |
|----------|------|---------|--------|
| Map tokens | `TokenLayer.tsx` line 202 | `object-cover`, no position | Add `objectPosition: ${hotspotX}% ${hotspotY}%` |
| Player bar | `SessionPlayerCard.tsx` line 49 | `object-cover`, no position | Add `objectPosition` from character data |
| NPC cards | `NPCCard.tsx` | `object-cover`, no position | Add `objectPosition` from NPC data |
| Monster cards | `MonsterCard.tsx` (new) | n/a | Include from the start |

### CharacterSheet Integration (`client/src/components/CharacterSheet.tsx`)

The `ImageUpload` already receives `compact` mode. Pass `focusX`, `focusY`, and `onFocusChange` so the hotspot picker becomes available when a portrait is uploaded. On change, PATCH the character/NPC with new hotspot values.

### Server Route Updates

- **`server/src/routes/characters.ts`**: Add `avatarHotspotX`/`avatarHotspotY` to format functions, update validation (Float, 0-100)
- **`server/src/routes/npcs.ts`**: Same additions
- **`server/src/routes/sessions.ts`**: Include character hotspot fields in participant detail select (so player bar has the data)

### Shared Types (`shared/src/types.ts`)

Add `avatarHotspotX: number | null` and `avatarHotspotY: number | null` to:
- `Character` interface
- `NPC` interface
- `NPCListItem` interface
- `SessionParticipantWithDetails.character`

---

## Feature 2: Token Portrait Display

### What Changes

Tokens snapshot the portrait image AND hotspot at placement time. The `SessionToken` model gains hotspot fields so every token knows how to crop its image correctly.

### Schema Changes (`prisma/schema.prisma`)

Add to **SessionToken** model:
```prisma
monsterId       String?
imageHotspotX   Float?
imageHotspotY   Float?
```

### Token Placement Flow

When the DM places a token, the client already assembles `placingTokenData` with `imageUrl` from the linked entity. Extend this to also capture hotspot:

- **PC token** (`SessionGameView.tsx` `handlePlacePCToken`): Pull `avatarHotspotX`/`Y` from `participant.character`
- **NPC token** (`handlePlaceNPCToken`): Pull from the selected NPC (if linked; ad-hoc gets no image/hotspot)
- **Monster token** (`handlePlaceMonsterToken`): Pull from the selected Monster (if linked)

The hotspot values flow: `placingTokenData` → `useTokens.placeToken()` → WebSocket `token:place` → `tokenHandler` → `tokenService.placeToken()` → DB

### Server Changes

- **`server/src/services/tokenService.ts`**: Add `monsterId`, `imageHotspotX`, `imageHotspotY` to `placeToken` options and `formatToken`
- **`server/src/websocket/tokenHandler.ts`**: Pass new fields from payload through to service

### Shared Types

Update `SessionToken` and `WSTokenPlace` interfaces:
```typescript
monsterId?: string
imageHotspotX?: number
imageHotspotY?: number
```

### Frontend Rendering (`client/src/components/TokenLayer.tsx`)

```tsx
// Token component, img tag (line ~200):
<img
  src={token.imageUrl}
  alt={token.name}
  className="h-full w-full rounded-full object-cover"
  style={{
    objectPosition: `${token.imageHotspotX ?? 50}% ${token.imageHotspotY ?? 50}%`,
  }}
  draggable={false}
/>
```

---

## Feature 3: Monsters Section

### What Changes

New "Monsters" section in the Adventure page, following the exact same patterns as NPCs. Monsters have the same stat block, equipment, spells, notes, and portrait (with hotspot). They appear between NPCs and Backdrops in the adventure layout.

### Schema (`prisma/schema.prisma`)

New **Monster** model — identical to NPC:
```prisma
model Monster {
  id               String   @id @default(cuid())
  name             String
  description      String?
  class            String?
  level            Int      @default(1)
  alignment        String?
  title            String?

  strength         Int?
  intelligence     Int?
  wisdom           Int?
  dexterity        Int?
  constitution     Int?
  charisma         Int?

  hitPointsMax     Int?
  hitPointsCurrent Int?
  armorClass       Int?

  saveDeathRay     Int?
  saveWands        Int?
  saveParalysis    Int?
  saveBreath       Int?
  saveSpells       Int?

  experiencePoints Int?
  goldPieces       Int?
  equipment        String?
  spells           String?
  notes            String?

  avatarUrl        String?
  avatarHotspotX   Float?   @default(50)
  avatarHotspotY   Float?   @default(50)

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  adventureId      String
  adventure        Adventure @relation(fields: [adventureId], references: [id], onDelete: Cascade)

  @@index([adventureId])
  @@map("monsters")
}
```

Add `monsters Monster[]` to Adventure model relations.

### Server Routes

**New file: `server/src/routes/monsters.ts`** — Clone of `npcs.ts` with:
- `GET /api/adventures/:adventureId/monsters` — List monsters
- `POST /api/adventures/:adventureId/monsters` — Create monster
- `GET /api/monsters/:id` — Get single monster
- `PATCH /api/monsters/:id` — Update monster
- `DELETE /api/monsters/:id` — Delete monster (cascade avatar from S3)
- `POST /api/monsters/:id/avatar` — Upload avatar
- `DELETE /api/monsters/:id/avatar` — Remove avatar
- S3 key pattern: `monsters/${id}/avatar-${hex}.${ext}`
- Include `avatarHotspotX`/`avatarHotspotY` from the start

Register in `server/src/app.ts` after NPC routes.

### Shared Types (`shared/src/types.ts`)

```typescript
export interface Monster { /* same fields as NPC + avatarHotspotX/Y */ }
export interface MonsterListItem { id, name, description, class, level, avatarUrl, avatarHotspotX, avatarHotspotY, adventureId, createdAt, updatedAt }
export interface MonsterListResponse { monsters: MonsterListItem[] }
export interface MonsterResponse { monster: Monster }
export interface CreateMonsterRequest { /* same as CreateNPCRequest */ }
export interface UpdateMonsterRequest { /* same as UpdateNPCRequest */ }
export interface MonsterExportFile { version: 1, exportedAt: string, monster: {...} }
```

### Frontend — New Files

| File | Cloned From | Key Differences |
|------|------------|-----------------|
| `client/src/components/MonsterCard.tsx` | `NPCCard.tsx` | Skull icon (`☠`) for fallback, links to monster page, includes hotspot on portrait |
| `client/src/components/CreateMonsterModal.tsx` | `CreateNPCModal.tsx` | "Monster" labels, same form fields |
| `client/src/components/DeleteMonsterDialog.tsx` | `DeleteNPCDialog.tsx` | "Monster" labels |
| `client/src/pages/MonsterPage.tsx` | `NPCPage.tsx` | Route `/adventures/:id/monsters/:monsterId`, uses CharacterSheet |
| `client/src/utils/monsterExport.ts` | `npcExport.ts` | `.monster.gygax.json` extension |

### Frontend — Modified Files

**`client/src/pages/AdventurePage.tsx`**: Add Monsters section after NPCs section. Same pattern: fetch state, loading spinner, card grid (4-column on large), create/edit/delete modals.

**`client/src/App.tsx`**: Add route for `MonsterPage`.

---

## Feature 4: Unified Token Placement Dialog

### What Changes

Replace the three separate +PC / +NPC / +Monster buttons and dialogs with a single **"+Token"** button that opens one unified placement dialog. The dialog lets the DM pick from any entity type — PCs, NPCs, or Monsters — or create an ad-hoc NPC/Monster token by just typing a name.

### Current State (being replaced)

`TokenTools.tsx` currently renders three buttons (`+PC`, `+NPC`, `+Monster`), each opening its own dialog:
- PC dialog: radio-select from session participants
- NPC dialog: text input OR select from adventure NPCs
- Monster dialog: text input only (no adventure monsters exist yet)

### New Unified Dialog Design (`client/src/components/TokenTools.tsx`)

Replace all three buttons with a single **"+Token"** button. Clicking it opens a single dialog: **"Place Token"**.

The dialog contains:

1. **PC section** — "Player Characters" header. Lists session participants who don't already have a token on the map. Each entry shows: player name, character name, class/level, and avatar thumbnail (if any). Click to select, then Place.

2. **NPC section** — "NPCs" header. Lists adventure NPCs in a scrollable area. Each entry shows: name, class/level (if set), and avatar thumbnail (if any). Click to select, then Place. Below the list, a text input: "Or type a name for an ad-hoc NPC" with its own Place button. The ad-hoc input creates an NPC token with just a name (no linked entity, no portrait).

3. **Monster section** — "Monsters" header. Same layout as NPCs: scrollable list of adventure monsters with name, class/level, avatar thumbnail. Click to select, then Place. Below the list, a text input: "Or type a name for an ad-hoc Monster" with its own Place button.

Sections are visually separated (e.g., border or spacing). If a section has no entries (no participants without tokens, no adventure NPCs, no adventure monsters), show a brief "None available" note but still show the ad-hoc input for NPC/Monster sections. The PC section hides entirely if all participants already have tokens.

### Props & Callbacks

```typescript
interface TokenToolsProps {
  tokens: SessionToken[]
  participants: SessionParticipantWithDetails[]
  npcs: NPC[]
  monsters: MonsterListItem[]
  selectedTokenId: string | null
  onPlaceToken: (opts: PlaceTokenOptions) => void
  onSelectToken: (tokenId: string | null) => void
  onRemoveToken: (tokenId: string) => void
  disabled?: boolean
}

type PlaceTokenOptions =
  | { type: 'PC'; participantId: string }
  | { type: 'NPC'; name: string; npcId?: string }
  | { type: 'MONSTER'; name: string; monsterId?: string }
```

The three separate `onPlacePCToken` / `onPlaceNPCToken` / `onPlaceMonsterToken` callbacks collapse into a single `onPlaceToken` that accepts a discriminated union.

### SessionGameView Update (`client/src/pages/SessionGameView.tsx`)

- Fetch monsters from API alongside NPCs on session load
- Add `monsters` state
- Replace the three `handlePlace*Token` handlers with a single `handlePlaceToken(opts: PlaceTokenOptions)` that dispatches based on `opts.type`:
  - `PC`: look up participant's character avatar + hotspot
  - `NPC`: if `npcId` provided, look up avatar + hotspot from the NPC; otherwise ad-hoc (no image)
  - `MONSTER`: if `monsterId` provided, look up avatar + hotspot from the monster; otherwise ad-hoc (no image)
- Pass `monsters` to `DMControls` → `TokenTools`
- Extend `placingTokenData` type with `monsterId`, `imageHotspotX`, `imageHotspotY`
- Pass all fields through in `handleCellClick` → `tokens.placeToken()`

### useTokens Hook Update (`client/src/hooks/useTokens.ts`)

- Add `monsterId`, `imageHotspotX`, `imageHotspotY` to `placeToken` options
- Include in WebSocket `token:place` payload

### DMControls Update (`client/src/components/DMControls.tsx`)

- Add `monsters` prop, pass through to `TokenTools`
- Replace three `onPlace*Token` props with single `onPlaceToken` callback

---

## Feature 5: Portrait Upload in Create Dialogs

### What Changes

Currently, creating a Character or NPC requires two steps: create the entity, then navigate to its sheet to upload a portrait. Adventures and Campaigns already support image upload + focal point selection in their create/edit modals. This feature brings that same pattern to Character, NPC, and Monster creation so entities never have to exist without a portrait.

### Current State

- `CreateAdventureModal` — includes `ImageUpload` with `focusX`/`focusY` and `onFocusChange`. Image stored as local `File` state, uploaded on form submit.
- `CreateCampaignModal` — includes `BannerUpload` with `hotspotX`/`hotspotY` and `onHotspotChange`. Same deferred-upload pattern.
- `CreateCharacterModal` — no image upload at all.
- `CreateNPCModal` — no image upload at all.

### Pattern to Follow

Match the adventure modal pattern:
1. Store `portraitImage` (`File | null`) and `hotspotX`/`hotspotY` (default 50/50) in local state.
2. Render `ImageUpload` in the modal with `compact` mode, passing `focusX`, `focusY`, `onFocusChange`.
3. On form submit: POST to create the entity, then if a portrait file was selected, POST to the avatar upload endpoint, then PATCH with hotspot values.
4. On edit (modals that double as edit): pre-populate `portraitImage` from existing `avatarUrl`, allow changing/removing, send avatar upload/delete + hotspot PATCH as needed.

### CreateCharacterModal Update (`client/src/components/CreateCharacterModal.tsx`)

- Add `ImageUpload` (compact mode) below the character name field.
- Local state: `portraitImage: File | null`, `hotspotX: number`, `hotspotY: number`.
- `onFocusChange` resets hotspot to 50/50 when a new image is selected (matching adventure pattern).
- On submit: create character via POST, then upload avatar via `POST /api/characters/:id/avatar`, then PATCH hotspot values.
- The modal's `onCreated` callback should wait for all three requests before closing.

### CreateNPCModal Update (`client/src/components/CreateNPCModal.tsx`)

- Same pattern as character. Add `ImageUpload` (compact mode) to the form.
- On submit: create NPC, upload avatar, PATCH hotspot.
- When editing an existing NPC (modal in edit mode), show current avatar and allow change/remove.

### CreateMonsterModal (new, `client/src/components/CreateMonsterModal.tsx`)

- Include `ImageUpload` (compact mode) from the start — this is a new file so no retrofit needed.
- Same submit flow: create monster, upload avatar, PATCH hotspot.

### Server Considerations

No new server routes needed — the existing avatar upload endpoints (`POST /api/characters/:id/avatar`, `POST /api/npcs/:id/avatar`, `POST /api/monsters/:id/avatar`) and PATCH endpoints already handle this. The create dialogs just chain these calls after entity creation.

---

## Migration

Single Prisma migration covering all schema changes:
- Monster model creation
- `avatarHotspotX`/`avatarHotspotY` on Character and NPC
- `monsterId`, `imageHotspotX`, `imageHotspotY` on SessionToken
- Adventure → Monster relation

Migration name: `add_monsters_and_portrait_hotspots`

---

## Files Summary

### New Files
- `server/src/routes/monsters.ts`
- `client/src/components/MonsterCard.tsx`
- `client/src/components/CreateMonsterModal.tsx`
- `client/src/components/DeleteMonsterDialog.tsx`
- `client/src/pages/MonsterPage.tsx`
- `client/src/utils/monsterExport.ts`

### Modified Files
- `prisma/schema.prisma` — Monster model, hotspot fields on Character/NPC/SessionToken
- `shared/src/types.ts` — Monster types, hotspot fields on existing interfaces
- `server/src/app.ts` — Register monster routes
- `server/src/routes/characters.ts` — Hotspot format/validation
- `server/src/routes/npcs.ts` — Hotspot format/validation
- `server/src/routes/sessions.ts` — Character hotspot in participant details
- `server/src/services/tokenService.ts` — monsterId + hotspot fields
- `server/src/websocket/tokenHandler.ts` — Pass new fields
- `client/src/components/ImageUpload.tsx` — Hotspot picker in compact mode
- `client/src/components/TokenLayer.tsx` — `objectPosition` on token images
- `client/src/components/TokenTools.tsx` — Replace three buttons/dialogs with unified +Token dialog
- `client/src/components/SessionPlayerCard.tsx` — `objectPosition` on avatar
- `client/src/components/NPCCard.tsx` — `objectPosition` on portrait
- `client/src/components/CharacterSheet.tsx` — Pass hotspot props to ImageUpload
- `client/src/components/CreateCharacterModal.tsx` — Add portrait upload + hotspot picker
- `client/src/components/CreateNPCModal.tsx` — Add portrait upload + hotspot picker
- `client/src/components/DMControls.tsx` — Pass monsters prop, unified onPlaceToken callback
- `client/src/pages/AdventurePage.tsx` — Monsters section
- `client/src/pages/SessionGameView.tsx` — Fetch monsters, hotspot in token placement
- `client/src/hooks/useTokens.ts` — New fields in placeToken
- `client/src/App.tsx` — Monster page route

---

## Verification

1. **Portrait hotspot**: Upload a portrait for a Character/NPC, click "Set hotspot" on the portrait, drag the crosshair to the face. Confirm the hotspot persists after page reload.
2. **Token rendering**: Place a PC/NPC/Monster token linked to an entity with a portrait + hotspot. Confirm the circular token shows the face centered on the hotspot point.
3. **Player bar**: Join a session as a player with a character portrait + hotspot. Confirm the player bar avatar shows the face correctly.
4. **Monster CRUD**: Create a monster in an adventure with name, stats, equipment, and portrait. Edit it. Delete it. Export/import a `.monster.gygax.json` file.
5. **Unified token dialog**: In a session, click +Token. Confirm the dialog shows three sections: PCs (session participants), NPCs (adventure NPCs + ad-hoc input), Monsters (adventure monsters + ad-hoc input). Select an adventure monster — confirm portrait appears on the map token.
6. **Ad-hoc tokens still work**: In the +Token dialog, type a name in the ad-hoc NPC input and place it. Do the same for ad-hoc Monster. Confirm both appear as abbreviation circles with no image.
7. **PC section filtering**: Place a PC token via the dialog. Re-open the dialog and confirm that participant no longer appears in the PC section.
8. **NPC card hotspot**: Confirm NPC cards in the adventure view respect the hotspot on their portrait thumbnail.
9. **Portrait in create dialogs**: Create a new Character with a portrait and hotspot set in the create dialog. Confirm the character is created with the portrait and hotspot already applied — no need to visit the character sheet. Do the same for NPC and Monster creation.
10. **Create without portrait still works**: Create a Character, NPC, and Monster with no portrait selected in the create dialog. Confirm they are created normally with no avatar.
