# Spec 005c: Text Labels & Path Drawing Tools

## Goal

Add text labels and path drawing tools (roads, rivers, borders, trails) to hex maps, enabling complete B/X-style wilderness cartography. Labels provide place names and annotations; paths define the linear features that connect and divide regions on a hex crawl map.

## Scope

### In Scope

- Text labels with free positioning and 4 size options (works on both hex and square grids)
- Path tools: road, river, stream, border, trail (hex grids only)
- Snap-to-hex behavior (vertices snap to hex centers, corners, and edge midpoints)
- Layer ordering: all paths below terrain icons, labels on top
- B/X aesthetic for all visual elements

### Out of Scope

- Manual bezier control points (curves are automatic)
- Label rotation
- Path labels (text along path)
- Undo/redo system (future enhancement)
- Paths on square grid maps (indoor maps use walls instead)

## Dependencies

**Builds on:**
- Spec 005a: Map Foundation (Map model, canvas component)
- Spec 005b: Wilderness Map Drawing (terrain stamping, toolbar, drawing state)

**No new dependencies required.** All rendering uses native HTML5 Canvas API.

## Detailed Requirements

### 1. Data Model Updates

**Update Types (shared/src/types.ts):**

```typescript
// Path types
export type PathType = 'road' | 'river' | 'stream' | 'border' | 'trail'

// Point in map pixel coordinates
export interface MapPoint {
  x: number
  y: number
}

// A path element
export interface MapPath {
  id: string
  type: PathType
  points: MapPoint[]
  closed?: boolean  // For closed border regions (optional future use)
}

// Text sizes
export type TextSize = 'small' | 'medium' | 'large' | 'xlarge'

// A text label
export interface MapLabel {
  id: string
  text: string
  position: MapPoint
  size: TextSize
}

// Updated MapContent (bump version to 2)
export interface MapContent {
  version: number  // 1 or 2
  terrain: TerrainStamp[]
  paths?: MapPath[]      // New - optional for backwards compatibility
  labels?: MapLabel[]    // New - optional for backwards compatibility
}
```

**Migration Strategy:**
- Version 1 content (no paths/labels) remains valid
- Version 2 adds optional `paths` and `labels` arrays
- When saving content with paths or labels, version becomes 2
- Reading either version works seamlessly

### 2. API Updates

#### PATCH /api/maps/:id

Update content validation to accept paths and labels.

**Request (with paths and labels):**
```json
{
  "content": {
    "version": 2,
    "terrain": [...],
    "paths": [
      {
        "id": "path_abc123",
        "type": "road",
        "points": [
          { "x": 100, "y": 150 },
          { "x": 200, "y": 180 },
          { "x": 300, "y": 160 }
        ]
      }
    ],
    "labels": [
      {
        "id": "label_xyz789",
        "text": "Dragon Lair",
        "position": { "x": 250, "y": 300 },
        "size": "medium"
      }
    ]
  }
}
```

**Validation:**
- `paths`: Optional array of MapPath objects
- `paths[].id`: Required string
- `paths[].type`: Required, must be 'road' | 'river' | 'border' | 'trail'
- `paths[].points`: Required array of MapPoint, minimum 2 points
- `paths[].points[].x/y`: Required numbers
- `labels`: Optional array of MapLabel objects
- `labels[].id`: Required string
- `labels[].text`: Required string, 1-200 characters
- `labels[].position`: Required MapPoint
- `labels[].size`: Required, must be 'small' | 'medium' | 'large' | 'xlarge'

### 3. Hex Utilities

Add snap point calculations to `client/src/utils/hexUtils.ts`:

```typescript
/**
 * Get the 6 corner vertices of a hex at the given column/row
 */
export function getHexCorners(
  col: number,
  row: number,
  hexWidth: number,
  hexHeight: number
): MapPoint[]

/**
 * Get the 6 edge midpoints of a hex at the given column/row
 */
export function getHexEdgeMidpoints(
  col: number,
  row: number,
  hexWidth: number,
  hexHeight: number
): MapPoint[]

/**
 * Get the center point of a hex at the given column/row
 */
export function getHexCenter(
  col: number,
  row: number,
  hexWidth: number,
  hexHeight: number
): MapPoint

/**
 * Find the nearest snap point (center, corner, or edge midpoint) to a given position.
 * Searches hexes near the given position.
 * Returns the snap point and its distance, or null if no snap point within threshold.
 */
export function findNearestSnapPoint(
  position: MapPoint,
  hexWidth: number,
  hexHeight: number,
  mapWidth: number,
  mapHeight: number,
  snapThreshold: number  // pixels
): { point: MapPoint; distance: number } | null
```

