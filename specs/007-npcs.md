# Spec 007: DM NPC/Character Creation

## Goal

Allow DMs to create characters for use as NPCs in their Adventures. DM NPCs use the same character sheet format as player characters but are owned by the Adventure (not the User globally) and include a description field for DM reference notes.

## Scope

### In Scope

- NPC database model linked to Adventures (cascade delete)
- NPC CRUD API endpoints with avatar upload
- Reuse CharacterSheet component from Spec 006
- NPC section in Adventure detail page (following Maps pattern)
- NPC detail page at `/adventures/:adventureId/npcs/:npcId`
- NPCCard component (following CharacterCard pattern)
- Export NPC to JSON file (`.npc.gygax.json`)
- Import NPC from JSON file during creation

### Out of Scope

- NPC AI behavior
- NPC token placement on maps (future spec)
- Monster/creature stat blocks (different from character sheets)
- Bestiary system (future spec)

## Dependencies

**Builds on:**
- Spec 004: Adventures (NPCs belong to Adventures)
- Spec 006: Characters (reuse CharacterSheet component)

## Design Decisions

### 1. Separate NPC Model (not reuse Character)
- **Rationale:** Different ownership model (Adventure vs User)
- NPCs cascade delete when Adventure is deleted
- Character stays as player-owned entity
- Cleaner separation of concerns

### 2. Optional Fields
- Unlike Characters which require name and class, NPCs only require name
- Class, stats, saves can all be null (sparse NPCs are valid)
- Allows quick "placeholder" NPCs that get fleshed out later

### 3. Description Field
- New field not on Character: `description`
- DM reference for who this NPC is, their role, personality
- Not visible to players (future consideration)

### 4. Route Structure
- List NPCs: `GET /api/adventures/:adventureId/npcs` (scoped to adventure)
- Single NPC operations: `GET/PATCH/DELETE /api/npcs/:id` (simpler routes)
- Mirrors how Maps work (listed under adventure, operated on directly)

---

## Database Schema

```prisma
model NPC {
  id               String   @id @default(cuid())
  name             String
  description      String?  // DM reference: who is this NPC, role, personality

  class            String?  // Optional: Fighter, Magic-User, Cleric, etc.
  level            Int      @default(1)
  alignment        String?  // Lawful, Neutral, Chaotic
  title            String?  // Class-specific title

  // Ability Scores (all optional, default null)
  strength         Int?
  intelligence     Int?
  wisdom           Int?
  dexterity        Int?
  constitution     Int?
  charisma         Int?

  // Combat
  hitPointsMax     Int?
  hitPointsCurrent Int?
  armorClass       Int?

  // Saving Throws (all optional)
  saveDeathRay     Int?
  saveWands        Int?
  saveParalysis    Int?
  saveBreath       Int?
  saveSpells       Int?

  // Resources (optional for NPCs)
  experiencePoints Int?
  goldPieces       Int?

  // Freeform text fields
  equipment        String?
  spells           String?
  notes            String?

  // Avatar
  avatarUrl        String?

  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  adventureId      String
  adventure        Adventure @relation(fields: [adventureId], references: [id], onDelete: Cascade)

  @@index([adventureId])
  @@map("npcs")
}
```

**Key differences from Character:**
- `adventureId` instead of `ownerId` (belongs to Adventure, not User)
- `description` field added
- `class` is optional (String? not String)
- All ability scores, saves, and resources are optional (nullable)
- Cascade delete on Adventure deletion

**Adventure model update:**
```prisma
model Adventure {
  // ... existing fields ...
  npcs       NPC[]
}
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/adventures/:adventureId/npcs` | List NPCs in adventure |
| `POST` | `/api/adventures/:adventureId/npcs` | Create NPC |
| `GET` | `/api/npcs/:id` | Get single NPC |
| `PATCH` | `/api/npcs/:id` | Update NPC |
| `DELETE` | `/api/npcs/:id` | Delete NPC |
| `POST` | `/api/npcs/:id/avatar` | Upload avatar image |
| `DELETE` | `/api/npcs/:id/avatar` | Remove avatar |

### Request/Response Examples

**POST /api/adventures/:adventureId/npcs**

Minimal request (only name required):
```json
{
  "name": "Old Grimshaw"
}
```

