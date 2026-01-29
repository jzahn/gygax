# Spec 008: Backdrop Image Display

## Goal

Allow DMs to upload backdrop images within Adventures for use during sessions. Backdrops show town scenes, battle illustrations, monster images, or any other visual the DM wants to share with players. This spec covers CRUD and management UI only; displaying backdrops to players during live sessions is deferred to Spec 011 (Sessions).

## Scope

### In Scope

- Backdrop database model linked to Adventures (cascade delete)
- Backdrop CRUD API endpoints with image upload
- Backdrop management section in Adventure workspace (Forge mode)
- Backdrop card grid with 16:9 thumbnail previews
- Create/edit/preview modals
- Replace and delete backdrop images

### Out of Scope

- Displaying backdrops to players during sessions (Spec 011)
- Switching between map and backdrop view (Spec 011)
- WebSocket sync of backdrop display (Spec 011)
- Backdrop annotations or overlays
- Animated backdrops or slideshows
- Backdrop templates or library
- Backdrop export/import (unlike NPCs, backdrops are just images — no portable data)
- Focal point auto-detection or smart cropping

## Dependencies

**Builds on:**
- Spec 004: Adventures (Backdrops belong to Adventures)

**Future specs build on this:**
- Spec 011: Sessions (DM selects backdrop to display to players)

## Design Decisions

### 1. Image Required

A backdrop without an image is meaningless. Unlike NPCs where you can create a placeholder with just a name, creating a backdrop requires uploading an image. Name is also required; description is optional.

### 2. Focal Point for Responsive Display

Backdrops will be displayed full-screen to players during sessions (Spec 011). Different devices have different aspect ratios — a 16:9 landscape image on a portrait phone, or a portrait illustration on a widescreen monitor. The image scales to fill the viewport using `object-fit: cover`, and the focal point (0–100% x/y) controls which region stays visible when the image is cropped. The DM sets the focal point during upload/edit using the same FocalPointPicker used by Adventure covers. Defaults to center (50, 50).

### 3. Name vs Title

`name` is internal — it identifies the backdrop in the DM's management UI (card labels, lists). `title` is player-facing — it's displayed over the image when shown during a session (e.g., "The Grand Duchy of Karameikos"). Title is optional; many backdrops (a monster illustration, a battle scene) don't need one. When a title is set, the DM positions it on the image via `titleX`/`titleY` (0–100% coordinates), ensuring it sits over a readable area. The title renders at the specified position using `position: absolute` with `left`/`top` percentages and `transform: translate(-50%, -50%)` to center on the point.

### 4. No Export/Import

NPCs have complex structured data worth exporting. Backdrops are just an image + metadata. Users can save images from their browser if needed. No `.gygax.json` export format.

### 5. Modal-Based UI

Backdrops use modals for create/edit (like NPCs), not full pages. There isn't enough content to justify a dedicated page — it's just name, description, and an image. A full-size preview modal handles the "view" use case.

### 6. 16:9 Cards

Backdrop cards use landscape 16:9 aspect ratio (unlike NPC portrait 2:3 cards). This matches the expected aspect ratio for scene images and provides a good thumbnail preview.

### 7. Route Structure

All routes scoped under adventure (no standalone `/api/backdrops/:id` routes). Backdrops are simpler than NPCs — no detail page means no need for shortcut routes.

---

## Database Schema

### Backdrop Model

```prisma
model Backdrop {
  id          String   @id @default(cuid())
  name        String
  title       String?  // Optional display title shown over the backdrop
  titleX      Int      @default(50) // 0-100, percentage from left
  titleY      Int      @default(50) // 0-100, percentage from top
  description String?
  imageUrl    String
  focusX      Int      @default(50) // 0-100, percentage from left
  focusY      Int      @default(50) // 0-100, percentage from top

  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  adventureId String
  adventure   Adventure @relation(fields: [adventureId], references: [id], onDelete: Cascade)

  @@index([adventureId])
  @@map("backdrops")
}
```

### Quest Model Update

```prisma
model Adventure {
  // ... existing fields ...
  backdrops  Backdrop[]
}
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/adventures/:adventureId/backdrops` | List backdrops in adventure |
| `POST` | `/api/adventures/:adventureId/backdrops` | Create backdrop (multipart: image + fields) |
| `GET` | `/api/adventures/:adventureId/backdrops/:id` | Get single backdrop |
| `PATCH` | `/api/adventures/:adventureId/backdrops/:id` | Update name/title/description |
| `DELETE` | `/api/adventures/:adventureId/backdrops/:id` | Delete backdrop and image |
| `POST` | `/api/adventures/:adventureId/backdrops/:id/image` | Replace backdrop image |