**Snap Behavior:**
- Snap threshold: 15 pixels at 100% zoom (scales with zoom)
- Check centers, corners, and midpoints of 7 nearest hexes (center + 6 neighbors)
- Return closest point within threshold
- During path drawing, show snap preview indicator

### 4. Drawing Tools Update

**Update Drawing Tool Type (client/src/hooks/useMapDrawing.ts):**

```typescript
export type DrawingTool = 'pan' | 'terrain' | 'path' | 'label' | 'erase'

export interface DrawingState {
  // Existing fields from 005b
  tool: DrawingTool
  previousTool: DrawingTool
  selectedTerrain: TerrainType
  terrain: Map<string, StoredTerrain>
  hoveredHex: HexCoord | null
  saveStatus: SaveStatus
  isSpaceHeld: boolean

  // New: Paths
  paths: MapPath[]
  selectedPathType: PathType
  selectedPathId: string | null      // Currently selected path for editing
  pathInProgress: MapPoint[] | null  // Vertices being drawn

  // New: Labels
  labels: MapLabel[]
  selectedLabelSize: TextSize
  selectedLabelId: string | null     // Currently selected label
  labelEditingId: string | null      // Label being text-edited
}
```

### 5. Tool Palette Components

#### Path Palette (client/src/components/PathPalette.tsx)

Appears when Path tool is selected. Shows the 4 path types.

**Layout:**
```
┌───────────┐
│  PATH     │
├───────────┤
│ ═══ Road  │  ← Dashed, thick
│ ~~~ River │  ← Solid, thickest
│ ··· Border│  ← Dotted, thin
│ --- Trail │  ← Dashed, thin
└───────────┘
```

**Styling:**
- Each option shows a small preview line in the path style
- Selected option has active background
- Keyboard shortcuts: 1=Road, 2=River, 3=Border, 4=Trail (when Path tool active)

#### Text Size Selector (client/src/components/TextSizeSelector.tsx)

Appears when Label tool is selected. Four size buttons.

**Layout:**
```
┌───────────┐
│  SIZE     │
├───────────┤
│  [S]      │  ← 12px
│  [M]      │  ← 16px (default)
│  [L]      │  ← 24px
│  [XL]     │  ← 32px
└───────────┘
```

**Behavior:**
- S = Small (12px)
- M = Medium (16px, default)
- L = Large (24px)
- XL = Extra Large (32px)
- Keyboard shortcuts: 1=S, 2=M, 3=L, 4=XL (when Label tool active)

### 6. Label Editor Component

**LabelEditor (client/src/components/LabelEditor.tsx)**

An inline text input that appears at the label position during creation/editing.

**Props:**
```typescript
interface LabelEditorProps {
  position: MapPoint
  initialText: string
  size: TextSize
  onConfirm: (text: string) => void
  onCancel: () => void
}
```

**Behavior:**
- Appears at the label position (adjusted for viewport transform)
- Auto-focuses the input
- Matches the label font size
- Enter confirms, Escape cancels
- Clicking outside confirms
- Empty text on confirm deletes the label

**Styling:**
- Transparent background with subtle border
- Uses the same B/X font as rendered labels
- Sized to content (min 100px wide)

### 7. Canvas Rendering

**Update Render Order (client/src/components/MapCanvas.tsx):**

```
Hex maps:
1. Black background (outside hex bounds)
2. White hex fills
3. Grid lines
4. All paths (roads, rivers, borders, trails)
5. Terrain icons
6. Labels
7. Hover previews
8. Selection indicators

Square maps:
1. Black background (outside map bounds)
2. White map area fill
3. Walls (spec 005d)
4. Grid lines
5. Features (spec 005d)
6. Labels
7. Hover previews
8. Selection indicators
```

**Path Rendering Styles:**

Most paths use black ink (`#1a1a1a`) to match B/X aesthetic. Rivers and streams use grey (`#808080`) to match water terrain.

| Type | Width | Style | Color | Details |
|------|-------|-------|-------|---------|
| Road | 4px | Dashed `[12, 6]` | `#1a1a1a` | Long dashes - major routes |
| River | 5px | Solid | `#808080` | Grey to match water terrain |
| Stream | 2.5px | Solid | `#808080` | Narrower than river |
| Border | 2px | Dotted `[4, 4]` | `#1a1a1a` | Fine dots - territory boundaries |
| Trail | 2px | Dashed `[6, 4]` | `#1a1a1a` | Short dashes - minor paths |

