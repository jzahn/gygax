# Spec 010a: Map Foundation

## Goal

Establish the data model and basic canvas infrastructure for maps. This creates the foundation for the map editor (010b) by implementing the Map entity, CRUD operations, and a basic interactive canvas with grid rendering.

## Scope

### In Scope

- Map database model linked to adventures
- Map CRUD API endpoints
- Basic canvas component with pan and zoom
- Square grid rendering (indoor/dungeon)
- Hex grid rendering (outdoor/wilderness)
- Map list UI within adventure page
- Create/Edit map modal
- Empty map viewer page
- B/X black-and-white grid aesthetic

### Out of Scope

- Drawing tools (pen, brush, eraser) - spec 010b
- Fill patterns and terrain - spec 010b
- Stamps and symbols - spec 010c
- Text labels - spec 010c
- Map transitions/linking - spec 010d
- Fog of war - spec 012
- Token placement - future spec
- Map image export
- Map thumbnails/previews
- Undo/redo system

## Dependencies

**Builds on:**
- Spec 004: Adventures (maps belong to Adventures)

**No new dependencies required.** Canvas rendering uses native HTML5 Canvas API.

## Detailed Requirements

### 1. Database Schema

**Map Model (prisma/schema.prisma):**

```prisma
model Map {
  id          String   @id @default(cuid())
  name        String
  description String?
  gridType    GridType @default(SQUARE)
  width       Int      @default(30)   // Grid cells wide
  height      Int      @default(30)   // Grid cells tall
  cellSize    Int      @default(40)   // Pixels per cell (for rendering)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  adventureId  String
  adventure    Adventure @relation(fields: [adventureId], references: [id], onDelete: Cascade)

  @@index([adventureId])
  @@map("maps")
}

enum GridType {
  SQUARE  // Indoor/dungeon - square grid
  HEX     // Outdoor/wilderness - hexagonal grid
}
```

**Update Adventure Model:**

```prisma
model Adventure {
  // ... existing fields
  maps Map[]
}
```

**Migration:** `010a_maps` creates the maps table with foreign key to adventures.

### 2. API Endpoints

All map endpoints require authentication, verified email, and adventure ownership.

#### GET /api/adventures/:adventureId/maps

List all maps in a adventure.

**Response (200):**
```json
{
  "maps": [
    {
      "id": "clx...",
      "name": "Level 1: The Crypt",
      "description": "The entrance level of the dungeon",
      "gridType": "SQUARE",
      "width": 30,
      "height": 30,
      "cellSize": 40,
      "createdAt": "2024-01-20T12:00:00.000Z",
      "updatedAt": "2024-01-20T12:00:00.000Z"
    }
  ]
}
```

Maps are sorted by `updatedAt` descending.

**Errors:**
- 401: Not authenticated
- 403: Email not verified OR not the adventure owner
- 404: Adventure not found

#### POST /api/adventures/:adventureId/maps

Create a new map in a adventure.

**Request:**
```json
{
  "name": "Level 1: The Crypt",
  "description": "The entrance level of the dungeon",
  "gridType": "SQUARE",
  "width": 30,
  "height": 30
}
```

**Response (201):**
```json
{
  "map": {
    "id": "clx...",
    "name": "Level 1: The Crypt",
    "description": "The entrance level of the dungeon",
    "gridType": "SQUARE",
    "width": 30,
    "height": 30,
    "cellSize": 40,
    "createdAt": "2024-01-20T12:00:00.000Z",
    "updatedAt": "2024-01-20T12:00:00.000Z"
  }
}
```

**Validation:**
- `name`: Required, 1-100 characters, trimmed
- `description`: Optional, max 1000 characters, trimmed
- `gridType`: Optional, defaults to "SQUARE", must be "SQUARE" or "HEX"
- `width`: Optional, defaults to 30, range 5-100
- `height`: Optional, defaults to 30, range 5-100

**Errors:**
- 400: Invalid input
- 401: Not authenticated
- 403: Email not verified OR not the adventure owner
- 404: Adventure not found

#### GET /api/maps/:id

Get a single map by ID.

**Response (200):**
```json
{
  "map": {
    "id": "clx...",
    "name": "Level 1: The Crypt",
    "description": "The entrance level of the dungeon",
    "gridType": "SQUARE",
    "width": 30,
    "height": 30,
    "cellSize": 40,
    "adventureId": "clx...",
    "createdAt": "2024-01-20T12:00:00.000Z",
    "updatedAt": "2024-01-20T12:00:00.000Z"
  }
}
```

**Errors:**
- 401: Not authenticated
- 403: Email not verified OR not the adventure owner
- 404: Map not found

