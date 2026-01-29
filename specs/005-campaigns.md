# Spec 005: Campaign Management (Collection Entity)

## Goal

Implement Campaign CRUD functionality where Campaigns serve as collections of Adventures. A Campaign has a name, description, landscape banner image with selectable hotspot, and a world map accessible from all Adventures within it with shared fog of war.

## Scope

### In Scope

- Campaign database model with ownership
- Campaign CRUD API endpoints (create, read, update, delete, list)
- Landscape banner image upload with hotspot positioning
- Campaign detail page with banner, title, description, and Adventure cards
- World map at Campaign level (shared fog of war across Adventures)
- Campaign-Adventure relationship (Adventures belong to Campaigns)
- Update Dashboard to show Campaigns (not Adventures directly)

### Out of Scope

- Sharing Campaigns between users
- Campaign templates
- Campaign archiving/soft delete

## Dependencies

**Builds on:**
- Spec 002: Authentication (user context, protected routes)
- Spec 003: Email verification (verified users only)
- Spec 004: Adventures (Adventures will be nested under Campaigns)

## Detailed Requirements

*To be detailed during implementation planning.*

### 1. Database Schema

**Campaign Model (prisma/schema.prisma):**

```prisma
model Campaign {
  id              String   @id @default(cuid())
  name            String
  description     String?
  bannerImageUrl  String?
  bannerHotspotX  Float?   @default(50) // Percentage 0-100
  bannerHotspotY  Float?   @default(50) // Percentage 0-100
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  ownerId         String
  owner           User       @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  adventures      Adventure[]
  worldMap        Map?       @relation("CampaignWorldMap")

  @@map("campaigns")
}
```

**Update Quest Model:**

```prisma
model Adventure {
  // ... existing fields

  campaignId    String?
  campaign      Campaign? @relation(fields: [campaignId], references: [id], onDelete: Cascade)
}
```

### 2. API Endpoints

- `GET /api/campaigns` - List all Campaigns owned by user
- `POST /api/campaigns` - Create new Campaign
- `GET /api/campaigns/:id` - Get Campaign details with Adventures
- `PATCH /api/campaigns/:id` - Update Campaign
- `DELETE /api/campaigns/:id` - Delete Campaign (cascades to Adventures)
- `POST /api/campaigns/:id/banner` - Upload banner image
- `DELETE /api/campaigns/:id/banner` - Remove banner image

### 3. Client Implementation

- Campaign list page (new dashboard)
- Campaign detail page with banner and Adventure cards
- Create/Edit Campaign modal with banner upload and hotspot selector
- Update navigation to show Campaigns first, then Adventures within

## Acceptance Criteria

*To be detailed during implementation planning.*

- [ ] DM can create a Campaign with name, description, and banner image
- [ ] DM can set hotspot position on banner image
- [ ] Campaign detail page displays banner with title overlay
- [ ] Campaign detail page shows list of Adventure cards
- [ ] DM can create Adventures within a Campaign
- [ ] Dashboard shows Campaigns (not Adventures directly)
- [ ] Campaign has a world map slot for shared exploration

## References

- [PRD: Key Concepts - Campaign](/prd.md#key-concepts)
- [PRD: Flow 2 - DM Creates Campaign](/prd.md#flow-2-dm-creates-a-campaign)
- [PRD: Page Layouts - Campaign Detail Page](/prd.md#page-layouts)
- [Spec 004: Adventures](/specs/004-adventures.md)