All paths:
- `lineCap: 'round'`
- `lineJoin: 'round'`
- Line width scales with zoom (thinner when zoomed out)

**Path Curve Smoothing:**

Paths use Catmull-Rom spline interpolation for smooth curves between vertices:

- Curves pass through all defined points (no control points needed)
- Automatic tangent calculation creates natural-looking curves
- 2-point paths render as straight lines
- 3+ point paths render as smooth curves
- Tension parameter: 0.5 (balanced smoothness)

```typescript
/**
 * Generate points along a Catmull-Rom spline
 * @param points - Array of control points the curve passes through
 * @param tension - Curve tension (0.5 = standard Catmull-Rom)
 * @param segments - Number of line segments between each pair of points
 */
function catmullRomSpline(
  points: MapPoint[],
  tension: number = 0.5,
  segments: number = 10
): MapPoint[]
```

This gives paths a hand-drawn, organic feel while keeping the data model simple (just vertex positions).

**Label Rendering Style:**

Labels use a white outline technique for legibility over terrain:

```typescript
function renderLabel(
  ctx: CanvasRenderingContext2D,
  label: MapLabel,
  zoom: number
) {
  const fontSize = getLabelFontSize(label.size) * zoom
  ctx.font = `${fontSize}px "IM Fell English", serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // White outline (draw text multiple times offset)
  ctx.fillStyle = '#FFFFFF'
  const outlineOffset = Math.max(1, fontSize * 0.08)
  for (let dx = -outlineOffset; dx <= outlineOffset; dx += outlineOffset) {
    for (let dy = -outlineOffset; dy <= outlineOffset; dy += outlineOffset) {
      if (dx !== 0 || dy !== 0) {
        ctx.fillText(label.text, label.position.x + dx, label.position.y + dy)
      }
    }
  }

  // Black fill
  ctx.fillStyle = '#1a1a1a'
  ctx.fillText(label.text, label.position.x, label.position.y)
}
```

**Font Sizes:**
- Small: 12px at 100% zoom
- Medium: 16px at 100% zoom
- Large: 24px at 100% zoom
- Extra Large: 32px at 100% zoom

### 8. Interaction Design

#### Path Drawing Flow

1. Select Path tool (R key)
2. Select path type from palette (1-4 keys or click)
3. Click on map to add first vertex (snaps to hex center/corner/midpoint)
4. Continue clicking to add more vertices
5. Each click shows:
   - Snap indicator at cursor if near snap point
   - Preview line from last vertex to cursor
6. Double-click to finish path (or Enter key)
7. Path is created and auto-saved
8. Escape cancels current path

#### Path Editing

- Click on a path to select it
- Selected path shows vertex handles (small circles)
- Drag vertex handles to reposition
- Delete key removes selected path
- Escape deselects

#### Path Deletion

- Erase tool: Click on path to delete it
- Select + Delete: Select path, press Delete
- Hit detection: 8px threshold from path lines

#### Label Placement Flow

1. Select Label tool (L key)
2. Select size from palette (1/2/3 keys or click)
3. Click on map to place label
4. Inline text editor appears at position
5. Type label text
6. Enter to confirm, Escape to cancel
7. Label is created and auto-saved

#### Label Editing

- Double-click label to edit text
- Single-click to select
- Drag selected label to reposition
- Delete key removes selected label
- Erase tool: Click label to delete

### 9. Keyboard Shortcuts

**Tool Selection:**
| Key | Action |
|-----|--------|
| P | Pan tool |
| T | Terrain tool |
| R | Path tool (R for "Road") |
| L | Label tool |
| E | Erase tool |
| Space | Temporary pan (hold) |

**When Path Tool Active:**
| Key | Action |
|-----|--------|
| 1 | Select Road |
| 2 | Select River |
| 3 | Select Border |
| 4 | Select Trail |
| Enter | Finish current path |
| Escape | Cancel current path |

**When Label Tool Active:**
| Key | Action |
|-----|--------|
| 1 | Small size |
| 2 | Medium size |
| 3 | Large size |
| 4 | Extra Large size |

**General:**
| Key | Action |
|-----|--------|
| Delete | Delete selected path/label |
| Escape | Deselect / Cancel operation |

### 10. Toolbar Updates

**Update MapToolbar (client/src/components/MapToolbar.tsx):**

```
┌───────────┐
│  TOOLS    │
├───────────┤
│   [Pan]   │  P
│ [Terrain] │  T
│  [Path]   │  R
│  [Label]  │  L
│  [Erase]  │  E
├───────────┤
│ [Palette] │  ← TerrainPalette, PathPalette, or TextSizeSelector
│    ...    │     based on selected tool
├───────────┤
│Space: Pan │
└───────────┘
```

**Tool Button Icons:**
- Pan: Hand/grab icon
- Terrain: Stamp/brush icon
- Path: Curved line icon (smooth path)
- Label: "A" or text icon
- Erase: Eraser icon

### 11. Path Utilities

**New File: client/src/utils/pathUtils.ts**

```typescript
/**
 * Generate points along a Catmull-Rom spline curve.
 * Returns an array of points that form a smooth curve through all input points.
 */