### Request/Response Examples

**POST /api/adventures/:adventureId/backdrops**

Multipart form data:
- `image` (file, required): JPEG, PNG, or WebP, max 5MB
- `name` (field, required): String, max 100 chars
- `title` (field, optional): String, max 200 chars — display title shown over the backdrop
- `titleX` (field, optional): Int 0–100, default 50 — horizontal position of title on image
- `titleY` (field, optional): Int 0–100, default 50 — vertical position of title on image
- `description` (field, optional): String
- `focusX` (field, optional): Int 0–100, default 50
- `focusY` (field, optional): Int 0–100, default 50

**Response (201 Created)**
```json
{
  "backdrop": {
    "id": "clxxx...",
    "name": "Threshold Market Square",
    "title": "The Town of Threshold",
    "titleX": 50,
    "titleY": 20,
    "description": "Bustling town center at midday",
    "imageUrl": "http://localhost:9000/gygax-uploads/backdrops/clxxx.../abc123.jpg",
    "focusX": 50,
    "focusY": 50,
    "adventureId": "clyyy...",
    "createdAt": "2026-01-27T...",
    "updatedAt": "2026-01-27T..."
  }
}
```

**GET /api/adventures/:adventureId/backdrops**
```json
{
  "backdrops": [
    {
      "id": "clxxx...",
      "name": "Threshold Market Square",
      "title": "The Town of Threshold",
    "titleX": 50,
    "titleY": 20,
      "description": "Bustling town center at midday",
      "imageUrl": "http://localhost:9000/gygax-uploads/backdrops/clxxx.../abc123.jpg",
      "focusX": 50,
      "focusY": 50,
      "adventureId": "clyyy...",
      "createdAt": "2026-01-27T...",
      "updatedAt": "2026-01-27T..."
    }
  ]
}
```

**PATCH /api/adventures/:adventureId/backdrops/:id**
```json
{
  "name": "Threshold Market — Evening",
  "title": "Threshold at Dusk",
  "titleX": 50,
  "titleY": 15,
  "description": "The market square at dusk, torches lit",
  "focusX": 30,
  "focusY": 20
}
```

**Response (200 OK)**
```json
{
  "backdrop": { /* full backdrop object with updated fields */ }
}
```

**POST /api/adventures/:adventureId/backdrops/:id/image**

Multipart form data:
- `image` (file, required): JPEG, PNG, or WebP, max 5MB

Replaces existing image (deletes old file from S3).

**Response (200 OK)**
```json
{
  "backdrop": { /* full backdrop object with new imageUrl */ }
}
```

### Authorization

All backdrop endpoints require:
1. User is authenticated
2. User owns the Adventure containing the backdrop

For all routes, verify `adventureId` belongs to the authenticated user.

### S3 Key Structure

```
backdrops/{backdropId}/{uuid}.{ext}
```

Old images are deleted from S3 when replacing or deleting a backdrop. When deleting a backdrop, use `deleteFolder(`backdrops/{backdropId}`)` to clean up all files.

---

## Type Definitions

Add to `shared/src/types.ts`:

```typescript
// Backdrop types
export interface Backdrop {
  id: string
  name: string
  title: string | null
  titleX: number
  titleY: number
  description: string | null
  imageUrl: string
  focusX: number
  focusY: number
  adventureId: string
  createdAt: string
  updatedAt: string
}

export interface BackdropListResponse {
  backdrops: Backdrop[]
}

export interface BackdropResponse {
  backdrop: Backdrop
}

export interface UpdateBackdropRequest {
  name?: string
  title?: string | null
  titleX?: number
  titleY?: number
  description?: string | null
  focusX?: number
  focusY?: number
}
```

Note: No `CreateBackdropRequest` type — creation uses multipart form data, not JSON.

---

## Client Components

### 1. BackdropSection

Added to AdventurePage below NPCs section. Follows the same pattern as Maps and NPCs sections.

```
MAPS                              [+ New Map]
[Map cards...]

NPCs                              [+ New NPC]
[NPC cards...]

BACKDROPS                         [+ New Backdrop]
[Backdrop cards in 16:9 ratio...]
```

- Fetches backdrops for the adventure
- Renders BackdropCard grid
- "+ New Backdrop" button opens CreateBackdropModal

### 2. BackdropCard

