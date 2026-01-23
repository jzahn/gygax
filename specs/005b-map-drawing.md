# Spec 005b: Wilderness Map Drawing

## Goal

Implement terrain stamping tools that allow DMs to create wilderness hex maps directly in the application. Click any hex to apply a terrain type—enabling the creation of complete B/X-style hex crawl maps without external tools.

## Scope

### In Scope

- Map content data model (terrain stamps stored per-map)
- Terrain toolbar UI with icon-based terrain selector
- Click-to-stamp terrain application
- Eraser tool for clearing hexes
- 17 terrain types matching B/X Expert Set style (11 natural + 6 settlements)
- Real-time canvas rendering of terrain icons
- Auto-save of map content
- B/X pen-and-ink aesthetic for all terrain icons

### Out of Scope

- Paths (roads, rivers, trails, borders) - future spec
- Text labels and annotations - spec 005c
- Map transitions/linking - spec 005d
- Fog of war - spec 006
- Undo/redo system (future enhancement)
- Square grid support (hex-only for wilderness maps)

## Dependencies

**Builds on:**
- Spec 005a: Map Foundation (Map model, canvas component)

**No new dependencies required.** All rendering uses native HTML5 Canvas API.

## Detailed Requirements

### 1. Database Schema

**Update Map Model (prisma/schema.prisma):**

```prisma
model Map {
  // ... existing fields from 005a

  // Drawing data stored as JSON
  content   Json?    // MapContent type - terrain stamps
}
```

**MapContent Type (shared/src/types.ts):**

```typescript
// Hex coordinate (column, row)
export interface HexCoord {
  col: number  // Column index
  row: number  // Row index
}

// A terrain stamp applied to a hex
export interface TerrainStamp {
  hex: HexCoord
  terrain: TerrainType
}

// Natural terrain types
export type NaturalTerrain =
  | 'clear'      // Empty hex, no icon
  | 'grasslands' // Short vertical grass strokes
  | 'forest'     // Clustered deciduous tree circles
  | 'jungle'     // Ring of palm trees
  | 'hills'      // Curved hump shapes
  | 'mountains'  // Triangular peaks
  | 'desert'     // Scattered dots
  | 'swamp'      // Vertical reed tufts
  | 'water'      // Stippled/wave pattern
  | 'volcano'    // Mountain with smoke plume
  | 'barren'     // Jagged broken terrain lines

// Settlement/POI types
export type SettlementTerrain =
  | 'castle'     // Square with crenellations
  | 'ruins'      // Broken castle shape
  | 'capitol'    // Large city silhouette with star
  | 'city'       // City silhouette with circle
  | 'town'       // Smaller city with circle
  | 'caves'      // Eye-shaped cave entrance

export type TerrainType = NaturalTerrain | SettlementTerrain

// Complete map drawing content
export interface MapContent {
  version: number  // Schema version for future migrations
  terrain: TerrainStamp[]
}
```

### 2. API Updates

#### PATCH /api/maps/:id

Add support for updating map content.

**Request (partial update):**
```json
{
  "content": {
    "version": 1,
    "terrain": [
      { "hex": { "col": 5, "row": 3 }, "terrain": "forest" },
      { "hex": { "col": 6, "row": 3 }, "terrain": "mountains" }
    ]
  }
}
```

**Validation:**
- `content` must conform to MapContent schema if provided
- `content.version` must be 1 (current version)
- Hex coordinates must be within map bounds
- Terrain type must be valid TerrainType

### 3. Drawing Tools

#### Tool Selection

The map editor toolbar provides mutually exclusive tool modes:

| Tool | Icon | Behavior |
|------|------|----------|
| Pan | Hand | Default. Click-drag to pan the map (existing behavior) |
| Terrain | Stamp | Click a hex to apply selected terrain type |
| Erase | Eraser | Click a hex to clear its terrain |

#### Terrain Tool

**Behavior:**
1. Select Terrain tool from toolbar (T key)
2. Select a terrain type from the terrain palette
3. Click on any hex to apply the terrain
4. Clicking an already-stamped hex replaces its terrain
5. Hover shows preview of terrain placement