export function catmullRomSpline(
  points: MapPoint[],
  tension?: number,      // Default 0.5
  segments?: number      // Default 10 segments between each pair
): MapPoint[]

/**
 * Render a path on the canvas (uses catmullRomSpline for smooth curves)
 */
export function renderPath(
  ctx: CanvasRenderingContext2D,
  path: MapPath,
  zoom: number,
  isSelected: boolean
): void

/**
 * Check if a point is within hitDistance of any path segment.
 * Tests against the smoothed curve, not just the control points.
 */
export function hitTestPath(
  point: MapPoint,
  path: MapPath,
  hitDistance: number
): boolean

/**
 * Get the bounding box of a path
 */
export function getPathBounds(path: MapPath): {
  minX: number
  minY: number
  maxX: number
  maxY: number
}

/**
 * Get the style configuration for a path type
 */
export function getPathStyle(type: PathType): {
  color: string
  width: number
  dash: number[]
}
```

### 12. Label Utilities

**New File: client/src/utils/labelUtils.ts**

```typescript
/**
 * Render a label with white outline on the canvas
 */
export function renderLabel(
  ctx: CanvasRenderingContext2D,
  label: MapLabel,
  zoom: number,
  isSelected: boolean
): void

/**
 * Check if a point is within the label's bounding box
 */
export function hitTestLabel(
  point: MapPoint,
  label: MapLabel,
  ctx: CanvasRenderingContext2D,
  zoom: number
): boolean

/**
 * Get the font size in pixels for a label size
 */
export function getLabelFontSize(size: TextSize): number

/**
 * Get the bounding box of a label
 */
export function getLabelBounds(
  label: MapLabel,
  ctx: CanvasRenderingContext2D,
  zoom: number
): {
  x: number
  y: number
  width: number
  height: number
}
```

### 13. Project Structure Updates

**New Files:**
```
client/src/utils/pathUtils.ts       # Path rendering, hit testing
client/src/utils/labelUtils.ts      # Label rendering with outline
client/src/components/PathPalette.tsx       # Path type selector
client/src/components/TextSizeSelector.tsx  # Label size selector
client/src/components/LabelEditor.tsx       # Inline text input overlay
```

**Modified Files:**
```
shared/src/types.ts                  # PathType, MapPath, MapLabel, TextSize, MapPoint
client/src/hooks/useMapDrawing.ts    # Path/label state, drawing modes
client/src/components/MapCanvas.tsx  # Render paths/labels, interactions
client/src/components/MapToolbar.tsx # Path and Label tool buttons
client/src/utils/hexUtils.ts         # Hex center/corner/midpoint/snap functions
server/src/routes/maps.ts            # Validate paths/labels in content
```

## Design Details

### Path Aesthetic

Paths should look like they were drawn with a pen on a paper map—black ink only, matching B/X rulebook style:

- **Roads:** Dashed lines suggesting a traveled route. Thicker, long dashes for visibility.
- **Rivers:** Solid lines, thickest of all path types. Distinguished by weight, not color.
- **Borders:** Fine dotted lines marking territory boundaries. Subtle and non-intrusive.
- **Trails:** Thinner dashed lines for minor paths, animal trails, or secret routes.

### Label Typography

Labels use "IM Fell English" or similar serif font to match B/X aesthetic:

- Formal, old-world feel
- Highly readable at map scale
- White outline ensures legibility over any terrain
- No shadows or effects—just clean black text on white outline

### Snap Point Visualization

When placing path vertices:
- Show a small circle at the snap point when cursor is near
- Circle size: 6px at 100% zoom
- Style: Black stroke (`#1a1a1a`), white fill
- No snap indicator when not near any snap point

