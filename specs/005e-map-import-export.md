# Spec 005e: Map Import/Export

## Goal

Allow DMs to save maps to local JSON files and import saved maps when creating new maps. This enables backup, sharing, and template reuse across campaigns.

## Scope

### In Scope

- Export map to JSON file (download)
- Import map from JSON file during map creation
- Auto-increment duplicate names: "Map Name", "Map Name (1)", "Map Name (2)"...
- Support both hex and square grid maps
- Preserve all map content (terrain, paths, labels, walls, features)

### Out of Scope

- Server-side map templates/library
- Map sharing between users via the app
- Partial import (merging content)
- Image export (PNG/SVG)

## Dependencies

**Builds on:**
- Spec 005a: Map Foundation (Map model, CRUD)
- Spec 005b-d: Map content types (terrain, paths, labels, walls, features)

**No new dependencies required.**

## Detailed Requirements

### 1. Export File Format

**File naming:** `{map-name}.gygax.json`

**File structure:**

```typescript
interface MapExportFile {
  version: 1
  exportedAt: string  // ISO 8601 timestamp
  map: {
    name: string
    description: string | null
    gridType: 'SQUARE' | 'HEX'
    width: number
    height: number
    cellSize: number
    content: MapContent | null
  }
}
```

**Example (hex map):**
```json
{
  "version": 1,
  "exportedAt": "2024-01-20T12:00:00.000Z",
  "map": {
    "name": "The Howling Wastes",
    "description": "A desolate wilderness region",
    "gridType": "HEX",
    "width": 30,
    "height": 30,
    "cellSize": 40,
    "content": {
      "version": 2,
      "terrain": [
        { "hex": { "col": 5, "row": 3 }, "terrain": "desert", "variant": 0 }
      ],
      "paths": [],
      "labels": [
        { "id": "lbl1", "text": "Wastes", "position": { "x": 200, "y": 150 }, "size": "large" }
      ]
    }
  }
}
```

**Example (square grid map):**
```json
{
  "version": 1,
  "exportedAt": "2024-01-20T12:00:00.000Z",
  "map": {
    "name": "Dungeon Level 1",
    "description": "The entrance level",
    "gridType": "SQUARE",
    "width": 40,
    "height": 40,
    "cellSize": 40,
    "content": {
      "version": 3,
      "terrain": [],
      "walls": [
        { "col": 0, "row": 0 },
        { "col": 1, "row": 0 }
      ],
      "features": [
        { "id": "f1", "type": "door", "position": { "col": 5, "row": 0 }, "rotation": 0 }
      ],
      "labels": []
    }
  }
}
```

### 2. Export Flow

**Trigger:** Menu option in map editor header (alongside Edit, Delete)

**Menu structure:**
```
[···]
├── Edit
├── Export
└── Delete
```

**Behavior:**
1. User clicks "Export" in map menu
2. Browser downloads `{map-name}.gygax.json`
3. Toast confirmation: "Map exported"

**Implementation:**
```typescript
function exportMap(map: Map) {
  const exportData: MapExportFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    map: {
      name: map.name,
      description: map.description,
      gridType: map.gridType,
      width: map.width,
      height: map.height,
      cellSize: map.cellSize,
      content: map.content
    }
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json'
  })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeFilename(map.name)}.gygax.json`
  a.click()

  URL.revokeObjectURL(url)
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '')  // Remove invalid chars
    .replace(/\s+/g, '-')          // Spaces to hyphens
    .toLowerCase()
    .slice(0, 100)                 // Limit length
}
```

### 3. Import Flow

**Trigger:** Optional file input in Create Map modal

**Updated Create Map Modal:**
```
┌────────────────────────────────────────────┐
│  CHART NEW TERRITORY                   ✕   │
│  ══════════════════════════════════════    │
│                                            │
│  IMPORT FROM FILE (optional)               │
│  ┌────────────────────────────────────┐    │
│  │  [Choose File]  No file selected   │    │
│  └────────────────────────────────────┘    │
│  Import a .gygax.json file to pre-fill     │
│                                            │
│  ────────────── or ──────────────          │
│                                            │
│  MAP NAME                                  │
│  ┌────────────────────────────────────┐    │
│  │                                    │    │
│  └────────────────────────────────────┘    │
│                                            │
│  ... (rest of form as before) ...          │
│                                            │
│              [Cancel]  [CREATE]            │
└────────────────────────────────────────────┘
```

**Behavior:**
1. User opens Create Map modal
2. User selects a `.gygax.json` file via file input
3. File is parsed and validated
4. Form fields are pre-filled with imported data:
   - Name, description, gridType, width, height
5. Grid type selector becomes disabled (matches imported map)
6. User can still edit name/description before creating
7. On submit, map is created with imported content

**File Validation:**
- Must be valid JSON
- Must have `version: 1`
- Must have valid `map` object with required fields
- `gridType` must be 'SQUARE' or 'HEX'
- `width` and `height` must be in valid range (5-100)
- `content` is optional but if present must match MapContent schema

**Error handling:**
- Invalid file format: Show error toast "Invalid map file format"
- Missing required fields: Show error toast "Map file is missing required data"
- Clear file input and allow retry

### 4. Duplicate Name Handling

When creating a map (with or without import), if a map with the same name already exists in the campaign, auto-increment the name.

**Algorithm:**
```typescript
async function getUniqueName(campaignId: string, baseName: string): Promise<string> {
  const existingMaps = await prisma.map.findMany({
    where: { campaignId },
    select: { name: true }
  })

  const existingNames = new Set(existingMaps.map(m => m.name))

  if (!existingNames.has(baseName)) {
    return baseName
  }

  // Check for pattern: "Name (n)"
  let counter = 1
  let candidateName = `${baseName} (${counter})`

  while (existingNames.has(candidateName)) {
    counter++
    candidateName = `${baseName} (${counter})`
  }

  return candidateName
}
```

**Examples:**
- First import of "Dungeon Level 1" → "Dungeon Level 1"
- Second import of "Dungeon Level 1" → "Dungeon Level 1 (1)"
- Third import of "Dungeon Level 1" → "Dungeon Level 1 (2)"
- Import when "Dungeon Level 1" and "Dungeon Level 1 (1)" exist → "Dungeon Level 1 (2)"

### 5. API Updates

#### POST /api/campaigns/:campaignId/maps

Update to support importing content and auto-generating unique names.

**Request (with import):**
```json
{
  "name": "Dungeon Level 1",
  "description": "The entrance level",
  "gridType": "SQUARE",
  "width": 40,
  "height": 40,
  "content": { ... }
}
```

**Behavior changes:**
- If `name` already exists in campaign, auto-increment: "Name (1)", "Name (2)", etc.
- Accept optional `content` field for pre-populating map data
- Return the actual name used (may differ from requested if incremented)

**Response (201):**
```json
{
  "map": {
    "id": "clx...",
    "name": "Dungeon Level 1 (1)",
    ...
  }
}
```

### 6. Type Definitions

**Add to shared/src/types.ts:**

```typescript
// Map export file format
export interface MapExportFile {
  version: 1
  exportedAt: string
  map: {
    name: string
    description: string | null
    gridType: GridType
    width: number
    height: number
    cellSize: number
    content: MapContent | null
  }
}