#### PATCH /api/maps/:id

Update a map's metadata.

**Request:**
```json
{
  "name": "Updated Name",
  "description": "Updated description",
  "width": 40,
  "height": 40
}
```

All fields are optional; only provided fields are updated. `gridType` cannot be changed after creation.

**Response (200):**
```json
{
  "map": { ... }
}
```

**Errors:**
- 400: Invalid input
- 401: Not authenticated
- 403: Email not verified OR not the adventure owner
- 404: Map not found

#### DELETE /api/maps/:id

Delete a map permanently.

**Response (200):**
```json
{
  "success": true
}
```

**Errors:**
- 401: Not authenticated
- 403: Email not verified OR not the adventure owner
- 404: Map not found

### 3. Type Definitions (shared/src/types.ts)

```typescript
// Grid types
export type GridType = 'SQUARE' | 'HEX'

// Map types
export interface Map {
  id: string
  name: string
  description: string | null
  gridType: GridType
  width: number
  height: number
  cellSize: number
  adventureId: string
  createdAt: string
  updatedAt: string
}

export interface MapListResponse {
  maps: Map[]
}

export interface MapResponse {
  map: Map
}

export interface CreateMapRequest {
  name: string
  description?: string
  gridType?: GridType
  width?: number
  height?: number
}

export interface UpdateMapRequest {
  name?: string
  description?: string
  width?: number
  height?: number
}
```

### 4. Canvas Component

#### MapCanvas (client/src/components/MapCanvas.tsx)

A React component that renders an interactive canvas with grid overlay.

**Props:**
```typescript
interface MapCanvasProps {
  map: Map
  className?: string
}
```

**Features:**

