# Spec 005d: Indoor/Dungeon Maps

## Goal

Implement wall drawing and dungeon feature tools for square grid maps, enabling DMs to create classic B/X-style dungeon maps. White rooms with solid black walls, simple feature icons for doors, stairs, and other dungeon elements.

## Scope

### In Scope

- Wall drawing tool for square grid maps
- Wall segments stored as line data
- Dungeon feature stamps (doors, secret doors, stairs, pillars, etc.)
- B/X dungeon aesthetic (black walls on white, no floor patterns)
- Labels and paths work on square grids (reuse from 005c)

### Out of Scope

- Floor fill patterns (floors are white/empty)
- Hex grid support (hex maps use terrain stamping from 005b)
- Room auto-detection or numbering
- Undo/redo system (future enhancement)

## Dependencies

**Builds on:**
- Spec 005a: Map Foundation (Map model, square grid canvas)
- Spec 005c: Text Labels & Path Drawing (labels, drawing state patterns)

**No new dependencies required.** All rendering uses native HTML5 Canvas API.

## Detailed Requirements

### 1. Data Model Updates

**Update MapContent (shared/src/types.ts):**

```typescript
// Wall segment (line between two points)
export interface WallSegment {
  id: string
  start: MapPoint
  end: MapPoint
  type: WallType
}

export type WallType = 'solid' | 'door' | 'secret'

// Dungeon feature stamp
export interface DungeonFeature {
  id: string
  type: FeatureType
  position: MapPoint
  rotation: 0 | 90 | 180 | 270  // Degrees clockwise
}

export type FeatureType =
  | 'door'           // Standard door (can also be drawn as wall segment)
  | 'door-double'    // Double door
  | 'door-secret'    // Secret door (S mark)
  | 'door-locked'    // Locked door (key mark)
  | 'stairs-up'      // Stairs going up
  | 'stairs-down'    // Stairs going down
  | 'stairs-both'    // Stairs up and down
  | 'pillar'         // Stone pillar (square)
  | 'pillar-round'   // Round pillar
  | 'statue'         // Statue
  | 'altar'          // Altar/shrine
  | 'trap'           // Trap marker
  | 'pit'            // Pit/hole
  | 'lever'          // Lever/switch
  | 'chest'          // Treasure chest
  | 'fountain'       // Fountain/well

// Updated MapContent (bump version to 3)
export interface MapContent {
  version: number  // 1, 2, or 3
  terrain: TerrainStamp[]      // Hex maps only
  paths?: MapPath[]
  labels?: MapLabel[]
  walls?: WallSegment[]        // New - square grid maps only
  features?: DungeonFeature[]  // New - square grid maps only
}
```

**Migration Strategy:**
- Version 1-2 content remains valid (hex maps)
- Version 3 adds optional `walls` and `features` arrays
- Walls and features only apply to SQUARE grid maps
- Existing terrain, paths, labels continue to work

### 2. API Updates

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
      {
        "id": "wall_abc123",
        "start": { "x": 0, "y": 0 },
        "end": { "x": 100, "y": 0 },
        "type": "solid"
      }
    ],
    "features": [
      {
        "id": "feat_xyz789",
        "type": "door",
        "position": { "x": 50, "y": 0 },
        "rotation": 0
      }
    ]
  }
}
```

**Validation:**
- `walls`: Optional array of WallSegment objects
- `walls[].id`: Required string
- `walls[].start/end`: Required MapPoint objects
- `walls[].type`: Required, must be 'solid' | 'door' | 'secret'
- `features`: Optional array of DungeonFeature objects
- `features[].id`: Required string
- `features[].type`: Required, must be valid FeatureType
- `features[].position`: Required MapPoint
- `features[].rotation`: Required, must be 0, 90, 180, or 270
- Coordinates must be within map bounds

### 3. Square Grid Utilities

**Add to client/src/utils/gridUtils.ts:**

```typescript
/**
 * Snap a point to the nearest grid intersection or cell center
 */
export function snapToSquareGrid(
  point: MapPoint,
  cellSize: number,
  snapMode: 'intersection' | 'center' | 'edge'
): MapPoint

/**
 * Get the four corners of a grid cell
 */
export function getCellCorners(
  col: number,
  row: number,
  cellSize: number
): MapPoint[]

