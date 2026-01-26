# Spec 005d: Indoor/Dungeon Maps

## Goal

Implement wall placement and dungeon feature tools for square grid maps, enabling DMs to create classic B/X-style dungeon maps. White floors with solid black wall cells, rotatable feature stamps for doors, stairs, and other dungeon elements.

## Scope

### In Scope

- Wall tool: click cells to fill them black (walls)
- Dungeon feature stamps with rotation (doors, stairs, altars, etc.)
- Features of various sizes: 1x1, 1x2, 2x2
- Z key to rotate features before placement
- Erase tool works on both walls and features
- Labels work on square grids (reuse from 005c)
- B/X dungeon aesthetic (black walls on white floors)

### Out of Scope

- Hex grid support (hex maps use terrain stamping from 005b)
- Room auto-detection or numbering
- Undo/redo system (future enhancement)
- Features larger than 2x2 (future enhancement)

## Dependencies

**Builds on:**
- Spec 005a: Map Foundation (Map model, square grid canvas)
- Spec 005c: Text Labels & Path Drawing (labels, drawing state patterns)

**No new dependencies required.** All rendering uses native HTML5 Canvas API.

## Detailed Requirements

### 1. Conceptual Model

**How it works:**

1. Map opens as all white (empty floor)
2. DM selects Wall tool and clicks cells to fill them black
3. Black cells = walls, white cells = explorable floor
4. DM switches to Feature tool to place dungeon features
5. Before placing, DM can press Z to rotate the feature 90°
6. Click to stamp the feature at the desired location
7. Erase tool removes walls (click) or features (click)

This mirrors the hex terrain stamping workflow but adapted for dungeon construction.

### 2. Data Model

**Update MapContent (shared/src/types.ts):**

```typescript
// A wall cell (filled black square)
export interface WallCell {
  col: number
  row: number
}

// Dungeon feature sizes
export type FeatureSize = '1x1' | '1x2' | '2x1' | '2x2'

// Dungeon feature stamp
export interface DungeonFeature {
  id: string
  type: FeatureType
  position: { col: number; row: number }  // Top-left cell of the feature
  rotation: 0 | 90 | 180 | 270  // Degrees clockwise
}

export type FeatureType =
  // Doors (1x1, placed on wall edge)
  | 'door'           // Standard door
  | 'door-double'    // Double door (1x2 base)
  | 'door-secret'    // Secret door (S mark)
  | 'door-locked'    // Locked door
  // Stairs (1x2 or 2x2)
  | 'stairs-up'      // Stairs going up
  | 'stairs-down'    // Stairs going down
  // Objects (1x1)
  | 'pillar'         // Stone pillar
  | 'statue'         // Statue
  | 'altar'          // Altar/shrine
  | 'fountain'       // Fountain/well
  | 'chest'          // Treasure chest
  | 'throne'         // Throne
  // Hazards (1x1 or 1x2)
  | 'trap'           // Trap marker
  | 'pit'            // Pit/hole
  // Misc
  | 'lever'          // Lever/switch
  | 'fireplace'      // Fireplace (1x2)
  | 'table'          // Table (1x2 or 2x2)
  | 'bed'            // Bed (1x2)

// Feature type to size mapping
export const FEATURE_SIZES: Record<FeatureType, FeatureSize> = {
  'door': '1x1',
  'door-double': '1x2',
  'door-secret': '1x1',
  'door-locked': '1x1',
  'stairs-up': '1x2',
  'stairs-down': '1x2',
  'pillar': '1x1',
  'statue': '1x1',
  'altar': '1x1',
  'fountain': '1x1',
  'chest': '1x1',
  'throne': '1x1',
  'trap': '1x1',
  'pit': '1x1',
  'lever': '1x1',
  'fireplace': '1x2',
  'table': '2x2',
  'bed': '1x2',
}

// Updated MapContent (bump version to 3)
export interface MapContent {
  version: number  // 1, 2, or 3
  terrain: TerrainStamp[]      // Hex maps only
  paths?: MapPath[]            // Hex maps only
  labels?: MapLabel[]          // Both grid types
  walls?: WallCell[]           // Square grid maps only - NEW
  features?: DungeonFeature[]  // Square grid maps only - NEW
}
```