Landscape 16:9 card showing:
- Image thumbnail (`object-fit: cover`, `object-position` set from `focusX`/`focusY`)
- Name overlay at bottom (semi-transparent dark bar)
- Menu (···): Edit, Delete
- Click opens BackdropPreviewModal (full-size view)

### 3. CreateBackdropModal

```
┌────────────────────────────────────────────┐
│  CREATE BACKDROP                       ✕   │
│  ═══════════════════════════════════════   │
│                                            │
│  IMAGE *                                   │
│  ┌────────────────────────────────────┐    │
│  │                                    │    │
│  │   [Drag & drop or click to         │    │
│  │    upload an image]                │    │
│  │                                    │    │
│  └────────────────────────────────────┘    │
│  Click image to set focal point (·)        │
│                                            │
│  NAME *                                    │
│  ┌────────────────────────────────────┐    │
│  │                                    │    │
│  └────────────────────────────────────┘    │
│                                            │
│  TITLE (shown over backdrop when displayed)│
│  ┌────────────────────────────────────┐    │
│  │                                    │    │
│  └────────────────────────────────────┘    │
│  Click image to position title (when set)  │
│                                            │
│  DESCRIPTION                               │
│  ┌────────────────────────────────────┐    │
│  │                                    │    │
│  │                                    │    │
│  └────────────────────────────────────┘    │
│                                            │
│              [Cancel]  [CREATE]            │
└────────────────────────────────────────────┘
```

- Image upload required (reuse ImageUpload component with FocalPointPicker)
- Name input required
- Description textarea optional
- Submit disabled until image and name are provided
- On submit: POST multipart form to create endpoint

### 4. EditBackdropModal

Same layout as create but pre-filled with existing data:
- Shows current image with "Replace Image" option and FocalPointPicker
- Name, title, and description editable
- Focal point adjustable on current image without re-uploading
- Save updates metadata via PATCH, image replacement via separate POST
- Two separate API calls if both metadata and image changed

### 5. BackdropPreviewModal

Full-screen modal for viewing the backdrop image:
- Dark overlay background
- Image displayed at maximum size maintaining aspect ratio
- Title displayed over the image at its `titleX`/`titleY` position if set (styled as a scene title — large, thematic text)
- Close button (✕) and click-outside-to-close
- No editing controls — just viewing

### 6. DeleteBackdropDialog

- Confirmation dialog with backdrop name
- Warning about permanent deletion (image removed from storage)
- Cancel / Delete buttons

---

## Files to Create

| File | Description |
|------|-------------|
| `prisma/migrations/XXXXXX_008_backdrops/migration.sql` | Database migration |
| `server/src/routes/backdrops.ts` | Backdrop CRUD API routes |
| `client/src/components/BackdropCard.tsx` | 16:9 landscape card component |
| `client/src/components/CreateBackdropModal.tsx` | Creation modal with image upload |
| `client/src/components/EditBackdropModal.tsx` | Edit modal |
| `client/src/components/BackdropPreviewModal.tsx` | Full-size image preview |
| `client/src/components/DeleteBackdropDialog.tsx` | Delete confirmation |

## Files to Modify

| File | Changes |
|------|---------|
| `prisma/schema.prisma` | Add Backdrop model, update Adventure relation |
| `shared/src/types.ts` | Add Backdrop types |
| `server/src/app.ts` | Register backdrop routes |
| `client/src/pages/AdventurePage.tsx` | Add Backdrops section |
| `client/src/components/index.ts` | Export backdrop components |

---

## Implementation Phases

### Phase 1: Database & Types
- Add Backdrop model to Prisma schema
- Add relation to Adventure model
- Create and apply migration
- Add TypeScript types to shared package

### Phase 2: API Routes
- Implement all CRUD routes in `backdrops.ts`
- List backdrops for adventure
- Create backdrop with multipart image upload
- Get single backdrop
- Update metadata (name/description)
- Replace image
- Delete backdrop (remove from DB + S3)
- Register routes in app.ts

### Phase 3: Client Components
- BackdropCard component (16:9 landscape)
- CreateBackdropModal with ImageUpload
- EditBackdropModal
- BackdropPreviewModal (full-size view)
- DeleteBackdropDialog

### Phase 4: Adventure Page Integration
- Add Backdrops section to AdventurePage (below NPCs)
- Fetch and display backdrop cards
- Wire up create/edit/delete/preview modals
- Toast notifications for actions

---

## Acceptance Criteria

