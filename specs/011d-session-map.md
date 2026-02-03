# Spec 011d: Session Map (Fog of War & Tokens)

## Goal

Add fog of war and token placement to live sessions, enabling tactical map exploration where the DM reveals areas as the party explores and places tokens to represent PCs, NPCs, and monsters on the map.

## Scope

### In Scope

- **Fog of war system** for both hex and square grid maps
- **DM reveal tools** to uncover map areas for players
- **Fog state persistence** per-map, surviving session pause/resume
- **PC tokens** placed by the DM (linked to player's character)
- **NPC/monster tokens** placed by the DM during sessions
- **Token movement** controlled by DM (theater-of-the-mind style)
- **Token visibility** respects fog of war (hidden tokens in fog)
- **Real-time sync** of fog and token state via WebSocket

### Out of Scope

- Player-controlled token movement (DM controls all tokens)
- Initiative tracker or turn order
- Combat automation (HP tracking, attack rolls)
- Line of sight / dynamic lighting
- Token status effects or conditions
- Token sizing (all tokens same size for MVP)
- Fog "re-hiding" (once revealed, stays revealed)

## Dependencies

**Builds on:**
- Spec 010a-010f: Map data model, rendering, grid types
- Spec 011a: Session model, WebSocket infrastructure
- Spec 011b: Session game view layout

**No new dependencies required.**

---

## Detailed Requirements

### 1. Data Model

#### Fog of War State

Fog state is stored per-map in the Session, not in the Map model itself. This allows the same map to have different fog states in different sessions.

**Add to Session model (or new SessionMapState model):**

```prisma
model SessionMapState {
  id        String   @id @default(cuid())
  sessionId String
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)
  mapId     String
  map       Map      @relation(fields: [mapId], references: [id], onDelete: Cascade)

  // Fog state: list of revealed cells/hexes
  revealedCells Json   @default("[]")  // Array of {col, row} or {q, r} coordinates

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@unique([sessionId, mapId])
  @@map("session_map_states")
}
```

**RevealedCells format:**
- Square grid: `[{col: number, row: number}, ...]`
- Hex grid: `[{q: number, r: number}, ...]` (axial coordinates)

#### Token Model

Tokens represent creatures on the map during a session.

```prisma
model SessionToken {
  id        String   @id @default(cuid())
  sessionId String
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  // Position
  mapId     String              // Which map the token is on
  position  Json                // {col, row} for square, {q, r} for hex

  // Token identity
  type      SessionTokenType    // PC, NPC, MONSTER
  name      String              // Display name
  imageUrl  String?             // Avatar/icon URL (optional)

  // Optional link to character/NPC
  characterId String?           // Link to player's Character (for PC tokens)
  npcId       String?           // Link to DM's NPC (for NPC tokens)

  // Visual
  color     String   @default("#666666")  // Token border/background color

  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  @@index([sessionId, mapId])
  @@map("session_tokens")
}

enum SessionTokenType {
  PC        // Player character
  NPC       // Friendly or neutral NPC
  MONSTER   // Hostile creature
}
```

#### Update Session Model

```prisma
model Session {
  // ... existing fields
  mapStates SessionMapState[]
  tokens    SessionToken[]
}
```

**Migration:** `011d_session_map_fog_tokens`

---

### 2. Fog of War

#### Fog Display

**For Players:**
- Unrevealed areas show as solid fog (parchment-colored overlay or crosshatch pattern)
- Revealed areas show the map normally
- Tokens in unrevealed areas are hidden
- Fog covers terrain, paths, labels, features, and tokens

**For DM:**
- DM sees the entire map (no fog obstruction)
- Unrevealed areas shown with subtle overlay indicating "players can't see this"
- DM can click/drag to reveal areas

#### Reveal Tools (DM Only)

**Tool modes:**

| Tool | Behavior |
|------|----------|
| **Brush** | Click or drag to reveal individual cells/hexes |
| **Rectangle** | Drag to reveal a rectangular area (square grid) |
| **Polygon** | Click points to define polygon, double-click to reveal (hex grid) |
| **Reveal All** | Button to reveal entire map |

**Brush sizes:** Small (1 cell), Medium (3x3), Large (5x5)

#### Fog State Sync

When DM reveals cells:
1. Client sends `fog:reveal` WebSocket message
2. Server validates DM role
3. Server updates SessionMapState in database
4. Server broadcasts `fog:updated` to all session participants
5. Player clients update their fog overlay

---

### 3. Tokens

#### Token Placement

**PC Tokens:**
- DM places PC tokens manually (same workflow as NPC/Monster)
- DM selects "PC" type and chooses from session participants with characters
- Token uses character's name and avatar (if set)
- If player leaves, token remains (can be removed by DM)

**NPC/Monster Tokens:**
- DM opens token placement panel
- DM selects token type (NPC or Monster)
- DM enters name (or selects from Adventure's NPCs)
- DM clicks map to place token
- Token appears for all players (if in revealed area)

#### Token Movement

- DM drags token to destination cell/hex (drag-and-drop)
- Token snaps to cell center on drop
- Movement is instant (no animation for MVP)
- All players see the movement in real-time

#### Token Removal

- DM can right-click token → "Remove" or select + Delete key
- Token is removed from database and map
- Broadcast to all players

#### Token Display

**Appearance:**
- Circular token with border
- Shows first 1-2 characters of name (or avatar if set)
- Color-coded border: green (PC), blue (NPC), red (Monster)
- Selected token has highlight ring

**Size:**
- All tokens same size (1 cell/hex) for MVP
- Token centered in cell

---

### 4. WebSocket Messages

#### Client → Server

| Type | Payload | Description |
|------|---------|-------------|
| `fog:reveal` | `{ mapId, cells: [{col,row}] or [{q,r}] }` | Reveal cells (DM only) |
| `fog:reveal-all` | `{ mapId }` | Reveal entire map (DM only) |
| `token:place` | `{ mapId, type, name, position, characterId?, npcId?, color? }` | Place new token (DM only) |
| `token:move` | `{ tokenId, position }` | Move token to new position (DM only) |
| `token:remove` | `{ tokenId }` | Remove token from map (DM only) |

#### Server → Client

| Type | Payload | Description |
|------|---------|-------------|
| `fog:state` | `{ mapId, revealedCells }` | Full fog state for a map (sent on map switch) |
| `fog:updated` | `{ mapId, newlyRevealed: [...] }` | Incremental fog reveal |
| `token:state` | `{ mapId, tokens: [...] }` | All tokens for a map (sent on map switch) |
| `token:placed` | `{ token }` | New token added |
| `token:moved` | `{ tokenId, position }` | Token position changed |
| `token:removed` | `{ tokenId }` | Token removed |

---

### 5. REST API Endpoints

#### GET /api/sessions/:sessionId/maps/:mapId/fog

Get fog state for a specific map in a session.

**Response (200):**
```json
{
  "revealedCells": [
    {"col": 5, "row": 3},
    {"col": 5, "row": 4},
    {"col": 6, "row": 3}
  ]
}
```

#### GET /api/sessions/:sessionId/maps/:mapId/tokens

Get all tokens on a specific map.

**Response (200):**
```json
{
  "tokens": [
    {
      "id": "clx...",
      "type": "PC",
      "name": "Aldric",
      "position": {"col": 5, "row": 3},
      "imageUrl": "https://...",
      "color": "#22c55e"
    }
  ]
}
```

---

### 6. UI Components

#### DM Tools Panel Addition

Add to the DM controls area:

```
┌─────────────────────────────────────┐
│  FOG OF WAR                         │
│  ┌───────┐ ┌───────┐ ┌───────────┐  │
│  │ Brush │ │ Rect  │ │ Reveal All│  │
│  └───────┘ └───────┘ └───────────┘  │
│  Size: [S] [M] [L]                  │
├─────────────────────────────────────┤
│  TOKENS                             │
│  ┌─────────────────────────────────┐│
│  │ + Add PC  + Add NPC  + Monster  ││
│  └─────────────────────────────────┘│
│  Active: Aldric (PC) ×             │
│          Goblin 1 (Monster) ×      │
└─────────────────────────────────────┘
```

#### Token Placement Dialog

**For PC tokens:**
```
┌─────────────────────────────────────┐
│         PLACE PC TOKEN              │
├─────────────────────────────────────┤
│  Select player:                     │
│  ┌─────────────────────────────────┐│
│  │ ○ Dave - Aldric (Fighter 3)     ││
│  │ ● Sarah - Mira (Thief 2)        ││
│  │ ○ Gary - Bron (Cleric 4)        ││
│  └─────────────────────────────────┘│
│                                     │
│         [Cancel]    [Place]         │
└─────────────────────────────────────┘
```

**For NPC/Monster tokens:**
```
┌─────────────────────────────────────┐
│         PLACE TOKEN                 │
├─────────────────────────────────────┤
│  Type: ○ NPC  ● Monster             │
│                                     │
│  Name: [Goblin Scout          ]     │
│                                     │
│  -- OR select from Adventure --     │
│  ┌─────────────────────────────────┐│
│  │ Grimjaw (NPC)                   ││
│  │ Merchant Talia (NPC)            ││
│  └─────────────────────────────────┘│
│                                     │
│  Color: [●] Red  [ ] Blue  [ ] Gray │
│                                     │
│         [Cancel]    [Place]         │
└─────────────────────────────────────┘
```

After clicking Place, DM clicks on map to position the token.

#### Fog Overlay (Player View)

For unrevealed cells, render a fog overlay:

**Option A: Solid fill**
- Fill unrevealed cells with parchment color (#F5F5DC)
- Slight paper texture if possible

**Option B: Crosshatch pattern**
- Classic "unexplored" crosshatch over unrevealed areas
- B/X aesthetic

**Option C: Fade to black**
- Cells fade to dark/black at edges of revealed area
- More atmospheric but less B/X authentic

*Recommend Option A or B for B/X aesthetic.*

#### Token Rendering

Tokens render as a layer between map features and labels:

```
Render order:
1. Map background (fill)
2. Walls (square grid)
3. Grid lines
4. Terrain (hex)
5. Paths
6. Features
7. FOG OVERLAY (player only, unrevealed cells)
8. TOKENS (visible ones only for players)
9. Labels
10. Selection highlights
```

Token visual:
```
    ┌─────┐
    │ AL  │   ← 2-letter abbreviation or avatar
    │     │
    └─────┘
      ↑ colored border (green/blue/red based on type)
```

---

### 7. Shared Types (shared/src/types.ts)

```typescript
// Fog of War
export interface FogState {
  mapId: string
  revealedCells: CellCoord[]
}

export interface CellCoord {
  col?: number  // Square grid
  row?: number
  q?: number    // Hex grid (axial)
  r?: number
}

// Tokens
export type SessionTokenType = 'PC' | 'NPC' | 'MONSTER'

export interface SessionToken {
  id: string
  sessionId: string
  mapId: string
  type: SessionTokenType
  name: string
  position: CellCoord
  imageUrl?: string
  characterId?: string
  npcId?: string
  color: string
}

// WebSocket payloads
export interface FogRevealPayload {
  mapId: string
  cells: CellCoord[]
}

export interface TokenPlacePayload {
  mapId: string
  type: SessionTokenType
  name: string
  position: CellCoord
  characterId?: string
  npcId?: string
  color?: string
}

export interface TokenMovePayload {
  tokenId: string
  position: CellCoord
}
```

---

## Design Details

### Fog Aesthetic

The fog should match the B/X aesthetic:

- **Parchment fill:** Unrevealed cells filled with `parchment-200` color
- **Border:** Thin black line at fog edge (where revealed meets unrevealed)
- **No gradients:** Sharp edge between revealed and unrevealed (not soft fade)

### Token Aesthetic

Tokens should feel like cardboard chits or miniature bases:

- **Shape:** Square with slightly rounded corners (2px radius)
- **Size:** 80% of cell size
- **Border:** 3px solid, color based on type
- **Background:** `parchment-100` with slight shadow
- **Text:** 2-letter abbreviation, display font, centered
- **Selected state:** Additional outer ring (dashed or glowing)

### Token Colors

| Type | Border Color | Token |
|------|--------------|-------|
| PC | `#22c55e` (green-500) | Player's character |
| NPC | `#3b82f6` (blue-500) | Friendly/neutral NPC |
| Monster | `#ef4444` (red-500) | Hostile creature |

---

## Acceptance Criteria

### Fog of War
- [ ] Players see fog overlay on unrevealed map cells
- [ ] DM sees full map with subtle indicator for unrevealed areas
- [ ] DM can reveal cells with brush tool (click/drag)
- [ ] DM can reveal rectangular area (square maps)
- [ ] DM can reveal all cells at once
- [ ] Fog state persists when switching maps and returning
- [ ] Fog state persists across session pause/resume
- [ ] Fog reveal syncs to all connected players in real-time

### Tokens
- [ ] DM can place PC tokens by selecting from session participants
- [ ] PC tokens show character name and avatar
- [ ] DM can place NPC tokens with name and color
- [ ] DM can place Monster tokens with name and color
- [ ] DM can drag tokens to move them (snap to cell center)
- [ ] DM can remove tokens
- [ ] Tokens in unrevealed areas are hidden from players
- [ ] Token state syncs to all connected players in real-time
- [ ] Tokens persist across session pause/resume

### Integration
- [ ] Fog and tokens work on both hex and square grid maps
- [ ] Map switching loads correct fog and token state
- [ ] Performance acceptable with 50+ revealed cells and 20+ tokens

---

## Verification Steps

### 1. Fog of War - Basic

1. DM starts session, selects a map
2. Player joins — sees entire map covered in fog
3. DM uses brush tool to reveal some cells
4. Player sees those cells revealed in real-time
5. DM switches to different map, then back
6. Previously revealed cells are still revealed

### 2. Fog of War - Persistence

1. DM reveals some cells on a map
2. DM pauses session
3. DM and players disconnect
4. DM resumes session later
5. Previously revealed cells are still revealed

### 3. Token Placement

1. Player joins session with a character
2. DM clicks "Add PC", selects player from list, clicks map
3. PC token appears for all with character name/avatar
4. DM clicks "Add Monster", enters "Goblin", clicks map
5. Goblin token appears for all
6. DM drags Goblin to new cell
7. Goblin snaps to cell center, all players see the move

### 4. Token Visibility

1. DM places monster token in unrevealed area
2. Player does not see the monster token
3. DM reveals that area
4. Player now sees the monster token

### 5. Multi-Map Tokens

1. DM places tokens on Map A
2. DM switches to Map B
3. Map A tokens are not visible
4. DM places tokens on Map B
5. DM switches back to Map A
6. Map A tokens are visible again, Map B tokens are not

---

## Future Considerations

- **Initiative tracker:** Turn order display with "next turn" button
- **Token HP tracking:** Show HP bar or number on tokens
- **Token status effects:** Visual indicators for conditions (poisoned, blessed, etc.)
- **Line of sight:** Dynamic visibility based on token position
- **Larger tokens:** 2x2 or 3x3 tokens for large creatures
- **Player token control:** Let players move their own tokens
- **Measurement tool:** Distance calculation between tokens

---

## Project Structure

### New Files

```
shared/src/fog.ts                      # Fog utility functions
server/src/services/fogService.ts      # Fog business logic
server/src/services/tokenService.ts    # Token business logic
server/src/routes/sessionMaps.ts       # Fog/token REST endpoints
server/src/websocket/fogHandler.ts     # Fog WebSocket handlers
server/src/websocket/tokenHandler.ts   # Token WebSocket handlers
client/src/components/FogOverlay.tsx   # Fog rendering layer
client/src/components/TokenLayer.tsx   # Token rendering layer
client/src/components/TokenDialog.tsx  # Token placement dialog
client/src/components/FogTools.tsx     # DM fog reveal tools
client/src/hooks/useFog.ts             # Fog state management
client/src/hooks/useTokens.ts          # Token state management
```

### Modified Files

```
prisma/schema.prisma                   # Add SessionMapState, SessionToken models
shared/src/types.ts                    # Add fog and token types
server/src/websocket/handlers.ts       # Route fog/token messages
client/src/components/MapCanvas.tsx    # Add fog and token rendering
client/src/components/MapDisplay.tsx   # Integrate fog and token layers
client/src/pages/SessionGameView.tsx   # Add fog tools and token panel to DM controls
```