/**
 * Get the center point of a grid cell
 */
export function getCellCenter(
  col: number,
  row: number,
  cellSize: number
): MapPoint

/**
 * Find the nearest snap point for wall drawing
 * Walls snap to grid intersections (corners)
 */
export function findNearestWallSnapPoint(
  position: MapPoint,
  cellSize: number,
  mapWidth: number,
  mapHeight: number,
  snapThreshold: number
): { point: MapPoint; distance: number } | null
```

**Snap Behavior:**
- Walls snap to grid intersections (line corners)
- Features snap to cell centers or edges depending on type
- Snap threshold: 15 pixels at 100% zoom (scales with zoom)

### 4. Drawing Tools

**Update Drawing Tool Type:**

```typescript
export type DrawingTool =
  | 'pan'
  | 'terrain'   // Hex maps only
  | 'wall'      // Square maps only - NEW
  | 'feature'   // Square maps only - NEW
  | 'path'
  | 'label'
  | 'erase'
```

#### Wall Tool

**Behavior:**
1. Select Wall tool from toolbar (W key)
2. Click on grid intersection to start wall
3. Click on another intersection to complete segment
4. Wall renders as thick black line
5. Continue clicking to add connected segments
6. Double-click or Enter to finish
7. Escape cancels current wall

**Wall Types:**
- **Solid** (default): Thick black line
- **Door**: Gap in wall with door icon
- **Secret**: Dotted line with 'S' marker

**Drawing Modes:**
- Single segment: Click start, click end
- Continuous: Keep clicking to chain segments
- Orthogonal constraint: Hold Shift for horizontal/vertical only

#### Feature Tool

**Behavior:**
1. Select Feature tool from toolbar (F key)
2. Select feature type from palette
3. Click on map to place feature
4. Feature snaps to appropriate grid position
5. R key rotates selected feature 90° clockwise
6. Click placed feature to select, drag to move

**Feature Placement:**
- Doors: Snap to cell edges (between cells)
- Pillars/statues: Snap to cell centers or intersections
- Stairs: Snap to cell centers, span one cell
- Other features: Snap to cell centers

### 5. UI Components

#### Wall Palette (client/src/components/WallPalette.tsx)

Appears when Wall tool is selected.

**Layout:**
```
┌───────────┐
│   WALL    │
├───────────┤
│ ━━━ Solid │  ← Default, thick black
│ ┄┄┄ Door  │  ← Gap with door mark
│ ··· Secret│  ← Dotted line
├───────────┤
│ [Ortho]   │  ← Toggle orthogonal lock
└───────────┘
```

**Keyboard shortcuts (when Wall tool active):**
- 1 = Solid wall
- 2 = Door wall
- 3 = Secret wall
- Shift = Orthogonal constraint (hold)

#### Feature Palette (client/src/components/FeaturePalette.tsx)

Appears when Feature tool is selected.

**Layout:**
```
┌───────────┐
│  FEATURE  │
├───────────┤
│ Doors     │
│  [🚪][🚪🚪]│  door, double
│  [S][🔑]  │  secret, locked
├───────────┤
│ Stairs    │
│  [↑][↓]   │  up, down
│  [↕]      │  both
├───────────┤
│ Objects   │
│  [▢][●]   │  pillar, round
│  [🗿][⛩]  │  statue, altar
├───────────┤
│ Hazards   │
│  [⚠][◯]   │  trap, pit
├───────────┤
│ Misc      │
│  [⚙][📦]  │  lever, chest
│  [⛲]      │  fountain
└───────────┘
```

**Keyboard shortcuts (when Feature tool active):**
- R = Rotate selected feature 90°
- Delete = Remove selected feature

### 6. Canvas Rendering

**Update Render Order for Square Grid Maps:**

```
1. White background
2. Grid lines (thin gray squares)
3. Paths (roads, etc. - if any)
4. Walls (thick black lines)
5. Features (doors, stairs, etc.)
6. Labels
7. Hover previews
8. Selection indicators
```

**Wall Rendering Style:**

```typescript
function renderWall(
  ctx: CanvasRenderingContext2D,
  wall: WallSegment,
  zoom: number
) {
  const lineWidth = 4 * zoom  // Thick walls

  ctx.strokeStyle = '#1a1a1a'
  ctx.lineWidth = lineWidth
  ctx.lineCap = 'square'

  switch (wall.type) {
    case 'solid':
      ctx.setLineDash([])
      break
    case 'door':
      // Draw wall with gap, add door symbol
      renderDoorWall(ctx, wall, zoom)
      return
    case 'secret':
      ctx.setLineDash([4 * zoom, 4 * zoom])
      break
  }

  ctx.beginPath()
  ctx.moveTo(wall.start.x, wall.start.y)
  ctx.lineTo(wall.end.x, wall.end.y)
  ctx.stroke()
  ctx.setLineDash([])
}
```

**Feature Rendering:**

Features use pre-rendered PNG images (like terrain) or simple procedural drawing:

```
/features/{type}.png
```

For example: `door.png`, `stairs-up.png`, `pillar.png`

Features are rendered at cell size, rotated according to their rotation value.

### 7. Interaction Design

#### Wall Drawing Flow

1. Select Wall tool (W key)
2. Select wall type from palette (1/2/3 or click)
3. Click on grid intersection - first point set
4. Move cursor - preview line shows
5. Click on second intersection - wall created
6. Continue clicking to chain walls
7. Double-click or Enter to finish
8. Escape cancels

**Orthogonal Mode:**
- Hold Shift to constrain to horizontal/vertical
- Toggle ortho lock button for persistent constraint

#### Wall Editing

- Click on wall to select
- Selected wall shows endpoint handles
- Drag handles to reposition endpoints
- Delete key removes selected wall
- Walls cannot overlap (new wall replaces overlapping segment)

#### Feature Placement Flow

1. Select Feature tool (F key)
2. Select feature type from palette
3. Click to place - feature appears at snapped position
4. Press R to rotate 90° before or after placing
5. Click existing feature to select
6. Drag to reposition
7. Delete to remove

### 8. Keyboard Shortcuts

**Tool Selection:**
| Key | Action |
|-----|--------|
| P | Pan tool |
| T | Terrain tool (hex only, disabled for square) |
| W | Wall tool (square only) |
| F | Feature tool (square only) |
| R | Path tool |
| L | Label tool |
| E | Erase tool |
| Space | Temporary pan (hold) |

**When Wall Tool Active:**
| Key | Action |
|-----|--------|
| 1 | Solid wall |
| 2 | Door wall |
| 3 | Secret wall |
| Shift | Orthogonal constraint (hold) |
| Enter | Finish current wall chain |
| Escape | Cancel current wall |

**When Feature Tool Active:**
| Key | Action |
|-----|--------|
| R | Rotate feature 90° clockwise |
| Delete | Remove selected feature |
| Escape | Deselect |

### 9. Tool Visibility by Grid Type

| Tool | Hex Grid | Square Grid |
|------|----------|-------------|
| Pan | Show | Show |
| Terrain | Show | Hide |
| Wall | Hide | Show |
| Feature | Hide | Show |
| Path | Show | Show |
| Label | Show | Show |
| Erase | Show | Show |

Tools that don't apply to the current grid type are **hidden entirely** from the toolbar. Do not show disabled tools - this creates unnecessary clutter and confusion.

### 10. Drawing State Updates

**Update useMapDrawing hook:**

```typescript
interface DrawingState {
  // Existing fields
  tool: DrawingTool
  previousTool: DrawingTool
  // ... terrain, paths, labels state