1. **Grid Rendering**
   - Square grid: Simple perpendicular lines
   - Hex grid: Flat-top hexagons (flat edge at top/bottom)
   - Black ink lines (#1a1a1a) on pure white background
   - Grid cells numbered along edges (optional, for DM reference)

2. **Pan**
   - Click and drag to pan the view
   - Touch drag on mobile
   - Cursor changes to grab/grabbing

3. **Zoom**
   - Mouse wheel to zoom in/out
   - Pinch-to-zoom on touch devices
   - Zoom range: 0.25x to 4x
   - Zoom centered on cursor/pinch point
   - Zoom level indicator in corner

4. **Viewport**
   - Canvas fills available container space
   - Maintains crisp rendering at all zoom levels
   - Centers map initially

**Visual Style (B/X Rulebook Aesthetic):**

The map should look like an illustration from the Moldvay B/X rulebook or an adventure module - crisp black ink on white paper.

- **Hex map background**: Black (#1a1a1a) outside the hex grid bounds, white (#FFFFFF) inside hexes. This frames the irregular hex grid edges and makes the map pop.
- **Square map background**: Black (#1a1a1a) outside the map bounds, white (#FFFFFF) inside the map area. Consistent framing with hex maps.
- **Grid lines**: Black ink (#1a1a1a), thin (1px at 1x zoom)
- **Line style**: Crisp, no anti-aliasing (hand-drawn pen-and-ink feel)
- **Container**: The canvas sits within a parchment-background container with thick black border (3px, like adventure cards)

This creates a visual hierarchy: the map is a "document" sitting on the parchment desk/page of the application.

**Implementation Notes:**
- Use `requestAnimationFrame` for smooth rendering
- Render only visible cells for performance
- Use `devicePixelRatio` for crisp rendering on high-DPI displays
- Store viewport state (pan offset, zoom) in component state

#### Grid Rendering Details

**Square Grid:**
```
+---+---+---+---+
|   |   |   |   |
+---+---+---+---+
|   |   |   |   |
+---+---+---+---+
|   |   |   |   |
+---+---+---+---+
```
- Cell size: `map.cellSize` pixels (default 40)
- Lines extend full width/height of map

**Hex Grid (Flat-Top):**
```
 ___     ___     ___
/   \___/   \___/   \
\___/   \___/   \___/
/   \___/   \___/   \
\___/   \___/   \___/
```
- Hex size based on `map.cellSize` (width of hex)
- Odd-q offset (odd columns shifted down)
- Standard hex geometry calculations

### 5. Client Implementation

#### Adventure Page Updates (client/src/pages/AdventurePage.tsx)

Add a "Maps" section to the adventure detail page:

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  [Hero/Header - existing]                           │
├─────────────────────────────────────────────────────┤
│  Adventure description...                    [Edit]  │
├─────────────────────────────────────────────────────┤
│  ═══════════════════════════════════════════════    │
│                                                     │
│  MAPS                               [+ New Map]     │
│                                                     │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐             │
│  │ Map 1   │  │ Map 2   │  │ Map 3   │             │
│  │ 30x30   │  │ 40x40   │  │ 20x20   │             │
│  │ Square  │  │ Hex     │  │ Square  │             │
│  └─────────┘  └─────────┘  └─────────┘             │
│                                                     │
│  [Coming Soon placeholder - existing]               │
└─────────────────────────────────────────────────────┘
```

**Empty State (no maps):**
```
│  MAPS                               [+ New Map]     │
│                                                     │
│           No maps yet                               │
│           Create your first map to begin            │
│           charting this realm.                      │
│                                                     │
│           [Create Map]                              │
```

#### Map Card Component (client/src/components/MapCard.tsx)

**Design:** Small card showing map info

**Layout:**
```
┌─────────────────────────────┐
│  ┌───────────────────────┐  │
│  │ ▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦ │  │  ← Grid preview (simplified)
│  │ ▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦ │  │
│  │ ▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦▦ │  │
│  └───────────────────────┘  │
│  Level 1: The Crypt      ⋮  │  ← Name + menu
│  30×30 • Square grid        │  ← Dimensions + type
└─────────────────────────────┘
```

**Grid Preview:**
- Simple CSS grid or SVG showing grid type
- Square: simple grid pattern
- Hex: simplified hex pattern
- Parchment background
- No actual map content (just empty grid indicator)

**Interaction:**
- Click card → navigate to map editor page
- Menu → Edit, Delete options

#### Create/Edit Map Modal (client/src/components/CreateMapModal.tsx)

**Title (Create):** "CHART NEW TERRITORY"
**Title (Edit):** "EDIT MAP"

**Form Fields:**
```
┌────────────────────────────────────────────┐
│  CHART NEW TERRITORY                   ✕   │
│  ══════════════════════════════════════    │
│                                            │
│  MAP NAME                                  │
│  ┌────────────────────────────────────┐    │
│  │ Level 1: The Crypt                 │    │
│  └────────────────────────────────────┘    │
│                                            │
│  DESCRIPTION (optional)                    │
│  ┌────────────────────────────────────┐    │
│  │ The entrance level beneath the     │    │
│  │ ruined temple...                   │    │
│  └────────────────────────────────────┘    │
│                                            │
│  GRID TYPE                                 │
│  ┌──────────────┐  ┌──────────────┐        │
│  │ ▦ SQUARE    │  │ ⬡ HEX       │        │
│  │   Indoor     │  │   Outdoor    │        │
│  └──────────────┘  └──────────────┘        │
│  (disabled in edit mode)                   │
│                                            │
│  DIMENSIONS                                │
│  Width: [30] cells   Height: [30] cells    │
│  (5-100 range)                             │
│                                            │
│              [Cancel]  [CREATE]            │
└────────────────────────────────────────────┘
```

**Grid Type Selector:**
- Two toggle buttons with icons
- SQUARE shows grid icon, labeled "Indoor/Dungeon"
- HEX shows hex icon, labeled "Outdoor/Wilderness"
- Disabled when editing existing map (can't change type)

**Dimension Inputs:**
- Number inputs with increment/decrement buttons
- Min: 5, Max: 100
- Defaults: 30x30

#### Map Editor Page (client/src/pages/MapEditorPage.tsx)

**Route:** `/maps/:id`

A full-screen map viewing/editing page.

**Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  ← Back to Adventure    Level 1: The Crypt    [Edit] [···]   │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│                                                             │
│                                                             │
│                    [MAP CANVAS]                             │
│                                                             │
│                                                             │
│                                                             │
├─────────────────────────────────────────────────────────────┤
│  Zoom: 100%                              30×30 • Square     │
└─────────────────────────────────────────────────────────────┘
```

**Header:**
- Back link to adventure page
- Map name (editable via modal)
- Edit button (opens edit modal for name/description)
- Menu with Delete option

**Canvas Area:**
- MapCanvas component fills available space
- White canvas with thick black border (3px)
- Parchment page background visible around/behind the map container
- Creates "rulebook illustration" appearance

**Footer/Status Bar:**
- Current zoom level
- Map dimensions and grid type
- (Future: cursor position, selected tool)

#### Delete Map Dialog (client/src/components/DeleteMapDialog.tsx)

**Title:** "DELETE MAP"
**Message:** "Are you certain you wish to destroy '{map name}'? This action cannot be undone. All terrain, encounters, and annotations will be lost forever."

### 6. Routing Updates

**client/src/App.tsx:**

```tsx
<Route path="/maps/:id" element={<ProtectedRoute><MapEditorPage /></ProtectedRoute>} />
```

### 7. Project Structure Updates

**New Files:**
```
server/src/routes/maps.ts                   # Map CRUD endpoints
client/src/pages/MapEditorPage.tsx          # Full-screen map page
client/src/components/MapCanvas.tsx         # Canvas with grid rendering
client/src/components/MapCard.tsx           # Map card for listing
client/src/components/CreateMapModal.tsx    # Create/edit map form
client/src/components/DeleteMapDialog.tsx   # Delete confirmation
client/src/components/GridTypeSelector.tsx  # Square/Hex toggle (optional)
```

**Modified Files:**
```
prisma/schema.prisma        # Add Map model, GridType enum, update Adventure
shared/src/types.ts         # Add map types
server/src/app.ts           # Register map routes
client/src/App.tsx          # Add map editor route
client/src/pages/AdventurePage.tsx  # Add maps section
client/src/pages/index.ts   # Export MapEditorPage
```

## Design Details

### Map Aesthetic Philosophy

The map canvas should evoke the look of illustrations from the 1981 Moldvay Basic/Expert D&D rulebooks:

**Core principle**: Black ink on white paper, framed by the parchment application background.

**Visual layers (front to back):**
1. **Map content** (future): Black pen-and-ink walls, symbols, and annotations
2. **Grid**: Thin black lines forming the underlying structure
3. **Canvas background**:
   - Hex maps: Black outside hex bounds, white inside hexes
   - Square maps: Black outside map bounds, white inside map area
4. **Border**: Thick black border (3px) framing the map
5. **Page surround**: Parchment texture visible around the map

**Reference style**:
- Sample dungeon from Moldvay Basic (B/X) page B59
- Module maps from B1, B2, X1
- Dyson Logos-style clean dungeon cartography

This creates contrast: the stark white/black map "pops" against the warm parchment background, just like the adventure cover art cards on the dashboard.

### Grid Type Visual Distinction

**Square Grid Indicator:**
```
┌───┬───┬───┐
│   │   │   │
├───┼───┼───┤
│   │   │   │
├───┼───┼───┤
│   │   │   │
└───┴───┴───┘
```

**Hex Grid Indicator:**
```
 ⬡ ⬡ ⬡
⬡ ⬡ ⬡
 ⬡ ⬡ ⬡
```

### Map Card Grid Preview

For the card preview (not the actual canvas), use a simple CSS or SVG pattern:

**Square Preview:**
- 5x5 mini grid
- Thin black lines
- White background (matching actual map style)
- Thick black border around preview

**Hex Preview:**
- Simplified hex pattern
- ~3-4 hexes visible
- Black background with white hexes (matching actual map style)
- Thick black border around preview

### Canvas Interaction States

**Default:** Arrow cursor, ready to pan
**Panning:** Grab cursor while dragging
**Zoom indicator:** Shows "50%" to "400%" in corner

### Responsive Behavior

**Mobile:**
- Map list shows 1 column
- Map editor is full-screen
- Touch gestures for pan/zoom

**Tablet:**
- Map list shows 2 columns
- Map editor may show minimal sidebar (future)

**Desktop:**
- Map list shows 3+ columns
- Map editor has room for toolbar (future)

## Acceptance Criteria

### Database
- [ ] Map model created with all fields
- [ ] GridType enum works correctly
- [ ] Adventure-Map relationship established
- [ ] Cascade delete removes maps when adventure deleted

### API
- [ ] GET /api/adventures/:id/maps returns maps for adventure
- [ ] GET /api/adventures/:id/maps returns empty array if no maps
- [ ] POST /api/adventures/:id/maps creates map with valid data
- [ ] POST /api/adventures/:id/maps validates name, dimensions
- [ ] POST /api/adventures/:id/maps defaults gridType to SQUARE
- [ ] GET /api/maps/:id returns map details
- [ ] GET /api/maps/:id returns 404 for non-existent map
- [ ] GET /api/maps/:id returns 403 for other user's map
- [ ] PATCH /api/maps/:id updates map metadata
- [ ] PATCH /api/maps/:id cannot change gridType
- [ ] DELETE /api/maps/:id deletes map
- [ ] All endpoints enforce authentication and adventure ownership

### Adventure Page
- [ ] Shows "Maps" section with header and create button
- [ ] Shows map cards in responsive grid
- [ ] Shows empty state when no maps
- [ ] Create button opens modal
- [ ] Map cards navigate to editor on click

### Create/Edit Modal
- [ ] Opens for create and edit
- [ ] Validates required name
- [ ] Grid type selector works (disabled in edit mode)
- [ ] Dimension inputs validate range 5-100
- [ ] Submit creates/updates map
- [ ] Modal closes on success

### Map Editor Page
- [ ] Loads map data from API
- [ ] Shows map name in header
- [ ] Back link returns to adventure
- [ ] Edit button opens modal
- [ ] Delete option in menu works
- [ ] Canvas fills available space

### MapCanvas Component
- [ ] Renders square grid correctly
- [ ] Renders hex grid correctly
- [ ] Pan works with mouse drag
- [ ] Pan works with touch drag
- [ ] Zoom works with mouse wheel
- [ ] Zoom works with pinch gesture
- [ ] Zoom range limited to 0.25x-4x
- [ ] Zoom indicator updates correctly
- [ ] Grid lines are crisp (not blurry)
- [ ] Performance is smooth with 100x100 grid

### Visual Design
- [ ] Grid has B/X aesthetic (thin lines, parchment bg)
- [ ] Map cards match existing card design
- [ ] Modal matches existing modals
- [ ] Typography follows system
- [ ] Animations consistent

## Verification Steps

### 1. API Tests

```bash
# List maps (empty)
curl http://localhost:3000/api/adventures/{adventureId}/maps \
  -b cookies.txt

# Create square map
curl -X POST http://localhost:3000/api/adventures/{adventureId}/maps \
  -H "Content-Type: application/json" \
  -d '{"name":"Dungeon Level 1","gridType":"SQUARE","width":30,"height":30}' \
  -b cookies.txt

# Create hex map
curl -X POST http://localhost:3000/api/adventures/{adventureId}/maps \
  -H "Content-Type: application/json" \
  -d '{"name":"Wilderness","gridType":"HEX","width":20,"height":20}' \
  -b cookies.txt

# Get single map
curl http://localhost:3000/api/maps/{mapId} \
  -b cookies.txt

# Update map
curl -X PATCH http://localhost:3000/api/maps/{mapId} \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Name","width":40}' \
  -b cookies.txt

# Delete map
curl -X DELETE http://localhost:3000/api/maps/{mapId} \
  -b cookies.txt
```

### 2. Canvas Tests

1. Create a 30x30 square map
2. Open map editor page
3. Verify grid renders with correct cell count
4. Click and drag to pan - verify smooth movement
5. Scroll to zoom in - verify zoom indicator updates
6. Scroll to zoom out - verify minimum zoom enforced
7. Verify grid lines remain crisp at all zoom levels

8. Create a 20x20 hex map
9. Verify hex grid renders correctly
10. Verify pan and zoom work the same

### 3. Client Flow Tests

1. Open a adventure with no maps
2. Verify empty state shows
3. Click "New Map" - modal opens
4. Submit with empty name - validation error
5. Fill form with square grid selected
6. Submit - map created, appears in list
7. Click map card - editor opens
8. Verify grid renders correctly
9. Pan and zoom the view
10. Click edit - update name
11. Click back - return to adventure
12. Create another map with hex grid
13. Verify hex grid renders correctly
14. Delete a map via menu - confirm dialog
15. Verify map removed from list

### 4. Authorization Tests

1. Create map in Adventure A as User A
2. Login as User B
3. Try to access map via direct URL - 403
4. Try to update map via API - 403
5. Try to delete map via API - 403

### 5. Performance Tests

1. Create 100x100 square map
2. Verify initial render is fast (<1s)
3. Pan rapidly - verify smooth 60fps
4. Zoom in/out rapidly - verify no lag
5. Create 100x100 hex map
6. Repeat performance checks

## Future Considerations

This spec establishes the canvas infrastructure for future drawing features:

- **Spec 010b (Drawing Tools):** Add wall drawing, terrain brushes
- **Spec 010c (Stamps & Text):** Add feature placement, labels
- **Spec 010d (Map Linking):** Add transition points between maps
- **Spec 012 (Fog of War):** Add player visibility system
- **Map Data Storage:** Will need to store drawn content (walls, terrain, etc.)

The MapCanvas component is designed to be extended with:
- Tool modes (select, draw, erase)
- Layer rendering (background, grid, walls, objects, fog)
- Event handling for drawing operations

## References

- [PRD: Map Aesthetic](/prd.md#map-aesthetic)
- [PRD: Flow 8 - DM Creates Map](/prd.md#flow-8-dm-creates-a-new-map)
- [Spec 004: Adventures](/specs/004-adventures.md)
- [Moldvay B/X Sample Dungeon](https://www.drivethrurpg.com/product/110274/DD-Basic-Set-Rulebook-B-X-ed-Basic) - Visual reference