### Selection Visualization

**Selected Path:**
- Vertex handles shown as 8px circles at each point
- Handle fill: white
- Handle stroke: `#1a1a1a` (black), 2px
- Path itself unchanged (no highlight color change)

**Selected Label:**
- Subtle border around text bounding box
- Border: 1px `#1a1a1a` (black), dashed
- No fill change

### Layer System Note

All paths render below terrain icons, allowing terrain symbols to appear "on top of" route lines. This creates visual hierarchy where paths define the underlying geography while terrain icons mark specific points of interest. Rivers use grey (`#808080`) to visually connect with water terrain hexes.

## Acceptance Criteria

### Data Model
- [ ] MapPoint type added to shared types
- [ ] MapPath type with id, type, points, closed
- [ ] MapLabel type with id, text, position, size
- [ ] PathType union: 'road' | 'river' | 'stream' | 'border' | 'trail'
- [ ] TextSize union: 'small' | 'medium' | 'large' | 'xlarge'
- [ ] MapContent updated with optional paths and labels arrays

### API
- [ ] PATCH /api/maps/:id accepts paths array
- [ ] PATCH /api/maps/:id accepts labels array
- [ ] Path validation: type, points (min 2), point coordinates
- [ ] Label validation: text (1-200 chars), position, size
- [ ] Invalid path type returns 400
- [ ] Invalid label size returns 400

### Hex Utilities
- [ ] getHexCenter returns center point of a hex
- [ ] getHexCorners returns 6 corner points for a hex
- [ ] getHexEdgeMidpoints returns 6 edge midpoints
- [ ] findNearestSnapPoint finds closest snap point within threshold
- [ ] Snap points are correct for hex geometry

### Path Tool
- [ ] Toolbar shows Path tool button (R key)
- [ ] Path palette shows 4 path types with previews
- [ ] Clicking adds vertices
- [ ] Vertices snap to hex centers/corners/midpoints
- [ ] Snap indicator shows near valid snap points
- [ ] Double-click finishes path
- [ ] Enter key finishes path
- [ ] Escape cancels current path
- [ ] Minimum 2 points required for path