**Terrain Types (B/X Expert Set Style):**

| Type | Icon Description |
|------|------------------|
| **Natural Terrain (11)** | |
| Clear | Empty hex (removes any terrain) |
| Grasslands | 2-3 small tufts of short vertical grass strokes |
| Forest | 3 clustered deciduous tree shapes (cloud-like circles) |
| Jungle | Ring of 5-6 palm tree silhouettes forming a circle |
| Hills | 2-3 curved hump shapes (like bird wings) |
| Mountains | 2-3 triangular peaks, largest in center |
| Desert | 5-7 scattered small dots |
| Swamp | 3-4 vertical reed/cattail tufts |
| Water | Stippled dot pattern filling the hex |
| Volcano | Single mountain peak with smoke plume rising |
| Barren | Jagged wavy lines suggesting broken/rocky terrain |
| **Settlements (6)** | |
| Castle | Small square with crenellated top |
| Ruins | Broken/partial castle shape |
| Capitol | City silhouette (spires) with star marker |
| City | City silhouette with circle marker |
| Town | Smaller city silhouette with circle marker |
| Caves | Eye-shaped opening with concentric arcs |

All icons use B/X aesthetic: black ink on white, hand-drawn feel, no color.

#### Eraser Tool

**Behavior:**
1. Select Eraser tool from toolbar (E key)
2. Click on any hex with terrain to clear it
3. Hover highlights the hex that will be cleared

### 4. UI Components

#### Drawing Toolbar (client/src/components/MapToolbar.tsx)

**Layout (horizontal bar above canvas):**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  [Pan] [Terrain] [Erase]  │  Natural: [🌲][⛰][🏜]...  │  Settlements: [🏰]...│
└─────────────────────────────────────────────────────────────────────────────┘
```

**Tool Buttons:**
- Icon buttons with tooltip labels
- Selected tool has active state (darker background, border)
- Keyboard shortcuts: P (Pan), T (Terrain), E (Erase)
- **Space bar:** Hold to temporarily enable Pan tool, release to return to previous tool

**Terrain Palette:**
- Only visible when Terrain tool is selected
- Organized into two groups: Natural (11) and Settlements (6)
- Small square buttons showing terrain icon preview
- Selected terrain has active state
- Scrollable if needed, or use dropdown/popover for settlements

#### Toolbar Styling

- Matches existing UI: parchment background, black borders
- Sits inside the map editor page header area
- Does not overlap the canvas

### 5. Canvas Rendering Updates

Update MapCanvas component to render terrain stamps:

**Render Order (back to front):**
1. White background
2. Grid lines (hex outlines)
3. Terrain icons (centered in each hex)
4. Hover preview (when placing terrain)
5. Tool cursor indicator

**Terrain Icon Rendering:**

Each terrain type has a procedurally-drawn icon function:

```typescript
function renderTerrainIcon(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  terrain: TerrainType,
  hexSize: number
) {
  // Icon should fit within ~60% of hex size
  const iconScale = hexSize * 0.6

  ctx.strokeStyle = '#1a1a1a'
  ctx.fillStyle = '#1a1a1a'
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  switch (terrain) {
    case 'forest':
      drawForestIcon(ctx, centerX, centerY, iconScale)
      break
    case 'mountains':
      drawMountainsIcon(ctx, centerX, centerY, iconScale)
      break
    // ... etc for each terrain type
  }
}
```

**Example Icon Functions:**

```typescript
function drawForestIcon(ctx, cx, cy, scale) {
  // 3 clustered tree circles
  const r = scale * 0.2
  ctx.beginPath()
  ctx.arc(cx - r, cy + r * 0.5, r, 0, Math.PI * 2)
  ctx.arc(cx + r, cy + r * 0.5, r, 0, Math.PI * 2)
  ctx.arc(cx, cy - r * 0.5, r * 1.1, 0, Math.PI * 2)
  ctx.stroke()
}

