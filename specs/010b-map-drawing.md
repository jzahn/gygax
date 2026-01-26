# Spec 010b: Wilderness Map Drawing

## Goal

Implement terrain stamping tools that allow DMs to create wilderness hex maps directly in the application. Click any hex to apply a terrain type—enabling the creation of complete B/X-style hex crawl maps without external tools.

## Scope

### In Scope

- Map content data model (terrain stamps stored per-map)
- Terrain toolbar UI with icon-based terrain selector
- Click-to-stamp terrain application
- Eraser tool for clearing hexes
- 17 terrain types matching B/X Expert Set style (12 natural + 5 settlements)
- Real-time canvas rendering of terrain icons
- Auto-save of map content
- B/X pen-and-ink aesthetic for all terrain icons

### Out of Scope

- Paths (roads, rivers, trails, borders) - future spec
- Text labels and annotations - spec 010c
- Map transitions/linking - spec 010d
- Fog of war - spec 012
- Undo/redo system (future enhancement)
- Square grid support (hex-only for wilderness maps)

## Dependencies

**Builds on:**
- Spec 010a: Map Foundation (Map model, canvas component)

**No new dependencies required.** All rendering uses native HTML5 Canvas API.

## Detailed Requirements

### 1. Database Schema

**Update Map Model (prisma/schema.prisma):**

```prisma
model Map {
  // ... existing fields from 010a

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
  variant: 0 | 1 | 2  // Each terrain has 3 visual variants
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
  | 'caves'      // Eye-shaped cave entrance

// Settlement/POI types
export type SettlementTerrain =
  | 'castle'     // Square with crenellations
  | 'ruins'      // Broken castle shape
  | 'capitol'    // Large city silhouette with star
  | 'city'       // City silhouette with circle
  | 'town'       // Smaller city with circle

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
| **Natural Terrain (12)** | |
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
| Caves | Eye-shaped opening with concentric arcs |
| **Settlements (5)** | |
| Castle | Small square with crenellated top |
| Ruins | Broken/partial castle shape |
| Capitol | City silhouette (spires) with star marker |
| City | City silhouette with circle marker |
| Town | Smaller city silhouette with circle marker |

All icons use B/X aesthetic: black ink on white, hand-drawn feel, no color.

#### Eraser Tool

**Behavior:**
1. Select Eraser tool from toolbar (E key)
2. Click on any hex with terrain to clear it
3. Hover highlights the hex that will be cleared

### 4. UI Components

#### Drawing Toolbar (client/src/components/MapToolbar.tsx)

**Layout (vertical bar on RIGHT side of canvas):**
```
┌───────────┐
│   [Pan]   │
│ [Terrain] │
│  [Erase]  │
├───────────┤
│  Natural  │
│   [🌲]    │
│   [⛰]    │
│   [🏜]    │
│    ...    │
├───────────┤
│Settlements│
│   [🏰]    │
│    ...    │
├───────────┤
│ Space:Pan │
└───────────┘
```

**Tool Buttons:**
- Icon buttons stacked vertically with tooltip labels
- Selected tool has active state (darker background, border)
- Keyboard shortcuts: P (Pan), T (Terrain), E (Erase)
- **Space bar:** Hold to temporarily enable Pan tool, release to return to previous tool

**Terrain Palette:**
- Only visible when Terrain tool is selected
- Scrollable list within the toolbar
- Organized into two groups: Natural (12) and Settlements (5)
- Small canvas previews of each terrain icon
- Selected terrain has active state

#### Toolbar Styling

- Matches existing UI: parchment background, black borders
- Thin vertical bar positioned on the RIGHT side of the canvas
- Does not overlap the canvas
- "Space: Pan" hint at bottom of toolbar

### 5. Canvas Rendering Updates

Update MapCanvas component to render terrain stamps:

**Render Order (back to front):**
1. Black background (outside hex bounds)
2. White hex fills (inside each hex)
3. Grid lines (hex outlines)
4. Terrain icons (centered in each hex)
5. Hover preview (when placing terrain)
6. Tool cursor indicator

**Terrain Icon Rendering:**

Each terrain type uses pre-rendered PNG images for visual variety and B/X aesthetic authenticity. Images are organized by terrain name and variant:

```
/terrain/{terrain}-{variant}.png
```

For example: `forest-0.png`, `forest-1.png`, `forest-2.png`

**Terrain Variants:**

Each terrain type has 3 visual variants (0, 1, 2) providing natural variety across the map. When stamping terrain, a random variant is selected automatically.

```typescript
// Preload all terrain images at startup
const terrainImages: Map<string, HTMLImageElement> = new Map()

async function preloadTerrainImages() {
  const terrains: TerrainType[] = ['forest', 'mountains', ...]
  const variants = [0, 1, 2]

  for (const terrain of terrains) {
    for (const variant of variants) {
      const img = new Image()
      img.src = `/terrain/${terrain}-${variant}.png`
      await img.decode()
      terrainImages.set(`${terrain}-${variant}`, img)
    }
  }
}

function renderTerrainIcon(
  ctx: CanvasRenderingContext2D,
  centerX: number,
  centerY: number,
  terrain: TerrainType,
  variant: 0 | 1 | 2,
  hexSize: number
) {
  const key = `${terrain}-${variant}`
  const img = terrainImages.get(key)
  if (!img || terrain === 'clear') return

  // Icon should fit within ~60% of hex size
  const iconScale = hexSize * 0.6
  ctx.drawImage(
    img,
    centerX - iconScale / 2,
    centerY - iconScale / 2,
    iconScale,
    iconScale
  )
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
client/src/utils/terrainIcons.ts          # Terrain icon image loading and rendering
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

All terrain icons are pre-rendered PNG images that look like they were drawn with a fine-tip pen on paper, matching the B/X Expert Set style:

- **Style:** Simple, iconic shapes—not detailed illustrations
- **Color:** Black ink only (#1a1a1a), no fills or shading
- **Scale:** Icons fill ~60% of hex, leaving clear border space
- **Overall:** Clean, readable at small sizes, instantly recognizable
- **Variants:** 3 visual variants per terrain type provide natural map variety

### Icon Design Principles

- Each icon should be identifiable at 50% zoom
- Icons are centered within the hex
- Avoid too much detail—these are map symbols, not art
- Reference the small hex icons in the B/X reference, not the large detailed ones
- Natural terrain icons use abstract patterns (dots, strokes, shapes)
- Settlement icons use silhouettes with simple identifying features
- Variants provide visual variety while maintaining recognizable terrain types

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
- [ ] Terrain palette shows all 17 terrain types (12 natural + 5 settlements)
- [ ] Palette organized into Natural and Settlements groups
- [ ] Each terrain stamp stores a variant (0, 1, or 2) for visual variety
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
- [ ] Terrain tool only visible for hex grid maps
- [ ] Terrain tool hidden from toolbar for square grid maps

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

### 6. Square Grid Tool Visibility Test

1. Open or create a square grid map
2. Verify Terrain tool is not visible in toolbar
3. Verify Pan, Path, Label, Erase tools are visible

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
- [Spec 010a: Map Foundation](/specs/010a-map-foundation.md)
- [B/X D&D Expert Rulebook](https://en.wikipedia.org/wiki/Dungeons_%26_Dragons_Expert_Set) - Hex crawl map style reference