### Path Rendering
- [ ] Roads render as dashed black lines (4px, long dash)
- [ ] Rivers render as solid grey lines (5px, #808080 to match water terrain)
- [ ] Borders render as dotted black lines (2px)
- [ ] Trails render as dashed black lines (2px, short dash)
- [ ] 2-point paths render as straight lines
- [ ] 3+ point paths render as smooth Catmull-Rom curves
- [ ] Curves pass through all vertex points
- [ ] All paths render below terrain icons
- [ ] Line widths scale appropriately with zoom

### Path Editing
- [ ] Click path to select
- [ ] Selected path shows vertex handles
- [ ] Drag handles to reposition vertices
- [ ] Delete key removes selected path
- [ ] Erase tool deletes path on click
- [ ] Escape deselects path

### Label Tool
- [ ] Toolbar shows Label tool button (L key)
- [ ] Size selector shows S/M/L/XL options
- [ ] Clicking opens inline text editor
- [ ] Editor positioned at click location
- [ ] Enter confirms label
- [ ] Escape cancels label creation
- [ ] Empty text cancels/deletes label

### Label Rendering
- [ ] Labels render with correct font sizes
- [ ] White outline provides legibility
- [ ] Black text fill
- [ ] Labels render above all paths
- [ ] Labels scale appropriately with zoom

### Label Editing
- [ ] Double-click label opens editor
- [ ] Single-click selects label
- [ ] Drag selected label to reposition
- [ ] Delete key removes selected label
- [ ] Erase tool deletes label on click

### Keyboard Shortcuts
- [ ] R key selects Path tool
- [ ] L key selects Label tool
- [ ] 1-4 select path types (when Path tool active)
- [ ] 1-4 select label sizes (when Label tool active)
- [ ] Delete removes selected element
- [ ] Escape cancels/deselects

### Auto-Save
- [ ] Path creation triggers debounced save
- [ ] Path modification triggers save
- [ ] Path deletion triggers save
- [ ] Label creation triggers save
- [ ] Label modification triggers save
- [ ] Label deletion triggers save

### Performance
- [ ] Smooth rendering with 50+ paths
- [ ] Smooth rendering with 100+ labels
- [ ] No lag when drawing paths

## Verification Steps

### 1. Path Creation Test

1. Open a hex map in editor
2. Select Path tool (R key)
3. Select Road from palette
4. Click on hex center/corner - vertex appears, snaps to nearest snap point
5. Click on adjacent hex midpoint - line drawn, snaps to midpoint
6. Click on third point
7. Double-click to finish
8. Road renders as dashed black line
9. Wait for save indicator
10. Refresh page - road persists

### 2. All Path Types Test

1. Create one path of each type: road, river, border, trail
2. Verify each has correct visual style:
   - Road: dashed black, 4px (long dash)
   - River: solid grey (#808080), 5px (thickest)
   - Border: dotted black, 2px
   - Trail: dashed black, 2px (short dash)
3. Zoom in and out - verify styles scale appropriately

### 3. Curve Smoothing Test

1. Create a path with exactly 2 points
2. Verify path renders as a straight line
3. Create a path with 4+ points in a zigzag pattern
4. Verify path renders as a smooth curve through all points
5. Verify no sharp corners at intermediate vertices
6. Drag a vertex handle - verify curve updates smoothly

### 4. Layer Order Test

1. Draw a river across several hexes
2. Stamp forest terrain on hexes the river passes through
3. Verify terrain icons render on top of the river path
4. Draw a road crossing the same hexes
5. Verify terrain icons render on top of the road path as well
6. Verify rivers display as grey (#808080) matching water terrain

### 5. Snap Behavior Test

1. Select Path tool
2. Move cursor slowly toward hex corner
3. Verify snap indicator appears when within threshold
4. Click - vertex should be at exact snap point
5. Move toward edge midpoint
6. Verify snap indicator appears at midpoint
7. Click - vertex at exact midpoint

### 6. Label Creation Test

1. Select Label tool (L key)
2. Select Medium size
3. Click on map
4. Text editor appears at click position
5. Type "Dragon Lair"
6. Press Enter
7. Label renders with white outline
8. Verify B/X-style font appearance

### 7. Label Editing Test

1. Create a label "Old Name"
2. Double-click the label
3. Text editor appears with "Old Name"
4. Change to "New Name"
5. Press Enter
6. Label text updates immediately
7. Verify auto-save

### 8. Drag Label Test

1. Create a label
2. Single-click to select
3. Drag label to new position
4. Release - label repositions
5. Verify auto-save
6. Refresh - label at new position

### 9. Path Editing Test

1. Create a road with 4 vertices
2. Click road to select
3. Verify 4 vertex handles appear
4. Drag middle vertex to new position
5. Verify path updates in real-time
6. Verify auto-save

### 10. Erase Tool Test

1. Create several paths and labels
2. Select Erase tool (E key)
3. Click on a path - path deleted
4. Click on a label - label deleted
5. Verify each deletion triggers save

### 11. Delete Key Test

1. Create a path
2. Click to select
3. Press Delete key
4. Verify path deleted
5. Create a label
6. Click to select
7. Press Delete key
8. Verify label deleted

### 12. Keyboard Shortcut Test

1. Press R - Path tool selected
2. Press 1 - Road selected
3. Press 2 - River selected
4. Press L - Label tool selected
5. Press 1 - Small size selected
6. Press 2 - Medium size selected
7. Press 3 - Large size selected
8. Press 4 - Extra Large size selected
9. Press T - Terrain tool (existing)
10. Press E - Erase tool

### 13. Cancel Operations Test

1. Select Path tool, start drawing vertices
2. Press Escape - path cancelled, no path created
3. Select Label tool, click to place
4. Press Escape in editor - label cancelled
5. Select a path
6. Press Escape - path deselected

## Future Considerations

This spec establishes smooth curved paths and text labels. Future enhancements could include:

- **Manual Bezier Control:** User-adjustable control points for precise curve shaping
- **Path Labels:** Text that follows along a path (road names)
- **Label Rotation:** Angled labels for terrain features
- **Multi-segment Selection:** Select and move multiple elements
- **Copy/Paste:** Duplicate paths and labels

## References

- [PRD: Map Editor Tools](/prd.md#map-editor-tools)
- [Spec 005a: Map Foundation](/specs/005a-map-foundation.md)
- [Spec 005b: Wilderness Map Drawing](/specs/005b-map-drawing.md)
- [B/X D&D Expert Rulebook](https://en.wikipedia.org/wiki/Dungeons_%26_Dragons_Expert_Set) - Hex crawl map reference