// Update CreateMapRequest to include optional content
export interface CreateMapRequest {
  name: string
  description?: string
  gridType?: GridType
  width?: number
  height?: number
  content?: MapContent  // NEW - for import
}
```

### 7. Project Structure

**Modified Files:**
```
shared/src/types.ts                    # MapExportFile type, update CreateMapRequest
server/src/routes/maps.ts              # Unique name generation, accept content on create
client/src/components/CreateMapModal.tsx  # File import UI
client/src/pages/MapEditorPage.tsx     # Export menu option
```

**New Files:**
```
client/src/utils/mapExport.ts          # Export/import helpers
```

## Design Details

### Export Button Location

The Export option lives in the map editor's menu (the "···" button), alongside Edit and Delete. This keeps export accessible without cluttering the main UI.

### Import UI

The file input appears at the top of the Create Map modal, clearly optional with "or" separator. When a file is selected:
- Form fields populate instantly
- Grid type selector disables (can't change imported map type)
- User can still modify name/description
- Clear button allows removing the import and starting fresh

### File Extension

Using `.gygax.json` extension:
- Clearly identifies the file type
- Still readable as JSON by any editor
- Prevents confusion with generic JSON files
- Easy to associate with the app in the future

## Acceptance Criteria

### Export
- [ ] Export option appears in map editor menu
- [ ] Clicking Export downloads `.gygax.json` file
- [ ] File contains all map metadata (name, description, gridType, dimensions)
- [ ] File contains all map content (terrain, paths, labels, walls, features)
- [ ] Filename is sanitized from map name
- [ ] Toast confirms successful export

### Import
- [ ] File input appears in Create Map modal
- [ ] Selecting valid file pre-fills form fields
- [ ] Grid type selector disables after import
- [ ] Invalid file shows error toast
- [ ] User can clear import and start fresh
- [ ] Creating map includes imported content

### Duplicate Names
- [ ] Creating map with existing name auto-increments: "Name (1)"
- [ ] Incrementing finds next available number
- [ ] Response returns actual name used
- [ ] Works for both manual creation and import

### Validation
- [ ] Export file version is validated on import
- [ ] GridType must be valid
- [ ] Dimensions must be in valid range (5-100)
- [ ] Content schema is validated if present

## Verification Steps

### 1. Export Test

1. Open a map with terrain/paths/labels (hex) or walls/features (square)
2. Click menu → Export
3. File downloads with `.gygax.json` extension
4. Open file in text editor
5. Verify JSON structure matches spec
6. Verify all content is included

### 2. Import Test

1. Go to campaign page, click New Map
2. Select the exported `.gygax.json` file
3. Verify form pre-fills with map data
4. Verify grid type selector is disabled
5. Modify the name slightly
6. Click Create
7. Open new map
8. Verify all content matches original

### 3. Duplicate Name Test

1. Create a map named "Test Map"
2. Export it
3. Import it again
4. Verify created map is named "Test Map (1)"
5. Import again
6. Verify created map is named "Test Map (2)"

### 4. Invalid File Test

1. Open Create Map modal
2. Select a non-JSON file
3. Verify error toast appears
4. Select a JSON file without required fields
5. Verify error toast appears
6. Verify form remains empty/usable

### 5. Cross-Campaign Import Test

1. Export map from Campaign A
2. Go to Campaign B
3. Import the map
4. Verify map creates successfully in Campaign B

## Future Considerations

- **Batch export:** Export all maps in a campaign as a zip
- **Template library:** Curated map templates built into the app
- **Version migration:** Handle future MapContent version changes
- **Image export:** PNG/SVG export for printing or sharing

## References

- [Spec 005a: Map Foundation](/specs/005a-map-foundation.md)
- [Spec 005b: Wilderness Map Drawing](/specs/005b-map-drawing.md)
- [Spec 005c: Text Labels & Path Drawing](/specs/005c-map-labels-paths.md)
- [Spec 005d: Indoor/Dungeon Maps](/specs/005d-map-indoor.md)
