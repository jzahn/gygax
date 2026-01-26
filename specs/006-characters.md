# Spec 006: Player Character Creation

## Goal

Implement player character creation with B/X-style character sheets matching the Moldvay Basic rulebook layout. Players can create characters in the Adventure section and select which character to play when joining a session.

## Scope

### In Scope

- Character database model linked to users (players)
- Character CRUD API endpoints
- B/X-style character sheet UI (matching Moldvay rulebook)
- Character creation flow in Adventure section
- Character selection when joining a session
- All B/X character fields (abilities, saves, equipment, etc.)

### Out of Scope

- Auto-calculation of stats (manual entry for MVP)
- Character import/export
- Character sheet printing
- Multi-classing (B/X doesn't have it anyway)
- Spell slot tracking automation

## Dependencies

**Builds on:**
- Spec 002: Authentication (user context, protected routes)
- Spec 003: Email verification (verified users only)

## Detailed Requirements

*To be detailed during implementation planning.*

### 1. Database Schema

**Character Model (prisma/schema.prisma):**

```prisma
model Character {
  id          String   @id @default(cuid())
  name        String
  class       String   // Fighter, Magic-User, Cleric, Thief, Elf, Dwarf, Halfling
  level       Int      @default(1)
  alignment   String   // Lawful, Neutral, Chaotic

  // Ability Scores
  strength     Int
  intelligence Int
  wisdom       Int
  dexterity    Int
  constitution Int
  charisma     Int

  // Combat Stats
  hitPoints       Int
  maxHitPoints    Int
  armorClass      Int
  attackBonus     Int?

  // Saving Throws
  saveDeathRay    Int
  saveWands       Int
  saveParalysis   Int
  saveBreath      Int
  saveSpells      Int

  // Progression
  experiencePoints Int @default(0)
  gold             Int @default(0)

  // Equipment & Spells stored as JSON
  equipment   Json?  // Array of items with encumbrance
  spells      Json?  // Known/prepared spells
  notes       String?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  ownerId     String
  owner       User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  @@map("characters")
}
```

### 2. API Endpoints

- `GET /api/characters` - List all characters owned by user
- `POST /api/characters` - Create new character
- `GET /api/characters/:id` - Get character details
- `PATCH /api/characters/:id` - Update character
- `DELETE /api/characters/:id` - Delete character

### 3. Client Implementation

- Adventure section navigation
- Character list page
- Character sheet component (B/X visual style)
- Create character flow
- Character selection in session join flow

### 4. Character Sheet Design

**Layout (matching B/X rulebook):**

- Rectangular boxes for each stat/field
- Hand-ruled lines for write-in areas
- Organized in classic arrangement
- Black border frames around sections

**Styling:**
- Typewriter font for labels
- Handwritten-style font for player values
- Checkbox squares for tracking
- Worn paper texture background

## Acceptance Criteria

*To be detailed during implementation planning.*

- [ ] Player can navigate to Adventure section
- [ ] Player can create a new character
- [ ] Character sheet matches B/X aesthetic
- [ ] All standard B/X fields are present
- [ ] Player can edit and save character changes
- [ ] Player can delete a character
- [ ] Player can view list of their characters
- [ ] Character selection appears when joining session

## References

- [PRD: Key Concepts - Player](/prd.md#key-concepts)
- [PRD: Character Sheets](/prd.md#character-sheets)
- [PRD: Flow 5 - Player Creates Character](/prd.md#flow-5-player-creates-a-character)
- [PRD: MVP Features - Adventure Mode](/prd.md#adventure-mode---characters)