  // New: Walls (square grid)
  walls: WallSegment[]
  selectedWallType: WallType
  selectedWallId: string | null
  wallInProgress: MapPoint[] | null  // Points being drawn
  orthoLock: boolean

  // New: Features (square grid)
  features: DungeonFeature[]
  selectedFeatureType: FeatureType
  selectedFeatureId: string | null
  featureRotation: 0 | 90 | 180 | 270
}
```

### 11. Project Structure Updates

**New Files:**
```
client/src/components/WallPalette.tsx       # Wall type selector
client/src/components/FeaturePalette.tsx    # Feature type selector
client/src/utils/gridUtils.ts               # Square grid snap utilities
client/src/utils/wallUtils.ts               # Wall rendering, hit testing
client/src/utils/featureUtils.ts            # Feature rendering
public/features/*.png                        # Feature icon images
```

**Modified Files:**
```
shared/src/types.ts                  # WallSegment, DungeonFeature, FeatureType
client/src/hooks/useMapDrawing.ts    # Wall/feature state
client/src/components/MapCanvas.tsx  # Render walls/features
client/src/components/MapToolbar.tsx # Wall/Feature tools, grid-based visibility
server/src/routes/maps.ts            # Validate walls/features in content
```

## Design Details

### Wall Aesthetic

Walls should look like the classic dungeon maps from B/X:

- **Thickness:** 4px at 100% zoom (solid black)
- **Color:** Pure black (#1a1a1a)
- **Caps:** Square ends (not rounded)
- **Intersections:** Clean joins at corners
- **Doors:** Gap in wall with simple door symbol
- **Secret doors:** Dotted line with 'S' marker

### Feature Icons

Features are simple B/X-style symbols:

- **Doors:** Rectangle with line (indicates swing direction when rotated)
- **Stairs:** Parallel lines with arrow indicating direction
- **Pillars:** Simple square or circle
- **Statues:** Abstract humanoid shape
- **Traps:** Triangle warning symbol or specific trap icon
- **Other:** Minimalist iconic representations

All features:
- Black on white
- Fit within one grid cell
- Instantly recognizable at small sizes
- Match the pen-and-ink aesthetic

### Grid Interaction

- Grid lines are thin and light gray (#CCCCCC)
- Walls render on top of grid, obscuring grid lines they cover
- Features render centered in cells or on edges as appropriate
- Snap indicators show during wall/feature placement

## Acceptance Criteria

### Data Model
- [ ] WallSegment type with id, start, end, type
- [ ] WallType union: 'solid' | 'door' | 'secret'
- [ ] DungeonFeature type with id, type, position, rotation
- [ ] FeatureType union with all 15+ feature types
- [ ] MapContent updated with optional walls and features arrays

### API
- [ ] PATCH /api/maps/:id accepts walls array
- [ ] PATCH /api/maps/:id accepts features array
- [ ] Wall validation: type, start/end coordinates
- [ ] Feature validation: type, position, rotation
- [ ] Invalid wall/feature type returns 400
- [ ] Out-of-bounds coordinates return 400

### Wall Tool
- [ ] Toolbar shows Wall tool button (W key) for square grids only
- [ ] Wall tool not visible for hex grids
- [ ] Wall palette shows solid/door/secret options
- [ ] Click-click creates wall segment
- [ ] Walls snap to grid intersections
- [ ] Snap indicator shows when near intersection
- [ ] Continuous wall drawing (chain segments)
- [ ] Enter/double-click finishes wall chain
- [ ] Escape cancels current wall
- [ ] Shift constrains to orthogonal

### Wall Rendering
- [ ] Solid walls render as thick black lines
- [ ] Door walls render with gap and door symbol
- [ ] Secret walls render as dotted lines
- [ ] Walls render below features, above grid
- [ ] Line width scales appropriately with zoom

### Wall Editing
- [ ] Click wall to select
- [ ] Selected wall shows endpoint handles
- [ ] Drag handles to reposition
- [ ] Delete key removes selected wall
- [ ] Erase tool removes wall on click

### Feature Tool
- [ ] Toolbar shows Feature tool button (F key) for square grids only
- [ ] Feature tool not visible for hex grids
- [ ] Feature palette shows all feature types organized by category
- [ ] Click places feature at snapped position
- [ ] Features snap appropriately (edges for doors, centers for objects)
- [ ] R key rotates feature 90°

### Feature Rendering
- [ ] All feature types render correctly
- [ ] Features render at correct size (fit in cell)
- [ ] Rotation applies correctly
- [ ] Features render above walls

### Feature Editing
- [ ] Click feature to select
- [ ] Drag selected feature to reposition
- [ ] R rotates selected feature
- [ ] Delete removes selected feature
- [ ] Erase tool removes feature on click

### Tool Visibility
- [ ] Terrain tool hidden for square grid maps
- [ ] Wall tool hidden for hex grid maps
- [ ] Feature tool hidden for hex grid maps
- [ ] Path and Label tools visible on both grid types

### Auto-Save
- [ ] Wall creation triggers debounced save
- [ ] Wall modification triggers save
- [ ] Wall deletion triggers save
- [ ] Feature creation triggers save
- [ ] Feature modification triggers save
- [ ] Feature deletion triggers save

### Performance
- [ ] Smooth rendering with 200+ wall segments
- [ ] Smooth rendering with 100+ features
- [ ] No lag when drawing walls

## Verification Steps

### 1. Wall Drawing Test

1. Create a new square grid map
2. Select Wall tool (W key)
3. Select Solid wall type
4. Click on grid intersection - snap indicator shows
5. Click on adjacent intersection - wall created
6. Verify wall is thick black line
7. Continue clicking - walls chain together
8. Press Enter to finish
9. Verify walls persist after save

### 2. Wall Types Test

1. Draw a solid wall segment
2. Select Door type (key 2)
3. Draw a door wall - verify gap with door symbol
4. Select Secret type (key 3)
5. Draw a secret wall - verify dotted line
6. Compare all three visually

### 3. Orthogonal Constraint Test

1. Select Wall tool
2. Hold Shift
3. Try to draw diagonal - verify constrains to H/V
4. Release Shift - verify diagonal works again
5. Toggle ortho lock button
6. Verify constraint persists without holding Shift

### 4. Feature Placement Test

1. Select Feature tool (F key)
2. Select Door from palette
3. Click on cell edge - door places, snaps to edge
4. Press R - door rotates 90°
5. Select Pillar
6. Click on cell center - pillar places, snaps to center
7. Verify different features snap appropriately

### 5. All Features Test

1. Place one of each feature type
2. Verify each icon is distinct and recognizable
3. Zoom to 50% - verify features still readable
4. Rotate each feature through all 4 orientations
5. Verify rotations look correct

### 6. Feature Editing Test

1. Place several features
2. Click feature to select
3. Drag to new position - verify snap behavior
4. Press R - verify rotation
5. Press Delete - verify removal
6. Use Erase tool on feature - verify removal

### 7. Wall Editing Test

1. Draw several walls
2. Click wall to select
3. Verify endpoint handles appear
4. Drag handle to new position
5. Verify wall updates
6. Press Delete - verify wall removed

### 8. Grid Type Tool Visibility Test

1. Open a hex grid map
2. Verify Terrain tool visible in toolbar
3. Verify Wall tool not visible in toolbar
4. Verify Feature tool not visible in toolbar
5. Open a square grid map
6. Verify Wall tool visible in toolbar
7. Verify Feature tool visible in toolbar
8. Verify Terrain tool not visible in toolbar
9. Verify Pan, Path, Label, Erase visible on both

### 9. Labels on Square Grid Test

1. Open square grid map
2. Select Label tool
3. Place labels - verify they work
4. Select Path tool
5. Draw paths - verify they work
6. Verify labels/paths render correctly with walls

### 10. Auto-Save Test

1. Draw some walls and place features
2. Verify "Saving..." appears after 2 seconds
3. Verify "Saved" appears after completion
4. Refresh page
5. Verify all walls and features persist

### 11. Complex Dungeon Test

1. Create a dungeon with:
   - Multiple rooms (enclosed by walls)
   - Connecting corridors
   - Doors between rooms
   - Secret door
   - Stairs up and down
   - Various features (pillars, statues, etc.)
   - Labels for room names
2. Pan and zoom around
3. Verify smooth performance
4. Verify visual matches B/X dungeon style

## Future Considerations

This spec establishes the core dungeon mapping tools. Future enhancements could include:

- **Room fill tool:** Click inside walls to fill a room shape
- **Wall straightening:** Auto-align walls to grid
- **Dungeon templates:** Pre-made room shapes to stamp
- **Multi-select:** Select and move multiple walls/features
- **Copy/paste regions:** Duplicate sections of the dungeon
- **Layer visibility:** Show/hide features for printing

## References

- [PRD: Map Editor Tools](/prd.md#map-editor-tools)
- [PRD: Map Aesthetic](/prd.md#map-aesthetic)
- [Spec 005a: Map Foundation](/specs/005a-map-foundation.md)
- [Spec 005c: Text Labels & Path Drawing](/specs/005c-map-labels-paths.md)
- [Moldvay Basic D&D page B59](https://en.wikipedia.org/wiki/Dungeons_%26_Dragons_Basic_Set) - Sample dungeon reference
- [Dyson Logos Maps](https://dysonlogos.blog/) - B&W dungeon style reference
