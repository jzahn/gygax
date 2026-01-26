# Spec 008: Backdrop Image Display

## Goal

Allow DMs to upload backdrop images that can be displayed to players during sessions instead of a map. Backdrops can show town scenes, battle illustrations, monster images, or any other visual the DM wants to share with players.

## Scope

### In Scope

- Backdrop database model linked to Adventures
- Backdrop CRUD API endpoints
- Backdrop image upload (S3-compatible storage)
- Backdrop management within Adventure workspace (Forge mode)
- Backdrop display during live sessions (DM selects backdrop to show)
- Switch between map view and backdrop view

### Out of Scope

- Backdrop annotations or overlays
- Animated backdrops or slideshows
- Backdrop templates or library
- Multiple backdrops displayed simultaneously

## Dependencies

**Builds on:**
- Spec 004: Adventures (Backdrops belong to Adventures)
- Spec 011: Sessions (Backdrops displayed during sessions)

## Detailed Requirements

*To be detailed during implementation planning.*

### 1. Database Schema

**Backdrop Model (prisma/schema.prisma):**

```prisma
model Backdrop {
  id          String   @id @default(cuid())
  name        String
  description String?
  imageUrl    String
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  adventureId String
  adventure   Adventure @relation(fields: [adventureId], references: [id], onDelete: Cascade)

  @@map("backdrops")
}
```

### 2. API Endpoints

- `GET /api/adventures/:adventureId/backdrops` - List Backdrops in Adventure
- `POST /api/adventures/:adventureId/backdrops` - Create Backdrop with image upload
- `GET /api/adventures/:adventureId/backdrops/:id` - Get Backdrop details
- `PATCH /api/adventures/:adventureId/backdrops/:id` - Update Backdrop metadata
- `DELETE /api/adventures/:adventureId/backdrops/:id` - Delete Backdrop and image
- `POST /api/adventures/:adventureId/backdrops/:id/image` - Replace Backdrop image

### 3. Client Implementation

- Backdrop section in Adventure detail page
- Backdrop list/grid component with thumbnails
- Create/Edit Backdrop modal with image upload
- Session view: backdrop display area
- DM controls to switch between map and backdrop

### 4. Session Integration

- DM can select "Show Backdrop" and choose from Adventure's backdrops
- All players see the backdrop instead of the map
- DM can switch back to map view
- Backdrop display synced via WebSocket

## Acceptance Criteria

*To be detailed during implementation planning.*

- [ ] DM can navigate to Backdrops section in Adventure
- [ ] DM can upload a backdrop image with name and description
- [ ] Backdrops appear in grid/list view with thumbnails
- [ ] DM can edit backdrop name/description
- [ ] DM can delete a backdrop
- [ ] During session, DM can select a backdrop to display
- [ ] Players see backdrop instead of map when displayed
- [ ] DM can switch back to map view

## References

- [PRD: Key Concepts - Backdrop](/prd.md#key-concepts)
- [PRD: MVP Features - Forge Mode Backdrops](/prd.md#forge-mode---backdrops)
- [PRD: Flow 10 - DM Displays Backdrop](/prd.md#flow-10-dm-displays-backdrop-during-session)