Full request:
```json
{
  "name": "Old Grimshaw",
  "description": "Grumpy tavern keeper in Threshold. Knows everyone's secrets.",
  "class": "Fighter",
  "level": 3,
  "alignment": "Neutral",
  "strength": 12,
  "intelligence": 14,
  "wisdom": 10,
  "dexterity": 9,
  "constitution": 13,
  "charisma": 8
}
```

**Response (201 Created)**
```json
{
  "npc": {
    "id": "clxxx...",
    "name": "Old Grimshaw",
    "description": "Grumpy tavern keeper in Threshold. Knows everyone's secrets.",
    "class": "Fighter",
    "level": 3,
    "alignment": "Neutral",
    "title": null,
    "strength": 12,
    "intelligence": 14,
    "wisdom": 10,
    "dexterity": 9,
    "constitution": 13,
    "charisma": 8,
    "hitPointsMax": null,
    "hitPointsCurrent": null,
    "armorClass": null,
    "saveDeathRay": null,
    "saveWands": null,
    "saveParalysis": null,
    "saveBreath": null,
    "saveSpells": null,
    "experiencePoints": null,
    "goldPieces": null,
    "equipment": null,
    "spells": null,
    "notes": null,
    "avatarUrl": null,
    "adventureId": "clyyy...",
    "createdAt": "2026-01-26T...",
    "updatedAt": "2026-01-26T..."
  }
}
```

**GET /api/adventures/:adventureId/npcs**
```json
{
  "npcs": [
    {
      "id": "clxxx...",
      "name": "Old Grimshaw",
      "description": "Grumpy tavern keeper in Threshold.",
      "class": "Fighter",
      "level": 3,
      "avatarUrl": null,
      "adventureId": "clyyy...",
      "createdAt": "2026-01-26T...",
      "updatedAt": "2026-01-26T..."
    }
  ]
}
```
*Note: List response returns abbreviated NPC data (no stats). Full data via GET /api/npcs/:id*

**PATCH /api/npcs/:id**
```json
{
  "hitPointsMax": 15,
  "hitPointsCurrent": 15,
  "armorClass": 5,
  "equipment": "Chain mail, longsword, dagger\n50 gp hidden under floorboards"
}
```

**Response (200 OK)**
```json
{
  "npc": { /* full NPC object with updated fields */ }
}
```

### Authorization

All NPC endpoints require:
1. User is authenticated
2. User owns the Adventure containing the NPC

For routes with `:adventureId`:
- Verify user owns the adventure

For routes with `:id` (NPC ID):
- Fetch NPC, get its adventureId, verify user owns that adventure

---

## Type Definitions

Add to `shared/src/types.ts`:

```typescript
// NPC types (DM-owned characters in Adventures)
export interface NPC {
  id: string
  name: string
  description: string | null

  class: string | null  // Optional unlike Character
  level: number
  alignment: Alignment | null
  title: string | null

  // Ability Scores (all optional)
  strength: number | null
  intelligence: number | null
  wisdom: number | null
  dexterity: number | null
  constitution: number | null
  charisma: number | null

  // Combat
  hitPointsMax: number | null
  hitPointsCurrent: number | null
  armorClass: number | null

  // Saving Throws
  saveDeathRay: number | null
  saveWands: number | null
  saveParalysis: number | null
  saveBreath: number | null
  saveSpells: number | null

  // Resources
  experiencePoints: number | null
  goldPieces: number | null

  // Freeform text
  equipment: string | null
  spells: string | null
  notes: string | null

  // Avatar
  avatarUrl: string | null

  adventureId: string
  createdAt: string
  updatedAt: string
}

// Abbreviated NPC for list views
export interface NPCListItem {
  id: string
  name: string
  description: string | null
  class: string | null
  level: number
  avatarUrl: string | null
  adventureId: string
  createdAt: string
  updatedAt: string
}

export interface NPCListResponse {
  npcs: NPCListItem[]
}

export interface NPCResponse {
  npc: NPC
}

export interface CreateNPCRequest {
  name: string
  description?: string
  class?: string
  level?: number
  alignment?: Alignment
  title?: string
  strength?: number
  intelligence?: number
  wisdom?: number
  dexterity?: number
  constitution?: number
  charisma?: number
  // Extended fields for import support
  hitPointsMax?: number
  hitPointsCurrent?: number
  armorClass?: number
  saveDeathRay?: number
  saveWands?: number
  saveParalysis?: number
  saveBreath?: number
  saveSpells?: number
  experiencePoints?: number
  goldPieces?: number
  equipment?: string
  spells?: string
  notes?: string
}

export interface UpdateNPCRequest {
  name?: string
  description?: string | null
  class?: string | null
  level?: number
  alignment?: Alignment | null
  title?: string | null
  strength?: number | null
  intelligence?: number | null
  wisdom?: number | null
  dexterity?: number | null
  constitution?: number | null
  charisma?: number | null
  hitPointsMax?: number | null
  hitPointsCurrent?: number | null
  armorClass?: number | null
  saveDeathRay?: number | null
  saveWands?: number | null
  saveParalysis?: number | null
  saveBreath?: number | null
  saveSpells?: number | null
  experiencePoints?: number | null
  goldPieces?: number | null
  equipment?: string | null
  spells?: string | null
  notes?: string | null
}
```

