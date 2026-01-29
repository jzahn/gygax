# Spec 006: Player Character Creation

## Goal

Implement B/X-style player character creation and management. Characters are global entities owned by players, not tied to specific adventures or campaigns. Players can create multiple characters and select which one to play when joining any session.

## Scope

### In Scope

- Character database model linked to users (players)
- Character CRUD API endpoints with avatar upload
- B/X-style character sheet UI (matching Moldvay rulebook)
- Character creation with multiple ability score rolling methods
- Dashboard integration showing user's characters
- All B/X character fields (abilities, saves, equipment, spells, etc.)

### Out of Scope

- Character selection when joining sessions (requires Spec 011)
- Auto-calculation of derived stats beyond modifiers
- Character import/export
- Character sheet printing
- Multi-classing (B/X doesn't have it anyway)
- Spell slot tracking automation
- Encumbrance calculations

## Dependencies

**Builds on:**
- Spec 002: Authentication (user context, protected routes)
- Spec 003: Email verification (verified users only)
- Spec 004/005: UI patterns from Adventures/Campaigns

## PRD Requirements

- **Req 25:** Players can create characters in the Adventure section
- **Req 26:** Characters displayed on B/X-style character sheets (Moldvay Basic)
- **Req 27:** Players can create multiple characters, choose which to play when joining
- **Req 82:** Players can input character name and avatar image

---

## B/X Character Sheet Fields

### Identity
| Field | Type | Required | Default | Notes |
|-------|------|----------|---------|-------|
| Name | String | Yes | - | Max 100 chars |
| Class | Enum | Yes | - | Fighter, Magic-User, Cleric, Thief, Elf, Dwarf, Halfling |
| Level | Int | Yes | 1 | Range 1-14 |
| Alignment | Enum | No | - | Lawful, Neutral, Chaotic |
| Title | String | No | - | Class-specific titles (e.g., "Veteran", "Medium") |

### Ability Scores (3-18 each)
| Score Range | Modifier |
|-------------|----------|
| 3 | -3 |
| 4-5 | -2 |
| 6-8 | -1 |
| 9-12 | 0 |
| 13-15 | +1 |
| 16-17 | +2 |
| 18 | +3 |

**Abilities:** STR, INT, WIS, DEX, CON, CHA

### Combat Stats
| Field | Default | Notes |
|-------|---------|-------|
| HP (Current) | 1 | Editable |
| HP (Max) | 1 | Editable |
| Armor Class | 9 | Unarmored AC in B/X (descending) |

**THAC0** - Derived client-side from class and level (not stored)

### Saving Throws
| Save | Default | Notes |
|------|---------|-------|
| Death Ray/Poison | 14 | Varies by class/level |
| Magic Wands | 15 | |
| Paralysis/Turn to Stone | 16 | |
| Dragon Breath | 17 | |
| Rods/Staves/Spells | 17 | |

### Resources
| Field | Default |
|-------|---------|
| Experience Points | 0 |
| Gold Pieces | 0 |

### Freeform Fields
| Field | Type | Notes |
|-------|------|-------|
| Equipment | Text | Player-written equipment list |
| Spells | Text | Player-written spells (for casters) |
| Notes | Text | General notes |
| Avatar | Image | Optional uploaded image |

---

## Database Schema

```prisma
model Character {
  id              String   @id @default(cuid())
  name            String
  class           String   // Fighter, Magic-User, Cleric, Thief, Elf, Dwarf, Halfling
  level           Int      @default(1)
  alignment       String?  // Lawful, Neutral, Chaotic
  title           String?  // Class-specific title

  // Ability Scores (3-18)
  strength        Int      @default(10)
  intelligence    Int      @default(10)
  wisdom          Int      @default(10)
  dexterity       Int      @default(10)
  constitution    Int      @default(10)
  charisma        Int      @default(10)

  // Combat
  hitPointsMax    Int      @default(1)
  hitPointsCurrent Int     @default(1)
  armorClass      Int      @default(9)  // Unarmored AC in B/X

  // Saving Throws
  saveDeathRay    Int      @default(14)
  saveWands       Int      @default(15)
  saveParalysis   Int      @default(16)
  saveBreath      Int      @default(17)
  saveSpells      Int      @default(17)

  // Resources
  experiencePoints Int     @default(0)
  goldPieces      Int      @default(0)

  // Freeform text fields
  equipment       String?  // Player-written equipment list
  spells          String?  // Player-written spell list

  // Optional
  avatarUrl       String?
  notes           String?

  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  ownerId         String
  owner           User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  @@index([ownerId])
  @@map("characters")
}
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/characters` | List user's characters |
| `POST` | `/api/characters` | Create character |
| `GET` | `/api/characters/:id` | Get single character |
| `PATCH` | `/api/characters/:id` | Update character |
| `DELETE` | `/api/characters/:id` | Delete character |
| `POST` | `/api/characters/:id/avatar` | Upload avatar image |
| `DELETE` | `/api/characters/:id/avatar` | Remove avatar |

### Request/Response Examples

**POST /api/characters**
```json
{
  "name": "Theron the Bold",
  "class": "Fighter",
  "strength": 16,
  "intelligence": 10,
  "wisdom": 12,
  "dexterity": 14,
  "constitution": 15,
  "charisma": 9
}
```

**Response**
```json
{
  "character": {
    "id": "clxxx...",
    "name": "Theron the Bold",
    "class": "Fighter",
    "level": 1,
    "alignment": null,
    "title": null,
    "strength": 16,
    "intelligence": 10,
    "wisdom": 12,
    "dexterity": 14,
    "constitution": 15,
    "charisma": 9,
    "hitPointsMax": 1,
    "hitPointsCurrent": 1,
    "armorClass": 9,
    "saveDeathRay": 14,
    "saveWands": 15,
    "saveParalysis": 16,
    "saveBreath": 17,
    "saveSpells": 17,
    "experiencePoints": 0,
    "goldPieces": 0,
    "equipment": null,
    "spells": null,
    "avatarUrl": null,
    "notes": null,
    "createdAt": "2026-01-26T...",
    "updatedAt": "2026-01-26T..."
  }
}
```

---

## UI Components

### 1. CharacterCard
- Portrait card style (like AdventureCard, 2:3 aspect ratio)
- Shows avatar or class-based placeholder icon
- Displays: Name, Class, Level
- Menu: Edit, Delete
- Click navigates to character sheet

### 2. CharacterSheet
- Single scrolling page layout (like a real paper sheet)
- B/X aesthetic matching Moldvay Basic rulebook
- **Sections:**
  - Header: Name, Class, Level, Alignment, Title
  - Ability Scores: 6 boxes in a row with auto-calculated modifiers
  - Combat: HP (current/max), AC, THAC0 (derived)
  - Saving Throws: 5 labeled value boxes
  - Resources: XP, GP
  - Equipment: Multi-line text area
  - Spells: Multi-line text area (for casters)
  - Notes: Multi-line text area

### 3. CreateCharacterModal
- Name input (required)
- Class dropdown (required)
- Ability score entry with three methods:
  - Manual entry (type values 3-18)
  - "Roll 3d6" button (classic B/X method)
  - "Roll 4d6 drop lowest" button (common house rule)
- Other fields can be filled after creation on the sheet

### 4. DeleteCharacterDialog
- Confirmation with character name
- Warning about permanent deletion

### 5. Dashboard Characters Section
- Appears first on dashboard (above campaigns/adventures)
- Grid of CharacterCards (3 columns like adventures)
- "+ New Character" button
- Divider separating from realms section below

---

## Dashboard Layout

```
YOUR CHARACTERS                      [+ New Character]
[Character cards in portrait 2:3 ratio...]

────────────────────────────────────────────────────

YOUR REALMS                          [+ New Campaign]

CAMPAIGNS
[Campaign cards in landscape 3:2 ratio...]

────────────────────────────────────────────────────

STANDALONE ADVENTURES                [+ New Adventure]
[Adventure cards in portrait 2:3 ratio...]
```

---

## Design Decisions

1. **Ability Score Entry**: Support all three methods:
   - Manual entry (type values 3-18)
   - "Roll 3d6" button (classic B/X method)
   - "Roll 4d6 drop lowest" button (common house rule)

2. **Equipment & Spells**: Freeform text entry (simplest approach, players type manually)

3. **Character Sheet Layout**: Single scrolling page - all sections visible, scroll to navigate (like a real paper sheet)

4. **THAC0**: Calculated client-side from class/level tables, not stored in database

5. **Modifiers**: Calculated client-side from ability scores, not stored

---

## B/X Aesthetic Guidelines

Following the design system from Spec 002:

- **Typography:** `font-display` (typewriter) for labels, `font-body` for values
- **Borders:** `border-3 border-ink`, no rounded corners
- **Background:** `paper-texture` class, parchment colors
- **Boxes:** Rectangular stat boxes with thick black borders
- **Write-in areas:** Hand-ruled line aesthetic using border-bottom
- **Checkboxes:** Square checkbox style for tracking consumables

---

## Files to Create

| File | Description |
|------|-------------|
| `prisma/migrations/XXXXXX_006_characters/migration.sql` | Database migration |
| `server/src/routes/characters.ts` | Character CRUD API |
| `client/src/pages/CharacterPage.tsx` | Character sheet view/edit page |
| `client/src/components/CharacterCard.tsx` | Dashboard card component |
| `client/src/components/CharacterSheet.tsx` | Full sheet display/edit |
| `client/src/components/CreateCharacterModal.tsx` | Creation modal |
| `client/src/components/DeleteCharacterDialog.tsx` | Delete confirmation |
| `client/src/utils/bxRules.ts` | B/X utility functions |

## Files to Modify

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add Character model |
| `shared/src/types.ts` | Add Character types |
| `server/src/app.ts` | Register character routes |
| `client/src/pages/DashboardPage.tsx` | Add Characters section |
| `client/src/App.tsx` | Add `/characters/:id` route |
| `client/src/pages/index.tsx` | Export CharacterPage |
| `client/src/components/index.ts` | Export character components |

---

## Implementation Phases

### Phase 1: Database & Types
- Add Character model to Prisma schema
- Create and apply migration
- Add TypeScript types to shared package

### Phase 2: API
- Implement CRUD routes in `characters.ts`
- Avatar upload/delete endpoints
- Register routes in app.ts

### Phase 3: Basic UI
- CharacterCard component
- CreateCharacterModal (name, class, ability scores)
- DeleteCharacterDialog
- Dashboard Characters section

### Phase 4: Character Sheet
- CharacterSheet component with B/X styling
- CharacterPage for viewing/editing
- Inline editing of all fields
- Avatar upload integration

### Phase 5: Polish
- `bxRules.ts` utility functions:
  - `getModifier(score)` - ability score to modifier
  - `roll3d6()` - classic B/X rolling
  - `roll4d6DropLowest()` - house rule variant
  - `getThac0(characterClass, level)` - THAC0 lookup
  - `getTitle(characterClass, level)` - class titles
- Roll buttons in character creation modal
- Modifier display next to ability scores
- THAC0 display in combat section

---

## Utility Functions (bxRules.ts)

```typescript
// Ability score to modifier
export function getModifier(score: number): number {
  if (score <= 3) return -3
  if (score <= 5) return -2
  if (score <= 8) return -1
  if (score <= 12) return 0
  if (score <= 15) return 1
  if (score <= 17) return 2
  return 3
}

// Roll 3d6 (classic)
export function roll3d6(): number {
  return Math.floor(Math.random() * 6) + 1 +
         Math.floor(Math.random() * 6) + 1 +
         Math.floor(Math.random() * 6) + 1
}

// Roll 4d6 drop lowest
export function roll4d6DropLowest(): number {
  const rolls = [
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
    Math.floor(Math.random() * 6) + 1,
  ]
  rolls.sort((a, b) => b - a)
  return rolls[0] + rolls[1] + rolls[2]
}

// THAC0 by class and level
export function getThac0(characterClass: string, level: number): number {
  // B/X THAC0 progression (simplified)
  // All classes start at 19, improve every few levels
  const baseThac0 = 19
  const improvement = Math.floor((level - 1) / 3)
  return Math.max(baseThac0 - (improvement * 2), 10)
}
```

---

## Acceptance Criteria

- [x] Create character with name, class, and ability scores
- [x] Roll ability scores with 3d6 or 4d6-drop-lowest buttons
- [x] View character in card format on dashboard
- [x] Click card to view full character sheet (single scrolling page)
- [x] Edit all character fields inline
- [x] Upload and display avatar image
- [x] Enter equipment as freeform text
- [x] Enter spells as freeform text
- [x] Delete character with confirmation
- [x] Ability modifiers auto-calculated and displayed
- [x] THAC0 calculated and displayed based on class/level
- [x] B/X aesthetic matches Moldvay rulebook feel

---

## Verification Steps

1. **Create character** → Navigate to dashboard, click "+ New Character", fill form, submit → Character appears in dashboard
2. **Roll abilities** → Click roll buttons → Values populate (3-18 range)
3. **View sheet** → Click character card → Full sheet page loads
4. **Edit fields** → Change any value → Saves automatically, persists on refresh
5. **Upload avatar** → Add image → Displays in card and sheet header
6. **Equipment/Spells** → Type text → Saves as multi-line text
7. **Delete** → Click delete in menu → Confirmation dialog → Character removed
8. **Visual check** → Sheet looks like classic B/X character sheet

---

## References

- [PRD: Key Concepts - Player](/prd.md#key-concepts)
- [PRD: Character Sheets](/prd.md#character-sheets)
- [PRD: Flow 5 - Player Creates Character](/prd.md#flow-5-player-creates-a-character)
- [PRD: MVP Features - Quest Mode](/prd.md#adventure-mode---characters)
- [Spec 002: Design System](/specs/002-auth.md#design-system-setup)
