# Spec 007: DM NPC/Character Creation

## Goal

Allow DMs to create characters for use as NPCs in their Adventures. DM NPCs use the same character sheet format as player characters but are owned by the DM and associated with Adventures rather than being global player characters.

## Scope

### In Scope

- NPC database model linked to Adventures
- NPC CRUD API endpoints
- Reuse character sheet component from Spec 006
- NPC management within Adventure workspace (Forge mode)
- NPC list view in Adventure detail page

### Out of Scope

- NPC AI behavior
- NPC token placement on maps (future spec)
- NPC stat blocks (different from character sheets)
- Monster/creature entries (future bestiary spec)

## Dependencies

**Builds on:**
- Spec 004: Adventures (NPCs belong to Adventures)
- Spec 006: Characters (reuse character sheet component)

## Detailed Requirements

*To be detailed during implementation planning.*

### 1. Database Schema

**NPC Model (prisma/schema.prisma):**

```prisma
model NPC {
  id          String   @id @default(cuid())
  name        String
  description String?  // Brief description for DM reference

  // Character stats (same as Character model)
  class       String?
  level       Int      @default(1)
  alignment   String?

  strength     Int?
  intelligence Int?
  wisdom       Int?
  dexterity    Int?
  constitution Int?
  charisma     Int?

  hitPoints       Int?
  maxHitPoints    Int?
  armorClass      Int?

  saveDeathRay    Int?
  saveWands       Int?
  saveParalysis   Int?
  saveBreath      Int?
  saveSpells      Int?

  equipment   Json?
  spells      Json?
  notes       String?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  adventureId String
  adventure   Adventure @relation(fields: [adventureId], references: [id], onDelete: Cascade)

  @@map("npcs")
}
```

### 2. API Endpoints

- `GET /api/adventures/:adventureId/npcs` - List NPCs in Adventure
- `POST /api/adventures/:adventureId/npcs` - Create NPC
- `GET /api/adventures/:adventureId/npcs/:id` - Get NPC details
- `PATCH /api/adventures/:adventureId/npcs/:id` - Update NPC
- `DELETE /api/adventures/:adventureId/npcs/:id` - Delete NPC

### 3. Client Implementation

- NPC section in Adventure detail page
- NPC list component
- Reuse CharacterSheet component for NPC editing
- Create NPC modal/page

## Acceptance Criteria

*To be detailed during implementation planning.*

- [ ] DM can navigate to NPCs section in Adventure
- [ ] DM can create a new NPC
- [ ] NPC uses same character sheet UI as player characters
- [ ] NPC stats are optional (can be sparse)
- [ ] DM can edit and save NPC changes
- [ ] DM can delete an NPC
- [ ] NPCs appear in Adventure detail page

## References

- [PRD: Key Concepts - DM](/prd.md#key-concepts)
- [PRD: MVP Features - Forge Mode NPCs](/prd.md#forge-mode---npcs)
- [Spec 004: Adventures](/specs/004-adventures.md)
- [Spec 006: Characters](/specs/006-characters.md)