**Migration Strategy:**
- Version 1-2 content remains valid (hex maps)
- Version 3 adds optional `walls` and `features` arrays
- Walls and features only apply to SQUARE grid maps

### 3. API Updates

#### PATCH /api/maps/:id

Update content validation to accept walls and features.

**Request (with dungeon content):**
```json
{
  "content": {
    "version": 3,
    "terrain": [],
    "paths": [],
    "labels": [],
    "walls": [
      { "col": 0, "row": 0 },
      { "col": 1, "row": 0 },
      { "col": 2, "row": 0 }
    ],
    "features": [
      {
        "id": "feat_xyz789",
        "type": "door",
        "position": { "col": 5, "row": 3 },
        "rotation": 0
      }
    ]
  }
}
```

**Validation:**
- `walls`: Optional array of WallCell objects
- `walls[].col/row`: Required integers, must be within map bounds
- `features`: Optional array of DungeonFeature objects
- `features[].id`: Required string
- `features[].type`: Required, must be valid FeatureType
- `features[].position`: Required {col, row}, must be within map bounds
- `features[].rotation`: Required, must be 0, 90, 180, or 270
- Feature must fit within map bounds considering its size and rotation

### 4. Drawing Tools

**Tool Types for Square Grid:**

```typescript
export type DrawingTool =
  | 'pan'
  | 'terrain'   // Hex maps only (hidden for square)
  | 'path'      // Hex maps only (hidden for square)
  | 'wall'      // Square maps only - NEW
  | 'feature'   // Square maps only - NEW
  | 'label'     // Both grid types
  | 'erase'     // Both grid types
```

#### Wall Tool

**Behavior:**
1. Select Wall tool from toolbar (W key)
2. Select mode from palette: Add (filled square) or Remove (empty square)
3. In Add mode: click cells to fill them black
4. In Remove mode: click walls to remove them
5. Click and drag to paint/remove multiple cells

**Wall Palette:**
- **Add mode** (default): Filled black square icon - click to add walls
- **Remove mode**: Empty square with border icon - click to remove walls