---

## Client Components

### 1. NPCCard
Reuses pattern from CharacterCard with slight modifications:
- Portrait card style (2:3 aspect ratio)
- Shows avatar or placeholder icon
- Displays: Name, Class (if set), Level
- Shows description snippet below name
- Menu: Edit, Delete
- Click navigates to NPC detail page

### 2. NPCPage
Detail page at `/adventures/:adventureId/npcs/:npcId`:
- Reuses CharacterSheet component
- Header with back navigation to Adventure page
- Full editing experience
- Avatar upload
- Description field at top (not in CharacterSheet, added in NPCPage)

### 3. CreateNPCModal
Simpler than CreateCharacterModal:
- Name input (required)
- Description textarea (optional)
- Class dropdown (optional)
- No ability score rolling (fill in on sheet later)
- Quick creation for placeholder NPCs

### 4. DeleteNPCDialog
- Confirmation with NPC name
- Warning about permanent deletion

### 5. AdventurePage Updates
Add NPCs section following Maps pattern:
```
MAPS                              [+ New Map]
[Map cards...]

NPCs                              [+ New NPC]
[NPC cards in portrait 2:3 ratio...]
```

---

## Routing

Add to `client/src/App.tsx`:
```typescript
<Route path="/adventures/:adventureId/npcs/:npcId" element={<NPCPage />} />
```

---

## CharacterSheet Reuse

The existing CharacterSheet component needs minor adaptation:
1. Accept either `Character` or `NPC` data (union type or shared base)
2. Handle null values for optional fields (display as empty/placeholder)
3. Class field becomes optional dropdown (can be unset)
4. Consider adding `isNPC` prop for any NPC-specific display tweaks

The sheet displays identically for both - all B/X fields are relevant for NPCs.

---

## NPC Import/Export

Enable DMs to save NPCs to local JSON files and import them into any Adventure. This allows reusing NPCs across Adventures and sharing with other DMs.

### Export File Format

**File naming:** `{npc-name}.npc.gygax.json`

**File structure:**

```typescript
interface NPCExportFile {
  version: 1
  exportedAt: string  // ISO 8601 timestamp
  npc: {
    name: string
    description: string | null
    class: string | null
    level: number
    alignment: string | null
    title: string | null
    strength: number | null
    intelligence: number | null
    wisdom: number | null
    dexterity: number | null
    constitution: number | null
    charisma: number | null
    hitPointsMax: number | null
    hitPointsCurrent: number | null
    armorClass: number | null
    saveDeathRay: number | null
    saveWands: number | null
    saveParalysis: number | null
    saveBreath: number | null
    saveSpells: number | null
    experiencePoints: number | null
    goldPieces: number | null
    equipment: string | null
    spells: string | null
    notes: string | null
    // avatarUrl intentionally excluded - not portable
  }
}
```

