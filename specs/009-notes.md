# Spec 009: DM Notes

## Goal

Allow DMs to create and manage text-based notes within Adventures for organizing plot points, NPC relationships, location details, session summaries, and any other campaign information.

## Scope

### In Scope
- Note model linked to Adventures (cascade delete)
- CRUD API endpoints scoped to adventure
- Note card showing title and truncated content preview
- Notes section in Adventure detail page
- Combined create/edit modal
- Delete confirmation dialog
- Sorted by updatedAt desc

### Out of Scope
- Rich text / WYSIWYG editor (edit as plain text, render as markdown)
- Categories, tags, or folders
- Custom sort ordering
- Search or filtering
- Sharing between Adventures
- Export/import
- Player visibility (deferred to Sessions spec)
- Attachments or images

## Dependencies

- Spec 004: Adventures (notes belong to Adventures)

## Design Decisions

1. **Markdown support** — Content is edited as plain text in a textarea but rendered as styled markdown when viewing. Uses `react-markdown` for rendering. This gives DMs formatting power (headers, bold, lists, links) while keeping the editor simple.
2. **Modal-based editing** — Notes are just title + content, so a full page is unnecessary. Clicking a card opens the view modal; an Edit button switches to edit mode.
3. **Combined create/edit modal** — Single `CreateNoteModal` handles both modes based on whether a `note` prop is passed. Textarea for editing, rendered markdown for viewing.
4. **No detail page** — Unlike NPCs (which have complex character sheets), notes don't need a dedicated route.
5. **Truncated previews** — Cards show first ~100 characters of raw content with line-clamp (plain text, not rendered markdown).

## Database Schema

```prisma
model Note {
  id          String   @id @default(cuid())
  title       String
  content     String?

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  adventureId String
  adventure   Adventure @relation(fields: [adventureId], references: [id], onDelete: Cascade)

  @@index([adventureId])
  @@map("notes")
}
```

Add `notes Note[]` relation to Adventure model.

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/adventures/:adventureId/notes` | List notes (sorted updatedAt desc) |
| POST | `/api/adventures/:adventureId/notes` | Create note |
| GET | `/api/adventures/:adventureId/notes/:id` | Get single note |
| PATCH | `/api/adventures/:adventureId/notes/:id` | Update note |
| DELETE | `/api/adventures/:adventureId/notes/:id` | Delete note |

All endpoints require authenticated + verified user who owns the adventure. Non-owners get 404 (not 403).

### Validation
- Title: required, max 200 characters
- Content: optional, max 10,000 characters

### Request/Response

**POST** body: `{ title: string, content?: string }`
**PATCH** body: `{ title?: string, content?: string | null }`
**Responses**: `{ note: Note }` or `{ notes: Note[] }`

## Type Definitions

```typescript
export interface Note {
  id: string
  title: string
  content: string | null
  adventureId: string
  createdAt: string
  updatedAt: string
}

export interface NoteListResponse {
  notes: Note[]
}

export interface NoteResponse {
  note: Note
}

export interface CreateNoteRequest {
  title: string
  content?: string
}

export interface UpdateNoteRequest {
  title?: string
  content?: string | null
}
```

## Client Components

### NoteCard

```
┌───────────────────────────────────┐
│ The Black Keep                 ⋮  │
│                                   │
│ Ancient fortress overlooking the  │
│ valley. Built by the Order of...  │
│                                   │
│ Updated 2 hours ago               │
└───────────────────────────────────┘
```

- Title in display font, uppercase, tracking-wide
- Content preview: 3-line clamp
- Relative timestamp at bottom (text-ink-faded)
- Dropdown menu: Edit, Delete
- Click card → open edit modal
- Neobrutalism styling: border-2, shadow-brutal-sm, hover lift

### CreateNoteModal

```
┌──────────────────────────────────────┐
│  CREATE NOTE                     ✕   │
│                                      │
│  TITLE *                             │
│  ┌──────────────────────────────┐    │
│  │                              │    │
│  └──────────────────────────────┘    │
│                                      │
│  CONTENT                             │
│  ┌──────────────────────────────┐    │
│  │                              │    │
│  │                              │    │
│  │          (12 rows)           │    │
│  │                              │    │
│  │                              │    │
│  └──────────────────────────────┘    │
│                                      │
│               [Cancel]  [Create]     │
└──────────────────────────────────────┘
```

- **Create mode**: Title "CREATE NOTE", textarea for content, Create button
- **Edit mode**: Title "EDIT NOTE", textarea for content, Save button
- **View mode**: Title is the note title, content rendered as styled markdown, Edit button in footer
- Textarea with 12 rows for substantial note-taking
- Title required validation
- Uses `react-markdown` to render content in view mode with B/X-appropriate styling (headings, bold, italic, lists, links, code blocks)

### DeleteNoteDialog

Standard confirmation dialog matching DeleteNPCDialog / DeleteBackdropDialog pattern. Shows note title in quotes.

### AdventurePage Section

Notes section appears below Backdrops, above Coming Soon. Grid: `sm:grid-cols-2 lg:grid-cols-3`.

Empty state icon: 📝 (memo/notepad)

## Files to Create

| File | Description |
|------|-------------|
| `server/src/routes/notes.ts` | CRUD API routes |
| `client/src/components/NoteCard.tsx` | Card component |
| `client/src/components/CreateNoteModal.tsx` | Create/edit modal |
| `client/src/components/DeleteNoteDialog.tsx` | Delete confirmation |

## Files to Modify

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add Note model, update Adventure relation |
| `shared/src/types.ts` | Add Note types |
| `server/src/app.ts` | Register note routes |
| `client/src/pages/AdventurePage.tsx` | Add Notes section |
| `client/src/components/index.ts` | Export Note components |

## Implementation Phases

### Phase 1: Database & Types
- Add Note model to Prisma schema
- Create and apply migration
- Add types to shared package

### Phase 2: API Routes
- CRUD routes with auth guards
- Register in app.ts

### Phase 3: Client Components
- NoteCard, CreateNoteModal, DeleteNoteDialog
- Export from index.ts

### Phase 4: Adventure Page Integration
- State, fetch, handlers, section, modals

## Acceptance Criteria

- [ ] DM can create a note with title and content
- [ ] DM can create a note with only a title (empty content)
- [ ] Notes listed in Adventure page, sorted by updatedAt desc
- [ ] Clicking note card opens edit modal pre-filled
- [ ] DM can update title and content
- [ ] DM can delete with confirmation
- [ ] Notes cascade-deleted with Adventure
- [ ] Only adventure owner can access notes (404 for non-owners)
- [ ] Title required, max 200 chars; content optional, max 10,000 chars
- [ ] Empty state shown when no notes exist
- [ ] B/X aesthetic consistent with existing components