**Visual:**
- Wall cells are solid black (#1a1a1a)
- Covers the entire cell
- Grid lines still visible at cell edges

#### Feature Tool

**Behavior:**
1. Select Feature tool from toolbar (F key)
2. Select feature type from palette
3. Feature preview follows cursor, snapped to grid
4. Press Z to rotate 90° clockwise (or click rotate buttons)
5. Click to stamp the feature
6. Feature occupies cells based on its size and rotation

**Rotation:**
- Z key rotates 90° clockwise
- Shift+Z rotates 90° counter-clockwise (optional)
- Rotation buttons in palette for mouse users
- Preview updates immediately when rotating

**Size and Rotation:**
- 1x1 features: rotation affects icon orientation only
- 1x2 features: at 0°/180° = horizontal, at 90°/270° = vertical
- 2x2 features: rotation affects icon orientation

**Placement Rules:**
- Feature position is the top-left cell it occupies
- Features can overlap wall cells (e.g., door in a wall)
- Features cannot extend beyond map bounds
- Preview shows red tint when out of bounds; click does nothing

**Feature Editing (after placement):**
- Click on placed feature to select it
- Drag selected feature to move it
- Press Z to rotate selected feature 90°
- Press Delete to remove selected feature
- Click elsewhere or Escape to deselect

### 5. UI Components

#### Wall Palette (client/src/components/WallPalette.tsx)

When Wall tool is selected, show mode selector:

```
┌───────────┐
│   WALL    │
├───────────┤
│  [■] Add  │  ← Default, fills cells black
│  [□] Remove│  ← Removes wall cells
└───────────┘
```

**Keyboard shortcuts (when Wall tool active):**
- 1 = Add mode
- 2 = Remove mode

#### Feature Palette (client/src/components/FeaturePalette.tsx)

Appears when Feature tool is selected.

**Layout:**
```
┌─────────────────┐
│    FEATURE      │
├─────────────────┤
│ [↶] Rotate [↷]  │  ← Z / Shift+Z
├─────────────────┤
│ Doors           │
│  [🚪] [🚪🚪]    │  door, double
│  [S] [🔑]       │  secret, locked
├─────────────────┤
│ Stairs          │
│  [↑] [↓]        │  up, down
├─────────────────┤
│ Furnishings     │
│  [▢] [🗿]       │  pillar, statue
│  [⛩] [⛲]       │  altar, fountain
│  [📦] [👑]      │  chest, throne
│  [🛏] [🪑]      │  bed, table
│  [🔥]           │  fireplace
├─────────────────┤
│ Hazards         │
│  [⚠] [◯]       │  trap, pit
├─────────────────┤
│ Misc            │
│  [⚙]            │  lever
└─────────────────┘
```

**Keyboard shortcuts (when Feature tool active):**
- Z = Rotate 90° clockwise
- Shift+Z = Rotate 90° counter-clockwise

### 6. Canvas Rendering

**Render Order for Square Grid Maps:**

```
1. Black background (outside map bounds, like hex maps)
2. White fill (map area)
3. Wall cells (solid black fills)
4. Grid lines (thin black)
5. Features (stamps)
6. Labels
7. Feature preview (when placing)
8. Selection indicators
```

**Wall Rendering:**

```typescript
function renderWalls(
  ctx: CanvasRenderingContext2D,
  walls: WallCell[],
  cellSize: number
) {
  ctx.fillStyle = '#1a1a1a'

  for (const wall of walls) {
    ctx.fillRect(
      wall.col * cellSize,
      wall.row * cellSize,
      cellSize,
      cellSize
    )
  }
}
```

**Feature Rendering:**

Features use pre-rendered PNG images:

```
/features/{type}.png
```

**Image Dimensions (500px per cell):**
- 1x1 features: 500x500 px
- 1x2 features: 500x1000 px
- 2x1 features: 1000x500 px
- 2x2 features: 1000x1000 px

Images are scaled down to fit the actual cell size on canvas. Rotation is applied via canvas transform.

```typescript
function renderFeature(
  ctx: CanvasRenderingContext2D,
  feature: DungeonFeature,
  cellSize: number
) {
  const size = FEATURE_SIZES[feature.type]
  const [baseW, baseH] = parseSize(size)  // e.g., '1x2' -> [1, 2]

  // Account for rotation when calculating dimensions
  const [w, h] = feature.rotation === 90 || feature.rotation === 270
    ? [baseH, baseW]
    : [baseW, baseH]

  const x = feature.position.col * cellSize
  const y = feature.position.row * cellSize
  const width = w * cellSize
  const height = h * cellSize

  ctx.save()
  ctx.translate(x + width / 2, y + height / 2)
  ctx.rotate((feature.rotation * Math.PI) / 180)
  ctx.translate(-width / 2, -height / 2)

  // Draw the feature image
  const img = featureImages.get(feature.type)
  if (img) {
    ctx.drawImage(img, 0, 0, width, height)
  }

  ctx.restore()
}
```

**Grid Lines:**

Grid lines render on top of walls so cell boundaries remain visible:

```typescript
function drawSquareGrid(ctx: CanvasRenderingContext2D, map: Map) {
  ctx.strokeStyle = '#1a1a1a'  // Black (matching current style)
  ctx.lineWidth = 1

  // ... draw grid lines
}
```

### 7. Interaction Design

#### Wall Painting Flow

1. Select Wall tool (W key)
2. Click on cell → cell fills black
3. Click and drag → paint multiple cells
4. Release mouse → stop painting

**Paint behavior:**
- Like terrain stamping - tracks last painted cell to avoid re-painting same cell
- Only paints empty (white) cells - clicking a wall does nothing
- Use Erase tool to remove walls

#### Feature Placement Flow

1. Select Feature tool (F key)
2. Select feature type from palette
3. Move cursor over map → preview shows at grid-snapped position
4. Press Z to rotate preview 90°
5. Click to place feature
6. Feature is stamped, preview continues for next placement

**Preview:**
- Shows semi-transparent feature at cursor position (50% opacity)
- Snaps to grid cells
- Updates rotation immediately when Z pressed
- Shows red tint when placement would be out of bounds
- Click does nothing when preview is red (invalid placement)

#### Erase Tool on Square Grid

1. Select Erase tool (E key)
2. Click on wall cell → wall removed (cell becomes white)
3. Click on feature → feature removed
4. Click and drag on walls → erase multiple walls

**Priority:**
- If clicking on a feature, delete the feature
- If clicking on a wall (no feature), delete the wall
- Clicking on empty floor does nothing

### 8. Tool Visibility by Grid Type

| Tool | Hex Grid | Square Grid |
|------|----------|-------------|
| Pan | Show | Show |
| Terrain | Show | Hide |
| Path | Show | Hide |
| Wall | Hide | Show |
| Feature | Hide | Show |
| Label | Show | Show |
| Erase | Show | Show |

Tools that don't apply to the current grid type are **hidden entirely** from the toolbar.

### 9. Keyboard Shortcuts

**Tool Selection:**
| Key | Action |
|-----|--------|
| P | Pan tool |
| W | Wall tool (square grid only) |
| F | Feature tool (square grid only) |
| L | Label tool |
| E | Erase tool |
| Space | Temporary pan (hold) |

**When Wall Tool Active:**
| Key | Action |
|-----|--------|
| 1 | Add mode (paint walls) |
| 2 | Remove mode (erase walls) |

**When Feature Tool Active:**
| Key | Action |
|-----|--------|
| Z | Rotate feature 90° clockwise |
| Shift+Z | Rotate feature 90° counter-clockwise |
| Delete | Remove selected feature |
| Escape | Deselect feature |

### 10. Drawing State Updates

**Update useMapDrawing hook:**

```typescript
interface DrawingState {
  // Existing fields
  tool: DrawingTool
  previousTool: DrawingTool
  isSpaceHeld: boolean
  saveStatus: SaveStatus

  // Terrain (hex only)
  selectedTerrain: TerrainType
  terrain: Map<string, StoredTerrain>
  hoveredHex: HexCoord | null

  // Paths (hex only)
  paths: MapPath[]
  selectedPathType: PathType
  selectedPathId: string | null
  pathInProgress: MapPoint[] | null

  // Labels (both)
  labels: MapLabel[]
  selectedLabelSize: TextSize
  selectedLabelId: string | null
  labelEditingId: string | null

  // Walls (square only) - NEW
  walls: Set<string>  // "col,row" keys for O(1) lookup
  wallMode: 'add' | 'remove'

  // Features (square only) - NEW
  features: DungeonFeature[]
  selectedFeatureType: FeatureType
  featureRotation: 0 | 90 | 180 | 270
  selectedFeatureId: string | null
  draggingFeature: boolean
}
```

### 11. Project Structure

**New Files:**
```
client/src/components/WallPalette.tsx       # Wall mode selector (Add/Remove)
client/src/components/FeaturePalette.tsx    # Feature type selector with rotation
client/src/utils/featureUtils.ts            # Feature rendering, size helpers
public/features/*.png                        # Feature icon images (AI-generated placeholders)
```

**Modified Files:**
```
shared/src/types.ts                  # WallCell, DungeonFeature, FeatureType, FEATURE_SIZES
client/src/hooks/useMapDrawing.ts    # Wall/feature state, rotation
client/src/components/MapCanvas.tsx  # Render walls/features, handle placement
client/src/components/MapToolbar.tsx # Wall/Feature tools, grid-based visibility
server/src/routes/maps.ts            # Validate walls/features in content
```

## Design Details

### Wall Aesthetic

Walls are simple filled cells:

- **Color:** Solid black (#1a1a1a)
- **Size:** Full cell (no padding)
- **Grid lines:** Black (#1a1a1a), render on top of walls
- **Outside bounds:** Black (consistent with hex maps)

This creates the classic dungeon map look: black walls defining corridors and rooms on white floor, framed by black outside the map bounds.

### Feature Icons

Features are B/X-style symbolic icons:

- **Style:** Black line art on transparent background
- **Resolution:** 500px per cell (1x1 = 500x500, 1x2 = 500x1000, 2x2 = 1000x1000)
- **Rotation:** Icons should look correct at all 4 rotations
- **Clarity:** Instantly recognizable when scaled down to cell size

**Design guidelines:**
- Doors: Rectangle with swing indicator
- Stairs: Parallel lines with direction arrow
- Furniture: Simple top-down silhouettes
- Hazards: Warning symbols

### Grid Lines on Top

Grid lines render on top of walls (unlike hex maps where grid is below terrain). This keeps cell boundaries visible even in large wall sections, making it easy to count squares and place features precisely.

### Out of Bounds

Like hex maps, the area outside the map bounds renders as black. This frames the map and provides visual consistency across grid types.

## Acceptance Criteria

### Data Model
- [ ] WallCell type with col, row
- [ ] DungeonFeature type with id, type, position, rotation
- [ ] FeatureType union with all feature types
- [ ] FEATURE_SIZES mapping for all feature types
- [ ] MapContent updated with optional walls and features arrays

### API
- [ ] PATCH /api/maps/:id accepts walls array
- [ ] PATCH /api/maps/:id accepts features array
- [ ] Wall validation: col/row within bounds
- [ ] Feature validation: type, position, rotation
- [ ] Feature bounds checking considers size and rotation
- [ ] Invalid types return 400

### Wall Tool
- [ ] Toolbar shows Wall tool (W key) for square grids only
- [ ] Wall tool hidden for hex grids
- [ ] Wall palette shows Add and Remove modes
- [ ] 1 key selects Add mode, 2 key selects Remove mode
- [ ] Add mode: click cell fills it black
- [ ] Remove mode: click wall removes it
- [ ] Click and drag paints/removes multiple cells
- [ ] Walls render as solid black fills
- [ ] Grid lines visible on top of walls

### Feature Tool
- [ ] Toolbar shows Feature tool (F key) for square grids only
- [ ] Feature tool hidden for hex grids
- [ ] Feature palette shows all feature types organized by category
- [ ] Rotate buttons in palette
- [ ] Z key rotates 90° clockwise
- [ ] Preview shows at cursor, snapped to grid
- [ ] Preview updates rotation immediately
- [ ] Click places feature
- [ ] Features render at correct size based on type
- [ ] Rotation applies correctly to rendering

### Feature Sizes
- [ ] 1x1 features occupy one cell
- [ ] 1x2 features occupy two cells (horizontal at 0°/180°, vertical at 90°/270°)
- [ ] 2x2 features occupy four cells
- [ ] Features cannot extend beyond map bounds
- [ ] Preview shows red tint when out of bounds
- [ ] Click does nothing when preview is red

### Feature Editing
- [ ] Click on placed feature to select it
- [ ] Selected feature shows visual indicator
- [ ] Drag selected feature to move it
- [ ] Z key rotates selected feature 90°
- [ ] Delete key removes selected feature
- [ ] Escape or click elsewhere deselects
- [ ] Moving feature respects map bounds

### Erase Tool
- [ ] Click on wall removes it
- [ ] Click on feature removes it
- [ ] Click and drag erases multiple walls
- [ ] Features take priority over walls for click detection
- [ ] Clicking empty floor does nothing

### Tool Visibility
- [ ] Wall tool hidden for hex grids
- [ ] Feature tool hidden for hex grids
- [ ] Terrain tool hidden for square grids
- [ ] Path tool hidden for square grids
- [ ] Label tool visible on both

### Auto-Save
- [ ] Wall changes trigger debounced save
- [ ] Feature changes trigger debounced save

### Performance
- [ ] Smooth rendering with 1000+ wall cells
- [ ] Smooth painting when dragging
- [ ] Smooth rendering with 100+ features

## Verification Steps

### 1. Wall Painting Test

1. Create a new square grid map
2. Select Wall tool (W key)
3. Click on cell → cell fills black
4. Click and drag across multiple cells → all fill black
5. Click on existing wall → nothing happens
6. Verify grid lines visible on top of walls
7. Save and refresh → walls persist

### 2. Feature Placement Test

1. Select Feature tool (F key)
2. Select Door from palette
3. Move cursor → preview follows, snaps to grid
4. Press Z → preview rotates 90°
5. Press Z again → preview rotates another 90°
6. Click to place → door appears
7. Verify door renders at correct size and rotation

### 3. Feature Sizes Test

1. Place a 1x1 feature (pillar) → occupies one cell
2. Place a 1x2 feature (stairs-up) at 0° → horizontal, 2 cells wide
3. Rotate stairs to 90° → vertical, 2 cells tall
4. Place a 2x2 feature (table) → occupies 4 cells
5. Try to place feature extending beyond map → should prevent or show error

### 4. Wall Remove Mode Test

1. Paint some walls using Add mode
2. Switch to Remove mode (key 2 or click)
3. Click on wall → wall removed
4. Click and drag → multiple walls removed
5. Click on empty floor → nothing happens
6. Switch back to Add mode (key 1)

### 5. Feature Editing Test

1. Place a feature (e.g., stairs)
2. Click on the feature → shows selected state
3. Press Z → feature rotates 90°
4. Drag feature to new position → feature moves
5. Press Delete → feature removed
6. Place another feature
7. Click elsewhere → feature deselected
8. Select feature, press Escape → deselected

### 6. Erase Test

1. Paint some walls
2. Place some features
3. Select Erase tool (E key)
4. Click on feature → feature removed
5. Click on wall → wall removed
6. Click on empty floor → nothing happens

### 7. Tool Visibility Test

1. Open hex grid map
2. Verify Wall and Feature tools not visible
3. Verify Terrain and Path tools visible
4. Open square grid map
5. Verify Wall and Feature tools visible
6. Verify Terrain and Path tools not visible

### 8. Label on Square Grid Test

1. Open square grid map
2. Select Label tool
3. Place labels → works correctly
4. Labels render on top of walls and features

### 9. Complex Dungeon Test

1. Create a dungeon layout:
   - Outer walls forming rooms
   - Corridors connecting rooms
   - Doors in walls between areas
   - Stairs in one room
   - Furniture scattered around
   - Labels for room names
2. Verify everything renders correctly
3. Pan and zoom → smooth performance
4. Save and reload → all content persists

### 10. Rotation Preview Test

1. Select Feature tool
2. Select stairs-up (1x2)
3. Preview shows horizontal stairs
4. Press Z → preview shows vertical stairs
5. Press Z → horizontal again (180°)
6. Press Z → vertical (270°)
7. Press Z → back to horizontal (0°)
8. Place at each rotation → verify correct orientation

## Future Considerations

- **Larger features:** 2x3, 3x3 for big furniture, pools, etc.
- **Feature variants:** Multiple visual styles per feature type
- **Snap to walls:** Doors auto-snap to wall edges
- **Room fill:** Click inside walls to fill floor area
- **Copy/paste:** Duplicate sections of dungeon

## References

- [PRD: Map Editor Tools](/prd.md#map-editor-tools)
- [PRD: Map Aesthetic](/prd.md#map-aesthetic)
- [Spec 005a: Map Foundation](/specs/005a-map-foundation.md)
- [Spec 005c: Text Labels & Path Drawing](/specs/005c-map-labels-paths.md)
- [Moldvay Basic D&D page B59](https://en.wikipedia.org/wiki/Dungeons_%26_Dragons_Basic_Set) - Sample dungeon reference
- [Dyson Logos Maps](https://dysonlogos.blog/) - B&W dungeon style reference