**Example:**
```json
{
  "version": 1,
  "exportedAt": "2026-01-26T12:00:00.000Z",
  "npc": {
    "name": "Bargle the Infamous",
    "description": "Evil magic-user terrorizing the region. Former apprentice turned villain.",
    "class": "Magic-User",
    "level": 5,
    "alignment": "Chaotic",
    "title": null,
    "strength": 9,
    "intelligence": 16,
    "wisdom": 12,
    "dexterity": 14,
    "constitution": 10,
    "charisma": 11,
    "hitPointsMax": 12,
    "hitPointsCurrent": 12,
    "armorClass": 9,
    "saveDeathRay": 13,
    "saveWands": 14,
    "saveParalysis": 13,
    "saveBreath": 16,
    "saveSpells": 15,
    "experiencePoints": null,
    "goldPieces": 500,
    "equipment": "Dagger, spell components\nRing of protection +1\n200 gp in hidden pouch",
    "spells": "Magic Missile, Sleep, Web, Mirror Image, Fireball",
    "notes": "Hates the party after they foiled his plans in Threshold"
  }
}
```

### Export Flow

**Trigger:** Menu option on NPC card and NPC detail page

**Menu structure (NPCCard):**
```
[···]
├── Edit
├── Export
└── Delete
```

**Behavior:**
1. User clicks "Export" in NPC menu
2. Browser downloads `{npc-name}.npc.gygax.json`
3. Toast confirmation: "NPC exported"

**Note:** Avatar is not exported (not portable between systems). User must re-upload avatar after import.

### Import Flow

**Trigger:** Optional file input in Create NPC modal

**Updated Create NPC Modal:**
```
┌────────────────────────────────────────────┐
│  CREATE NPC                            ✕   │
│  ═══════════════════════════════════════   │
│                                            │
│  IMPORT FROM FILE (optional)               │
│  ┌────────────────────────────────────┐    │
│  │  [Choose File]  No file selected   │    │
│  └────────────────────────────────────┘    │
│  Import a .npc.gygax.json file             │
│                                            │
│  ────────────── or ──────────────          │
│                                            │
│  NAME *                                    │
│  ┌────────────────────────────────────┐    │
│  │                                    │    │
│  └────────────────────────────────────┘    │
│                                            │
│  DESCRIPTION                               │
│  ┌────────────────────────────────────┐    │
│  │                                    │    │
│  └────────────────────────────────────┘    │
│                                            │
│  CLASS (optional)                          │
│  ┌────────────────────────────────────┐    │
│  │  Select class...               ▾   │    │
│  └────────────────────────────────────┘    │
│                                            │
│              [Cancel]  [CREATE]            │
└────────────────────────────────────────────┘
```

**Behavior:**
1. User opens Create NPC modal
2. User selects a `.npc.gygax.json` file via file input
3. File is parsed and validated
4. Form fields are pre-filled with imported data (name, description, class)
5. User can still edit fields before creating
6. On submit, NPC is created with all imported stats/data
7. Clear button allows removing the import and starting fresh

**File Validation:**
- Must be valid JSON
- Must have `version: 1`
- Must have valid `npc` object with `name` (required)
- Invalid file shows error toast

### Duplicate Name Handling

Unlike maps, NPC names don't need to be unique within an Adventure. Multiple NPCs can have the same name (e.g., "Guard", "Villager"). No auto-incrementing needed.

### Type Definitions

Add to `shared/src/types.ts`:

```typescript
// NPC export file format
export interface NPCExportFile {
  version: 1
  exportedAt: string
  npc: {
    name: string
    description: string | null
    class: string | null
    level: number
    alignment: string | null
    title: string | null
    strength: number | null
    intelligence: number | null
    wisdom: number | null
    dexterity: number | null
    constitution: number | null
    charisma: number | null
    hitPointsMax: number | null
    hitPointsCurrent: number | null
    armorClass: number | null
    saveDeathRay: number | null
    saveWands: number | null
    saveParalysis: number | null
    saveBreath: number | null
    saveSpells: number | null
    experiencePoints: number | null
    goldPieces: number | null
    equipment: string | null
    spells: string | null
    notes: string | null
  }
}
```

### Implementation

**Client-side export (no API needed):**