### CRUD Operations
- [ ] DM can create a backdrop with image and name
- [ ] DM can create a backdrop with image, name, and description
- [ ] Cannot create a backdrop without an image
- [ ] Cannot create a backdrop without a name
- [ ] DM can view list of backdrops in Adventure page
- [ ] DM can edit backdrop name, title, and description
- [ ] DM can set focal point when creating a backdrop
- [ ] DM can adjust focal point on existing backdrop
- [ ] DM can replace backdrop image
- [ ] DM can delete a backdrop
- [ ] Changes persist on page refresh

### UI/UX
- [ ] Backdrops section appears in Adventure page (below NPCs)
- [ ] Backdrop cards display 16:9 thumbnail with name overlay
- [ ] Preview modal displays title over the image at its stored position when set
- [ ] DM can click on the image preview to position the title
- [ ] Title position indicator only appears when title text is set
- [ ] Clicking a card opens full-size preview modal
- [ ] Card menu provides Edit and Delete options
- [ ] Create modal requires image and name before submit
- [ ] Create and edit modals include FocalPointPicker on the image
- [ ] Edit modal shows current image with replace option
- [ ] B/X aesthetic consistent with rest of application

### Image Handling
- [ ] Accepted formats: JPEG, PNG, WebP
- [ ] Max file size: 5MB (validated client and server)
- [ ] Images stored in S3 under `backdrops/{id}/` path
- [ ] Old image deleted from S3 when replaced
- [ ] All images deleted from S3 when backdrop deleted

### Authorization
- [ ] Only adventure owner can view adventure's backdrops
- [ ] Only adventure owner can create/edit/delete backdrops
- [ ] Unauthenticated users cannot access backdrop endpoints
- [ ] Users cannot access backdrops in adventures they don't own (404)

### Data Integrity
- [ ] Backdrops deleted when Adventure is deleted (cascade)
- [ ] Backdrop adventureId matches route adventureId

---

## Verification Steps

### API Tests (curl)

```bash
# Create backdrop (multipart)
curl -X POST http://localhost:3000/api/adventures/{adventureId}/backdrops \
  -H "Cookie: session=..." \
  -F "image=@/path/to/image.jpg" \
  -F "name=Threshold Market" \
  -F "description=Town center at midday" \
  -F "focusX=50" \
  -F "focusY=30"

# List backdrops
curl http://localhost:3000/api/adventures/{adventureId}/backdrops \
  -H "Cookie: session=..."

# Get single backdrop
curl http://localhost:3000/api/adventures/{adventureId}/backdrops/{backdropId} \
  -H "Cookie: session=..."

# Update metadata
curl -X PATCH http://localhost:3000/api/adventures/{adventureId}/backdrops/{backdropId} \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"name": "Threshold Market — Evening"}'

# Replace image
curl -X POST http://localhost:3000/api/adventures/{adventureId}/backdrops/{backdropId}/image \
  -H "Cookie: session=..." \
  -F "image=@/path/to/new-image.jpg"

# Delete backdrop
curl -X DELETE http://localhost:3000/api/adventures/{adventureId}/backdrops/{backdropId} \
  -H "Cookie: session=..."
```

### Client Flow Tests

1. **Create Backdrop** → Navigate to Adventure → Click "+ New Backdrop" → Upload image → Enter name → Submit → Backdrop card appears in grid
2. **Preview Backdrop** → Click backdrop card → Full-size preview modal opens → Close modal
3. **Edit Backdrop** → Click card menu → Edit → Change name → Save → Card updates
4. **Replace Image** → Edit modal → Click replace → Upload new image → Save → Thumbnail updates
5. **Delete Backdrop** → Click card menu → Delete → Confirm → Card removed from grid

### Authorization Tests

1. **Unauthenticated** → API returns 401
2. **Wrong user** → API returns 404 (not 403, to avoid leaking existence)
3. **Adventure owner** → Full access to all operations

### Cascade Delete Test

1. Create Adventure with backdrops
2. Delete Adventure
3. Verify backdrops are deleted (query returns 404)
4. Verify S3 images are cleaned up

### Image Validation Tests

1. Upload valid JPEG → succeeds
2. Upload valid PNG → succeeds
3. Upload valid WebP → succeeds
4. Upload GIF → rejected (unsupported format)
5. Upload file > 5MB → rejected (too large)
6. Submit without image → rejected (image required)

---

## References

- [PRD: Key Concepts - Backdrop](/prd.md#key-concepts)
- [PRD: MVP Features - Forge Mode Backdrops](/prd.md#forge-mode---backdrops)
- [Spec 004: Adventures](/specs/004-adventures.md)
- [Spec 007: NPCs](/specs/007-npcs.md) (pattern reference for Adventure-scoped entities)