function drawMountainsIcon(ctx, cx, cy, scale) {
  // 2-3 triangular peaks
  ctx.beginPath()
  // Large center peak
  ctx.moveTo(cx - scale * 0.4, cy + scale * 0.3)
  ctx.lineTo(cx, cy - scale * 0.4)
  ctx.lineTo(cx + scale * 0.4, cy + scale * 0.3)
  // Smaller side peak
  ctx.moveTo(cx + scale * 0.1, cy + scale * 0.3)
  ctx.lineTo(cx + scale * 0.35, cy - scale * 0.1)
  ctx.lineTo(cx + scale * 0.55, cy + scale * 0.3)
  ctx.stroke()
}
```

### 6. State Management

#### Local Drawing State

During editing, maintain local state for performance:

```typescript
interface DrawingState {
  tool: 'pan' | 'terrain' | 'erase'
  selectedTerrain: TerrainType
  terrain: Map<string, TerrainType>  // Key: "col,row" -> terrain
  hoveredHex: HexCoord | null
  isDirty: boolean  // Has unsaved changes
  isSpaceHeld: boolean  // Temporary pan mode active
}

// Helper to convert terrain Map to array for saving
function terrainToArray(terrain: Map<string, TerrainType>): TerrainStamp[] {
  return Array.from(terrain.entries()).map(([key, type]) => {
    const [col, row] = key.split(',').map(Number)
    return { hex: { col, row }, terrain: type }
  })
}
```

#### Auto-Save

- Debounce saves: wait 2 seconds after last change before saving
- Show "Saving..." indicator during save
- Show "Saved" confirmation briefly after successful save
- Show error state if save fails (with retry option)

### 7. Project Structure Updates

**New Files:**
```
client/src/components/MapToolbar.tsx      # Tool selection bar (Pan/Terrain/Erase)
client/src/components/TerrainPalette.tsx  # Terrain type selector with icons
client/src/hooks/useMapDrawing.ts         # Drawing state and logic
client/src/utils/terrainIcons.ts          # Procedural terrain icon drawing functions
client/src/utils/hexUtils.ts              # Hex coordinate/pixel conversion helpers
```

**Modified Files:**
```
prisma/schema.prisma                      # Add content field to Map
shared/src/types.ts                       # Add terrain types and MapContent
server/src/routes/maps.ts                 # Handle content updates
client/src/components/MapCanvas.tsx       # Render terrain icons, handle stamping
client/src/pages/MapEditorPage.tsx        # Add toolbar, manage drawing state
```

## Design Details

### Icon Aesthetic

All terrain icons should look like they were drawn with a fine-tip pen on paper, matching the B/X Expert Set style:

- **Line weight:** Consistent 1.5-2px strokes at 100% zoom
- **Style:** Simple, iconic shapes—not detailed illustrations
- **Color:** Black ink only (#1a1a1a), no fills or shading
- **Scale:** Icons fill ~60% of hex, leaving clear border space
- **Overall:** Clean, readable at small sizes, instantly recognizable

### Icon Design Principles

- Each icon should be identifiable at 50% zoom
- Icons are centered within the hex
- Avoid too much detail—these are map symbols, not art
- Reference the small hex icons in the B/X reference, not the large detailed ones
- Natural terrain icons use abstract patterns (dots, strokes, shapes)
- Settlement icons use silhouettes with simple identifying features

### Hex-Only Design

This spec is designed specifically for hex wilderness maps:
- Square grid maps are not supported for wilderness terrain stamping
- All icons are designed to fit within flat-top hexagon shapes
- Hex coordinate system uses odd-q offset (odd columns shifted down)

## Acceptance Criteria

### Database
- [ ] Map model includes `content` JSON field
- [ ] Migration adds content column to maps table

### API
- [ ] PATCH /api/maps/:id accepts content field
- [ ] Content is validated against MapContent schema
- [ ] Invalid terrain type returns 400 error
- [ ] Out-of-bounds hex coordinates return 400 error

### Drawing Tools
- [ ] Toolbar displays with Pan, Terrain, Erase tools
- [ ] Only one tool can be active at a time
- [ ] Keyboard shortcuts work (P, T, E)
- [ ] Tool selection persists during editing session
- [ ] Holding Space temporarily activates Pan tool
- [ ] Releasing Space returns to previous tool

### Terrain Tool
- [ ] Terrain palette shows all 17 terrain types (11 natural + 6 settlements)
- [ ] Palette organized into Natural and Settlements groups
- [ ] Clicking hex applies selected terrain
- [ ] Clicking stamped hex replaces terrain
- [ ] Hover shows terrain preview on target hex
- [ ] Clear terrain type removes existing terrain

### Eraser Tool
- [ ] Clicking stamped hex clears its terrain
- [ ] Hover highlights hex that will be cleared
- [ ] Clicking empty hex does nothing

### Rendering
- [ ] All 17 terrain icons render correctly
- [ ] Icons are centered within hexes
- [ ] Icons scale correctly with zoom (readable at 50%)
- [ ] Grid lines render on top of icons
- [ ] Performance remains smooth with 500+ stamped hexes

### Auto-Save
- [ ] Changes trigger debounced save (2 second delay)
- [ ] Saving indicator shows during save
- [ ] Saved confirmation shows after save
- [ ] Error state shows if save fails

### Hex-Only
- [ ] Terrain tool only available for hex grid maps
- [ ] Square grid maps show message that terrain stamping requires hex grid

## Verification Steps

### 1. Terrain Stamping Test

1. Open a hex map in editor
2. Select Terrain tool (T key)
3. Select Forest from terrain palette
4. Click on empty hex - forest icon appears
5. Select Mountains
6. Click on forest hex - icon changes to mountains
7. Select Clear
8. Click on mountains hex - terrain removed
9. Verify terrain persists after page refresh

### 2. All Terrain Types Test

1. Stamp each of the 17 terrain types on different hexes
2. Verify each icon is distinct and recognizable
3. Zoom to 50% - verify icons still readable
4. Zoom to 300% - verify icons don't pixelate badly

### 3. Eraser Test

1. Stamp several hexes with terrain
2. Select Eraser tool (E key)
3. Hover over stamped hex - verify highlight
4. Click stamped hex - verify terrain cleared
5. Click empty hex - verify nothing happens

### 4. Auto-Save Test

1. Stamp a hex with terrain
2. Verify "Saving..." appears after 2 seconds
3. Verify "Saved" appears after completion
4. Refresh page - verify terrain persisted

### 5. Performance Test

1. Open a large hex map (50x50 or larger)
2. Stamp 100+ hexes with various terrain
3. Pan and zoom around the map
4. Verify smooth performance (no lag)

### 6. Square Grid Restriction Test

1. Open or create a square grid map
2. Verify Terrain tool is disabled or shows message
3. Only Pan tool should be available

### 7. Space Bar Pan Test

1. Select Terrain tool, choose a terrain type
2. Hold Space bar - cursor should change to pan cursor
3. Click and drag - map should pan (not stamp terrain)
4. Release Space bar - cursor returns to terrain tool
5. Click hex - terrain should stamp normally
6. Repeat with Eraser tool selected

## Future Considerations

This spec establishes the core hex terrain stamping system. Future specs will add:

- **Paths:** Roads, rivers, trails, borders, cliffs (line-based features)
- **Undo/Redo:** Command pattern for reversible operations
- **Flood Fill:** Fill connected empty hexes with same terrain in one click
- **Copy/Paste:** Duplicate sections of the map
- **Custom Icons:** User-uploaded terrain icons
- **Dungeon Maps:** Wall-based drawing for indoor/dungeon maps

## References

- [PRD: Map Editor Tools](/prd.md#map-editor-tools)
- [PRD: Map Aesthetic](/prd.md#map-aesthetic)
- [Spec 005a: Map Foundation](/specs/005a-map-foundation.md)
- [B/X D&D Expert Rulebook](https://en.wikipedia.org/wiki/Dungeons_%26_Dragons_Expert_Set) - Hex crawl map style reference