```typescript
function exportNPC(npc: NPC) {
  const exportData: NPCExportFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    npc: {
      name: npc.name,
      description: npc.description,
      class: npc.class,
      level: npc.level,
      alignment: npc.alignment,
      title: npc.title,
      strength: npc.strength,
      intelligence: npc.intelligence,
      wisdom: npc.wisdom,
      dexterity: npc.dexterity,
      constitution: npc.constitution,
      charisma: npc.charisma,
      hitPointsMax: npc.hitPointsMax,
      hitPointsCurrent: npc.hitPointsCurrent,
      armorClass: npc.armorClass,
      saveDeathRay: npc.saveDeathRay,
      saveWands: npc.saveWands,
      saveParalysis: npc.saveParalysis,
      saveBreath: npc.saveBreath,
      saveSpells: npc.saveSpells,
      experiencePoints: npc.experiencePoints,
      goldPieces: npc.goldPieces,
      equipment: npc.equipment,
      spells: npc.spells,
      notes: npc.notes,
      // avatarUrl intentionally excluded
    }
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json'
  })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeFilename(npc.name)}.npc.gygax.json`
  a.click()

  URL.revokeObjectURL(url)
}
```

**Client-side import (file parsing):**

```typescript
async function parseNPCFile(file: File): Promise<NPCExportFile['npc']> {
  const text = await file.text()
  const data = JSON.parse(text)

  if (data.version !== 1) {
    throw new Error('Unsupported file version')
  }
  if (!data.npc?.name) {
    throw new Error('Invalid NPC file: missing name')
  }

  return data.npc
}
```

**API update - CreateNPCRequest extended:**

The existing `CreateNPCRequest` already supports all the fields needed for import. When importing, the client sends all the NPC data (not just name/description/class) to create a fully-populated NPC.

---

## Files to Create

| File | Description |
|------|-------------|
| `prisma/migrations/XXXXXX_007_npcs/migration.sql` | Database migration |
| `server/src/routes/npcs.ts` | NPC CRUD API |
| `client/src/pages/NPCPage.tsx` | NPC detail/edit page |
| `client/src/components/NPCCard.tsx` | Adventure page card |
| `client/src/components/CreateNPCModal.tsx` | Creation modal with import |
| `client/src/components/DeleteNPCDialog.tsx` | Delete confirmation |
| `client/src/utils/npcExport.ts` | Export/import helper functions |

## Files to Modify

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add NPC model, update Adventure relation |
| `shared/src/types.ts` | Add NPC types |
| `server/src/app.ts` | Register NPC routes |
| `client/src/pages/AdventurePage.tsx` | Add NPCs section |
| `client/src/App.tsx` | Add NPC route |
| `client/src/pages/index.tsx` | Export NPCPage |
| `client/src/components/index.ts` | Export NPC components |
| `client/src/components/CharacterSheet.tsx` | Handle NPC data (nullable fields) |

---

## Implementation Phases

### Phase 1: Database & Types
- Add NPC model to Prisma schema
- Add relation to Adventure model
- Create and apply migration
- Add TypeScript types to shared package

### Phase 2: API
- Implement CRUD routes in `npcs.ts`
- List NPCs for adventure
- Create, read, update, delete NPC
- Avatar upload/delete endpoints
- Register routes in app.ts

### Phase 3: Adventure Page Integration
- NPCCard component
- CreateNPCModal (simple: name + description)
- DeleteNPCDialog
- Add NPCs section to AdventurePage

### Phase 4: NPC Detail Page
- NPCPage with CharacterSheet
- Update CharacterSheet to handle NPC data (nullable fields)
- Description field editing
- Avatar upload integration
- Back navigation to Adventure

### Phase 5: Import/Export
- `npcExport.ts` utility functions
- Export menu option on NPCCard and NPCPage
- File input in CreateNPCModal
- Import validation and error handling
- Toast notifications for export/import

---

## Acceptance Criteria

### CRUD Operations
- [ ] DM can create an NPC with just a name
- [ ] DM can create an NPC with full details (name, description, class, stats)
- [ ] DM can view list of NPCs in Adventure page
- [ ] DM can click NPC card to view full details
- [ ] DM can edit all NPC fields inline on detail page
- [ ] DM can delete an NPC with confirmation
- [ ] Changes persist on page refresh

### Avatar
- [ ] DM can upload avatar image for NPC
- [ ] Avatar displays in NPC card and detail page
- [ ] DM can remove avatar

### UI/UX
- [ ] NPCs section appears in Adventure page (below Maps)
- [ ] NPC cards display name, class (if set), level, description snippet
- [ ] NPC detail page uses same CharacterSheet component as characters
- [ ] Description field editable at top of NPC detail page
- [ ] B/X aesthetic consistent with rest of application

### Authorization
- [ ] Only adventure owner can view adventure's NPCs
- [ ] Only adventure owner can create/edit/delete NPCs
- [ ] Unauthenticated users cannot access NPC endpoints
- [ ] Users cannot access NPCs in adventures they don't own

### Data Integrity
- [ ] NPCs deleted when Adventure is deleted (cascade)
- [ ] NPC adventureId cannot be changed after creation
- [ ] All optional fields can be null/empty

### Import/Export
- [ ] Export option appears in NPC card menu and detail page
- [ ] Clicking Export downloads `.npc.gygax.json` file
- [ ] File contains all NPC data (stats, saves, equipment, notes)
- [ ] File does NOT contain avatarUrl (not portable)
- [ ] File input appears in Create NPC modal
- [ ] Selecting valid file pre-fills form fields
- [ ] Invalid file shows error toast
- [ ] User can clear import and start fresh
- [ ] Creating NPC from import includes all imported stats
- [ ] Importing same NPC into different Adventure works

---

## Verification Steps

### API Tests (curl)

```bash
# Create NPC (minimal)
curl -X POST http://localhost:3000/api/adventures/{adventureId}/npcs \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"name": "Test NPC"}'

