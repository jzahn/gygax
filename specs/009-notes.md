# Spec 009: DM Notes System

## Goal

Allow DMs to create and manage notes with title and content for organizing Adventure information. Notes provide a simple way for DMs to track story details, NPC information, plot hooks, and other adventure-related content.

## Scope

### In Scope

- Note database model linked to Adventures
- Note CRUD API endpoints
- Note management within Adventure workspace (Forge mode)
- Note list view in Adventure detail page
- Simple text content (no rich formatting in MVP)

### Out of Scope

- Rich text editing (bold, italic, lists, etc.)
- Note sharing with players
- Note linking or cross-references
- Note search
- Note categories or tags

## Dependencies

**Builds on:**
- Spec 004: Adventures (Notes belong to Adventures)

## Detailed Requirements

*To be detailed during implementation planning.*

### 1. Database Schema

**Note Model (prisma/schema.prisma):**

```prisma
model Note {
  id          String   @id @default(cuid())
  title       String
  content     String?  @db.Text
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  adventureId String
  adventure   Adventure @relation(fields: [adventureId], references: [id], onDelete: Cascade)

  @@map("notes")
}
```

### 2. API Endpoints

- `GET /api/adventures/:adventureId/notes` - List Notes in Adventure
- `POST /api/adventures/:adventureId/notes` - Create Note
- `GET /api/adventures/:adventureId/notes/:id` - Get Note details
- `PATCH /api/adventures/:adventureId/notes/:id` - Update Note
- `DELETE /api/adventures/:adventureId/notes/:id` - Delete Note

### 3. Client Implementation

- Notes section in Adventure detail page
- Note list component showing titles and preview
- Create/Edit Note modal or page
- Full note view with content

### 4. Design

**Note List:**
- List of note cards with title and content preview
- Most recently updated first
- Click to open full note

**Note Editor:**
- Title input field
- Large textarea for content
- Typewriter font for content (B/X aesthetic)
- Auto-save or explicit save button

## Acceptance Criteria

*To be detailed during implementation planning.*

- [ ] DM can navigate to Notes section in Adventure
- [ ] DM can create a new note with title and content
- [ ] Notes appear in list view with title and preview
- [ ] DM can edit note title and content
- [ ] DM can delete a note
- [ ] Notes are sorted by most recently updated
- [ ] Note styling matches B/X aesthetic

## References

- [PRD: Key Concepts - Notes](/prd.md#key-concepts)
- [PRD: MVP Features - Forge Mode Notes](/prd.md#forge-mode---notes)
- [Spec 004: Adventures](/specs/004-adventures.md)