# Create NPC (full)
curl -X POST http://localhost:3000/api/adventures/{adventureId}/npcs \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{
    "name": "Bargle the Infamous",
    "description": "Evil magic-user terrorizing the region",
    "class": "Magic-User",
    "level": 5,
    "intelligence": 16
  }'

# List NPCs
curl http://localhost:3000/api/adventures/{adventureId}/npcs \
  -H "Cookie: session=..."

# Get single NPC
curl http://localhost:3000/api/npcs/{npcId} \
  -H "Cookie: session=..."

# Update NPC
curl -X PATCH http://localhost:3000/api/npcs/{npcId} \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"hitPointsMax": 20, "armorClass": 7}'

# Delete NPC
curl -X DELETE http://localhost:3000/api/npcs/{npcId} \
  -H "Cookie: session=..."
```

### Client Flow Tests

1. **Create NPC** → Navigate to Adventure → Click "+ New NPC" → Fill name → Submit → NPC card appears
2. **View NPC** → Click NPC card → Detail page loads with CharacterSheet
3. **Edit NPC** → Change stats on sheet → Values save → Persist on refresh
4. **Upload Avatar** → Click avatar area → Select image → Displays in card and sheet
5. **Delete NPC** → Click menu → Delete → Confirm → NPC removed from list

### Authorization Tests

1. **Unauthenticated** → API returns 401
2. **Wrong user** → API returns 404 (not 403, to avoid leaking existence)
3. **Adventure owner** → Full access to all operations

### Cascade Delete Test

1. Create Adventure with NPCs
2. Delete Adventure
3. Verify NPCs are deleted (query by ID returns 404)

### Export Test

1. Create an NPC with full stats (abilities, saves, equipment, spells, notes)
2. Click menu → Export on NPC card
3. File downloads with `.npc.gygax.json` extension
4. Open file in text editor
5. Verify JSON structure matches spec
6. Verify all stats included, avatarUrl excluded

### Import Test

1. Go to Adventure page, click "+ New NPC"
2. Select the exported `.npc.gygax.json` file
3. Verify form pre-fills with NPC name, description, class
4. Click Create
5. Open new NPC detail page
6. Verify all stats match original (abilities, saves, equipment, etc.)

### Cross-Adventure Import Test

1. Export NPC from Adventure A
2. Go to Adventure B
3. Import the NPC
4. Verify NPC creates successfully with all data
5. Original NPC in Adventure A is unchanged

### Invalid Import File Test

1. Open Create NPC modal
2. Select a non-JSON file → error toast
3. Select a JSON file without `npc.name` → error toast
4. Select a map `.gygax.json` file → error toast (wrong format)
5. Verify form remains empty/usable

---

## References

- [PRD: Key Concepts - DM](/prd.md#key-concepts)
- [PRD: MVP Features - Forge Mode NPCs](/prd.md#forge-mode---npcs)
- [Spec 004: Adventures](/specs/004-adventures.md)
- [Spec 006: Characters](/specs/006-characters.md)
