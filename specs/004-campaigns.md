# Spec 004: Campaign Management

## Goal

Implement campaign CRUD functionality allowing DMs to create, view, edit, and delete campaigns. This establishes the core organizational unit for all future game content (maps, encounters, sessions).

## Scope

### In Scope

- Campaign database model with ownership
- Campaign CRUD API endpoints (create, read, update, delete, list)
- Cover image upload (S3-compatible storage)
- Dashboard page showing user's campaigns
- Create/Edit campaign modal with image upload
- Campaign detail page (shell for future content)
- Empty state for new users
- Campaign card component with cover image

### Out of Scope

- Maps (spec 005)
- Encounters and random tables
- Live game sessions
- Player invitations/membership
- Campaign sharing or public visibility
- Campaign settings (rule system, house rules)
- Campaign archiving/soft delete
- Image cropping/editing (user uploads pre-cropped images)

## Dependencies

**New Server Dependencies:**
| Package | Version | Purpose |
|---------|---------|---------|
| @fastify/multipart | ^9.0.0 | File upload handling |
| @aws-sdk/client-s3 | ^3.0.0 | S3-compatible storage client |

**New Docker Service:**
| Service | Image | Purpose |
|---------|-------|---------|
| minio | minio/minio | S3-compatible object storage for development |

**Environment Variables:**
| Variable | Description | Dev Default |
|----------|-------------|-------------|
| S3_ENDPOINT | S3-compatible endpoint URL | http://minio:9000 |
| S3_ACCESS_KEY | Access key for S3 | minioadmin |
| S3_SECRET_KEY | Secret key for S3 | minioadmin |
| S3_BUCKET | Bucket name for uploads | gygax-uploads |
| S3_PUBLIC_URL | Public URL for serving files | http://localhost:9000/gygax-uploads |

**Builds on:**
- Spec 002: Authentication (user context, protected routes)
- Spec 003: Email verification (verified users only)

## Detailed Requirements

### 1. Database Schema

**Campaign Model (prisma/schema.prisma):**

```prisma
model Campaign {
  id            String   @id @default(cuid())
  name          String
  description   String?
  coverImageUrl String?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  ownerId       String
  owner         User     @relation(fields: [ownerId], references: [id], onDelete: Cascade)

  @@map("campaigns")
}
```

**Update User Model:**

```prisma
model User {
  // ... existing fields
  campaigns Campaign[]
}
```

**Migration:** `004_campaigns` creates the campaigns table with foreign key to users.

### 1.1 Docker Configuration

**Add MinIO to docker-compose.yml:**

```yaml
minio:
  image: minio/minio
  ports:
    - '9000:9000'   # API
    - '9001:9001'   # Console
  environment:
    MINIO_ROOT_USER: minioadmin
    MINIO_ROOT_PASSWORD: minioadmin
  command: server /data --console-address ":9001"
  volumes:
    - minio_data:/data
  healthcheck:
    test: ['CMD', 'mc', 'ready', 'local']
    interval: 5s
    timeout: 5s
    retries: 5

# Add to server.environment:
S3_ENDPOINT: http://minio:9000
S3_ACCESS_KEY: minioadmin
S3_SECRET_KEY: minioadmin
S3_BUCKET: gygax-uploads
S3_PUBLIC_URL: http://localhost:9000/gygax-uploads

# Add minio to server.depends_on

# Add to volumes:
minio_data:
```

**MinIO Bucket Initialization:**

The server should create the bucket on startup if it doesn't exist, with public read policy for serving images.

### 2. API Endpoints

All campaign endpoints require authentication and verified email.

#### GET /api/campaigns

List all campaigns owned by the current user.

**Response (200):**
```json
{
  "campaigns": [
    {
      "id": "clx...",
      "name": "Curse of the Azure Bonds",
      "description": "A classic adventure in the Forgotten Realms",
      "coverImageUrl": "http://localhost:9000/gygax-uploads/campaigns/clx.../cover.jpg",
      "createdAt": "2024-01-20T12:00:00.000Z",
      "updatedAt": "2024-01-20T12:00:00.000Z"
    }
  ]
}
```

Campaigns are sorted by `updatedAt` descending (most recently modified first).

**Errors:**
- 401: Not authenticated
- 403: Email not verified

#### POST /api/campaigns

Create a new campaign.

**Request:**
```json
{
  "name": "Curse of the Azure Bonds",
  "description": "A classic adventure in the Forgotten Realms"
}
```

**Response (201):**
```json
{
  "campaign": {
    "id": "clx...",
    "name": "Curse of the Azure Bonds",
    "description": "A classic adventure in the Forgotten Realms",
    "coverImageUrl": null,
    "createdAt": "2024-01-20T12:00:00.000Z",
    "updatedAt": "2024-01-20T12:00:00.000Z"
  }
}
```

**Validation:**
- `name`: Required, 1-100 characters, trimmed
- `description`: Optional, max 1000 characters, trimmed

**Errors:**
- 400: Invalid input (missing name, name too long, description too long)
- 401: Not authenticated
- 403: Email not verified

#### GET /api/campaigns/:id

Get a single campaign by ID.

**Response (200):**
```json
{
  "campaign": {
    "id": "clx...",
    "name": "Curse of the Azure Bonds",
    "description": "A classic adventure in the Forgotten Realms",
    "coverImageUrl": "http://localhost:9000/gygax-uploads/campaigns/clx.../cover.jpg",
    "createdAt": "2024-01-20T12:00:00.000Z",
    "updatedAt": "2024-01-20T12:00:00.000Z"
  }
}
```

**Errors:**
- 401: Not authenticated
- 403: Email not verified OR not the campaign owner
- 404: Campaign not found

#### PATCH /api/campaigns/:id

Update a campaign.

**Request:**
```json
{
  "name": "Updated Name",
  "description": "Updated description"
}
```

Both fields are optional; only provided fields are updated.

**Response (200):**
```json
{
  "campaign": {
    "id": "clx...",
    "name": "Updated Name",
    "description": "Updated description",
    "coverImageUrl": "http://localhost:9000/gygax-uploads/campaigns/clx.../cover.jpg",
    "createdAt": "2024-01-20T12:00:00.000Z",
    "updatedAt": "2024-01-20T14:00:00.000Z"
  }
}
```

**Errors:**
- 400: Invalid input
- 401: Not authenticated
- 403: Email not verified OR not the campaign owner
- 404: Campaign not found

#### DELETE /api/campaigns/:id

Delete a campaign permanently. Also deletes associated cover image from storage.

**Response (200):**
```json
{
  "success": true
}
```

**Errors:**
- 401: Not authenticated
- 403: Email not verified OR not the campaign owner
- 404: Campaign not found

#### POST /api/campaigns/:id/cover

Upload or replace the campaign cover image.

**Request:** `multipart/form-data` with `image` field

**Constraints:**
- Max file size: 5MB
- Allowed types: image/jpeg, image/png, image/webp
- Recommended dimensions: 400x600 (2:3 ratio, like B/X module covers)

**Response (200):**
```json
{
  "campaign": {
    "id": "clx...",
    "name": "Curse of the Azure Bonds",
    "description": "A classic adventure in the Forgotten Realms",
    "coverImageUrl": "http://localhost:9000/gygax-uploads/campaigns/clx.../cover.jpg",
    "createdAt": "2024-01-20T12:00:00.000Z",
    "updatedAt": "2024-01-20T14:00:00.000Z"
  }
}
```

**Behavior:**
- Replaces existing cover image if present (deletes old file)
- Generates unique filename to prevent caching issues
- Stores at path: `campaigns/{campaignId}/{uuid}.{ext}`

**Errors:**
- 400: No file provided, invalid file type, file too large
- 401: Not authenticated
- 403: Email not verified OR not the campaign owner
- 404: Campaign not found

#### DELETE /api/campaigns/:id/cover

Remove the campaign cover image.

**Response (200):**
```json
{
  "campaign": {
    "id": "clx...",
    "name": "Curse of the Azure Bonds",
    "description": "A classic adventure in the Forgotten Realms",
    "coverImageUrl": null,
    "createdAt": "2024-01-20T12:00:00.000Z",
    "updatedAt": "2024-01-20T14:00:00.000Z"
  }
}
```

**Errors:**
- 401: Not authenticated
- 403: Email not verified OR not the campaign owner
- 404: Campaign not found

### 3. Server Implementation

#### Storage Service (server/src/services/storage.ts)

S3-compatible storage service for file uploads:

```typescript
import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3'

const s3Client = new S3Client({
  endpoint: process.env.S3_ENDPOINT,
  region: 'us-east-1', // Required but ignored by MinIO
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY!,
    secretAccessKey: process.env.S3_SECRET_KEY!,
  },
  forcePathStyle: true, // Required for MinIO
})

export async function uploadFile(key: string, body: Buffer, contentType: string): Promise<string>
export async function deleteFile(key: string): Promise<void>
export function getPublicUrl(key: string): string
```

**Bucket Initialization:**

On server startup, ensure bucket exists with public read policy:

```typescript
async function initializeBucket() {
  // Create bucket if not exists
  // Set bucket policy for public read access
}
```

#### Campaign Routes (server/src/routes/campaigns.ts)

New route file implementing all seven endpoints with:
- Authentication check via `request.user`
- Email verification check
- Ownership validation for single-campaign operations
- Input validation and sanitization
- File upload handling with @fastify/multipart

#### Helper: requireVerifiedUser

Create a reusable helper or hook pattern for routes requiring verified email:

```typescript
function requireVerifiedUser(request: FastifyRequest, reply: FastifyReply) {
  if (!request.user) {
    return reply.status(401).send({ error: 'Unauthorized', message: 'Not authenticated' })
  }
  // Fetch user to check emailVerified
  // Return 403 if not verified
}
```

### 4. Type Definitions (shared/src/types.ts)

```typescript
// Campaign types
export interface Campaign {
  id: string
  name: string
  description: string | null
  coverImageUrl: string | null
  createdAt: string
  updatedAt: string
}

export interface CampaignListResponse {
  campaigns: Campaign[]
}

export interface CampaignResponse {
  campaign: Campaign
}

export interface CreateCampaignRequest {
  name: string
  description?: string
}

export interface UpdateCampaignRequest {
  name?: string
  description?: string
}
```

### 5. Client Implementation

#### Dashboard Page (client/src/pages/DashboardPage.tsx)

The main landing page for authenticated users. Replaces/extends HomePage.

**Page Title:** "YOUR CAMPAIGNS" (IM Fell English, ALL CAPS)
**Subtitle:** "Select a realm to continue your work, or forge a new one" (Spectral italic)

**Layout:**
- Header with title and "New Campaign" button
- Grid of campaign cards (responsive: 1 col mobile, 2 col tablet, 3 col desktop)
- Empty state when no campaigns exist

**Empty State:**
- Centered illustration area (optional: simple quill/scroll icon)
- Text: "No campaigns yet"
- Subtext: "Every great adventure begins with a single step. Create your first campaign to begin."
- Primary "Create Campaign" button

**Campaign Grid:**
- Uses CSS Grid: `grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6`
- Cards sorted by most recently updated

#### Campaign Card Component (client/src/components/CampaignCard.tsx)

**Design:** Neobrutalism card styled like a B/X module cover

**Layout:**
- Cover image area (2:3 ratio, like classic module covers)
- If no cover: parchment background with campaign name in decorative typography
- Content area below image with name, description, timestamp

**Content:**
- Cover image (or placeholder with campaign initial/name)
- Campaign name (truncated if long, IM Fell English)
- Description preview (2 lines max, Spectral, faded if empty)
- "Last modified: X days ago" timestamp (Spectral, small, faded)
- Overflow menu (three dots) with Edit and Delete options

**Interaction:**
- Entire card is clickable → navigates to campaign detail
- Hover: subtle lift effect (matches button hover)
- Menu button stops propagation to prevent navigation

**States:**
- Default: paper texture, brutal shadow
- Hover: lifted, expanded shadow
- Loading: skeleton placeholder

**Placeholder Design (no cover image):**
- Parchment background with subtle border
- Large decorative initial or crossed swords icon
- Campaign name in IM Fell English, centered

#### Create/Edit Campaign Modal (client/src/components/CreateCampaignModal.tsx)

**Design:** Neobrutalism dialog with paper texture

**Title (Create):** "FORGE A NEW REALM"
**Title (Edit):** "EDIT REALM"

**Form Fields:**
- Cover image upload (optional): "Cover Art" / drag-drop zone or click to browse
- Name input (required): "Campaign Name" / "What shall this realm be called?"
- Description textarea (optional): "Description" / "Describe the nature of this adventure..."

**Cover Image Upload Area:**
- Displays current image if editing campaign with existing cover
- Drag-and-drop zone with dashed border
- Click to open file picker
- Shows preview after selection
- "Remove" button to clear selection/existing image
- Helper text: "Recommended: 400x600px (2:3 ratio, like a module cover)"
- Accepts: JPG, PNG, WebP up to 5MB

**Buttons:**
- Cancel (ghost variant)
- Create/Save (primary variant)

**Behavior:**
- Opens as modal overlay with backdrop
- Form validation with inline feedback
- Image uploads on form submit (not immediately on selection)
- Loading state on submit
- Closes on success, shows error on failure
- Escape key closes modal

#### Campaign Detail Page (client/src/pages/CampaignPage.tsx)

**Route:** `/campaigns/:id`

**Layout (shell for future expansion):**
- Back link to dashboard
- Hero section with cover image (if present) or decorative header
- Campaign name as page title (overlaid on cover or below)
- Description (if present)
- Edit button (opens modal)
- Placeholder content area: "Maps, encounters, and session tools coming soon"

**Cover Image Display:**
- If cover exists: Full-width hero with cover image, campaign name overlaid at bottom with text shadow
- If no cover: Decorative parchment header with campaign name

**Future sections (not implemented in this spec):**
- Maps list
- Encounters list
- Session history
- Campaign settings

#### Delete Confirmation Dialog (client/src/components/DeleteCampaignDialog.tsx)

**Design:** Neobrutalism alert dialog

**Title:** "DELETE CAMPAIGN"
**Message:** "Are you certain you wish to destroy '{campaign name}'? This action cannot be undone. All maps, encounters, and session history will be lost forever."

**Buttons:**
- Cancel (ghost variant)
- Delete (destructive variant, bloodRed)

### 6. Routing Updates

**client/src/App.tsx:**

```tsx
<Route path="/" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
<Route path="/campaigns/:id" element={<ProtectedRoute><CampaignPage /></ProtectedRoute>} />
```

Note: HomePage becomes DashboardPage or is replaced by it.

### 7. Project Structure Updates

**New Files:**
```
server/src/services/storage.ts             # S3-compatible storage service
server/src/routes/campaigns.ts
client/src/pages/DashboardPage.tsx
client/src/pages/CampaignPage.tsx
client/src/components/CampaignCard.tsx
client/src/components/CreateCampaignModal.tsx
client/src/components/DeleteCampaignDialog.tsx
client/src/components/ImageUpload.tsx      # Reusable image upload component
client/src/components/ui/dialog.tsx        # If not already present
client/src/components/ui/textarea.tsx      # If not already present
client/src/components/ui/dropdown-menu.tsx # If not already present
```

**Modified Files:**
```
docker-compose.yml          # Add MinIO service
.env.example                # Add S3 variables
prisma/schema.prisma        # Add Campaign model, update User
shared/src/types.ts         # Add campaign types
server/package.json         # Add @fastify/multipart, @aws-sdk/client-s3
server/src/app.ts           # Register campaign routes, multipart plugin
client/src/App.tsx          # Update routes
client/src/pages/index.tsx  # Export new pages
```

## UI Component Specifications

### Dialog Component

If not already present, add shadcn dialog:
```bash
npx shadcn@latest add dialog
```

Customize with B/X aesthetic:
- Paper texture background
- Brutal shadow
- IM Fell English for titles
- Spectral for body text

### Textarea Component

If not already present, add shadcn textarea:
```bash
npx shadcn@latest add textarea
```

Customize to match Input component:
- 3px solid ink border
- Special Elite font for typed text
- Paper texture background
- Brutal shadow
- candleGlow focus ring

### Dropdown Menu Component

If not already present, add shadcn dropdown-menu:
```bash
npx shadcn@latest add dropdown-menu
```

Customize for B/X:
- Paper texture background
- Ink borders
- Spectral font for items
- Hover state with subtle background change

## Design Details

### Dashboard Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ╔═══════════════════════════════════════════════════════╗  │
│  ║  YOUR CAMPAIGNS                    [+ New Campaign]   ║  │
│  ║  Select a realm to continue your work                 ║  │
│  ╠═══════════════════════════════════════════════════════╣  │
│  ║                                                       ║  │
│  ║   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ║  │
│  ║   │ Campaign 1  │  │ Campaign 2  │  │ Campaign 3  │  ║  │
│  ║   │ Description │  │ Description │  │ Description │  ║  │
│  ║   │ 2 days ago  │  │ 1 week ago  │  │ 3 weeks ago │  ║  │
│  ║   └─────────────┘  └─────────────┘  └─────────────┘  ║  │
│  ║                                                       ║  │
│  ║   ┌─────────────┐  ┌─────────────┐                   ║  │
│  ║   │ Campaign 4  │  │ Campaign 5  │                   ║  │
│  ║   │ Description │  │ Description │                   ║  │
│  ║   │ 1 month ago │  │ 2 months ago│                   ║  │
│  ║   └─────────────┘  └─────────────┘                   ║  │
│  ║                                                       ║  │
│  ╚═══════════════════════════════════════════════════════╝  │
└─────────────────────────────────────────────────────────────┘
```

### Empty State Layout

```
┌─────────────────────────────────────────────────────────────┐
│  ╔═══════════════════════════════════════════════════════╗  │
│  ║  YOUR CAMPAIGNS                    [+ New Campaign]   ║  │
│  ║  Select a realm to continue your work                 ║  │
│  ╠═══════════════════════════════════════════════════════╣  │
│  ║                                                       ║  │
│  ║                                                       ║  │
│  ║                     ⚔ ══════ ⚔                       ║  │
│  ║                                                       ║  │
│  ║                  No campaigns yet                     ║  │
│  ║                                                       ║  │
│  ║        Every great adventure begins with a            ║  │
│  ║        single step. Create your first campaign        ║  │
│  ║        to begin.                                      ║  │
│  ║                                                       ║  │
│  ║              ┌─────────────────────┐                  ║  │
│  ║              │  CREATE CAMPAIGN    │                  ║  │
│  ║              └─────────────────────┘                  ║  │
│  ║                                                       ║  │
│  ╚═══════════════════════════════════════════════════════╝  │
└─────────────────────────────────────────────────────────────┘
```

### Campaign Card Design

**With Cover Image:**
```
┌──────────────────────────────┐
│ ┌──────────────────────────┐ │
│ │                          │ │
│ │     [COVER IMAGE]        │ │  ← 2:3 ratio image
│ │                          │ │
│ │                          │ │
│ └──────────────────────────┘ │
│  Curse of the Azure Bonds  ⋮ │  ← Name + menu
│  A classic adventure in the  │  ← Description (2 lines max)
│  Forgotten Realms...         │
│  Last modified: 2 days ago   │  ← Timestamp (faded)
└──────────────────────────────┘
     ↳ brutal shadow offset
```

**Without Cover Image (Placeholder):**
```
┌──────────────────────────────┐
│ ┌──────────────────────────┐ │
│ │                          │ │
│ │          ⚔  ⚔           │ │  ← Decorative icon
│ │                          │ │
│ │         CURSE            │ │  ← Abbreviated name
│ │                          │ │
│ └──────────────────────────┘ │
│  Curse of the Azure Bonds  ⋮ │
│  A classic adventure in the  │
│  Forgotten Realms...         │
│  Last modified: 2 days ago   │
└──────────────────────────────┘
```

### Create Campaign Modal

```
┌────────────────────────────────────────────┐
│  FORGE A NEW REALM                    ✕    │
│  ════════════════════════════════════════  │
│                                            │
│  COVER ART (optional)                      │
│  ┌────────────────────────────────────┐    │
│  │  ┌────────┐                        │    │
│  │  │        │   Drag image here      │    │
│  │  │  📜    │   or click to browse   │    │
│  │  │        │                        │    │
│  │  └────────┘   400x600px recommended│    │
│  └────────────────────────────────────┘    │
│                                            │
│  CAMPAIGN NAME                             │
│  ┌────────────────────────────────────┐    │
│  │ Curse of the Azure Bonds           │    │
│  └────────────────────────────────────┘    │
│                                            │
│  DESCRIPTION (optional)                    │
│  ┌────────────────────────────────────┐    │
│  │ A classic adventure in the         │    │
│  │ Forgotten Realms, where            │    │
│  │ heroes must...                     │    │
│  └────────────────────────────────────┘    │
│                                            │
│              [Cancel]  [CREATE]            │
└────────────────────────────────────────────┘
```

**With Image Selected:**
```
│  COVER ART (optional)                      │
│  ┌────────────────────────────────────┐    │
│  │  ┌────────┐                        │    │
│  │  │ IMAGE  │   cover.jpg            │    │
│  │  │PREVIEW │   1.2 MB        [✕]    │    │
│  │  │        │                        │    │
│  │  └────────┘                        │    │
│  └────────────────────────────────────┘    │
```

## Acceptance Criteria

### Infrastructure
- [ ] MinIO container starts and is accessible
- [ ] MinIO console available at http://localhost:9001
- [ ] Bucket is created on server startup
- [ ] Bucket has public read policy for serving images

### API
- [ ] GET /api/campaigns returns empty array for new users
- [ ] GET /api/campaigns returns user's campaigns sorted by updatedAt desc
- [ ] POST /api/campaigns creates campaign with valid data
- [ ] POST /api/campaigns returns 400 for missing/invalid name
- [ ] GET /api/campaigns/:id returns campaign details
- [ ] GET /api/campaigns/:id returns 404 for non-existent campaign
- [ ] GET /api/campaigns/:id returns 403 for other user's campaign
- [ ] PATCH /api/campaigns/:id updates campaign
- [ ] PATCH /api/campaigns/:id returns 403 for other user's campaign
- [ ] DELETE /api/campaigns/:id deletes campaign and cover image
- [ ] DELETE /api/campaigns/:id returns 403 for other user's campaign
- [ ] POST /api/campaigns/:id/cover uploads cover image
- [ ] POST /api/campaigns/:id/cover returns 400 for invalid file type
- [ ] POST /api/campaigns/:id/cover returns 400 for file too large (>5MB)
- [ ] DELETE /api/campaigns/:id/cover removes cover image
- [ ] All endpoints return 401 when not authenticated
- [ ] All endpoints return 403 when email not verified

### Dashboard
- [ ] Dashboard shows loading state while fetching
- [ ] Dashboard shows empty state when no campaigns
- [ ] Dashboard shows campaign cards in grid layout
- [ ] Campaign cards show cover image (or placeholder if none)
- [ ] Campaign cards show name, description preview, timestamp
- [ ] Campaign cards are clickable and navigate to detail page
- [ ] "New Campaign" button opens create modal
- [ ] Responsive grid: 1 col mobile, 2 col tablet, 3 col desktop

### Create/Edit Modal
- [ ] Modal opens for create and edit
- [ ] Form validates name is required
- [ ] Form validates name length (1-100 chars)
- [ ] Form validates description length (max 1000 chars)
- [ ] Image upload zone accepts drag-and-drop
- [ ] Image upload zone accepts click to browse
- [ ] Image preview displays after selection
- [ ] Can remove selected image before submit
- [ ] Rejects files over 5MB with error message
- [ ] Rejects non-image files with error message
- [ ] Submit creates/updates campaign with image
- [ ] Modal shows loading state during submission
- [ ] Modal closes on success
- [ ] Error displays on failure
- [ ] Escape key closes modal

### Campaign Detail Page
- [ ] Shows cover image as hero (if present)
- [ ] Shows decorative header (if no cover)
- [ ] Shows campaign name and description
- [ ] Has back link to dashboard
- [ ] Has edit button that opens modal
- [ ] Shows placeholder for future content

### Delete Flow
- [ ] Delete option in card menu opens confirmation
- [ ] Confirmation shows campaign name
- [ ] Cancel closes dialog
- [ ] Confirm deletes campaign
- [ ] Dashboard updates after deletion

### Design
- [ ] All new components match B/X aesthetic
- [ ] Typography follows established system
- [ ] Animations are consistent with existing pages
- [ ] Empty state is visually appealing
- [ ] Mobile layout is usable

## Verification Steps

### 1. Infrastructure Tests

```bash
# Verify MinIO is running
curl http://localhost:9000/minio/health/live

# Access MinIO console
open http://localhost:9001
# Login: minioadmin / minioadmin

# Verify bucket exists with public policy
```

### 2. API Tests

```bash
# Get campaigns (empty)
curl http://localhost:3000/api/campaigns \
  -b cookies.txt

# Create campaign
curl -X POST http://localhost:3000/api/campaigns \
  -H "Content-Type: application/json" \
  -d '{"name":"Test Campaign","description":"A test"}' \
  -b cookies.txt

# Get campaigns (should have one)
curl http://localhost:3000/api/campaigns \
  -b cookies.txt

# Get single campaign
curl http://localhost:3000/api/campaigns/{id} \
  -b cookies.txt

# Upload cover image
curl -X POST http://localhost:3000/api/campaigns/{id}/cover \
  -F "image=@/path/to/cover.jpg" \
  -b cookies.txt

# Verify image URL is accessible
curl -I {coverImageUrl}

# Remove cover image
curl -X DELETE http://localhost:3000/api/campaigns/{id}/cover \
  -b cookies.txt

# Update campaign
curl -X PATCH http://localhost:3000/api/campaigns/{id} \
  -H "Content-Type: application/json" \
  -d '{"name":"Updated Name"}' \
  -b cookies.txt

# Delete campaign
curl -X DELETE http://localhost:3000/api/campaigns/{id} \
  -b cookies.txt
```

### 3. Client Flow Tests

1. Login as verified user
2. Verify dashboard shows empty state
3. Click "Create Campaign" → modal opens
4. Submit with empty name → shows validation error
5. Fill name and description → submit
6. Verify campaign appears in grid with placeholder image
7. Click campaign card → navigates to detail page
8. Click edit → modal opens with existing data
9. Drag image into upload zone → preview appears
10. Click save → campaign updated with cover image
11. Verify card now shows cover image
12. Verify detail page shows cover as hero
13. Click edit → existing cover shown
14. Click remove on image → image cleared
15. Save → cover image removed
16. Click back to dashboard
17. Click menu on card → delete option
18. Confirm delete → campaign removed

### 4. Authorization Tests

1. Create campaign as User A
2. Login as User B
3. Try to access User A's campaign via URL → 403
4. Try to update via API → 403
5. Try to delete via API → 403
6. Try to upload cover image via API → 403

### 5. Visual Verification

1. Dashboard matches layout mockups
2. Empty state is centered and styled correctly
3. Campaign cards have brutal shadow and paper texture
4. Cover images display correctly in cards (2:3 ratio)
5. Placeholder cards look good without cover
6. Modal has proper B/X styling
7. Image upload zone matches B/X aesthetic
8. Detail page hero displays cover correctly
9. All animations feel consistent with auth pages
10. Responsive layout works at all breakpoints

## Future Considerations

This spec establishes the Campaign entity as the container for all game content. Future specs will add:

- **Spec 005 (Maps):** Add `maps` relation to Campaign
- **Spec 006 (Encounters):** Add `encounters` relation to Campaign
- **Spec 007 (Sessions):** Add live session management with player invites
- **Campaign Settings:** Rule system selection, house rules, visibility options
- **Campaign Archiving:** Soft delete with restore capability

## References

- [PRD: Key Concepts - Campaign](/prd.md#key-concepts)
- [PRD: Flow 1 - DM Manages Campaigns](/prd.md#flow-1-dm-logs-in-and-manages-campaigns)
- [PRD: Flow 2 - DM Builds Campaign](/prd.md#flow-2-dm-builds-a-campaign-prep-mode)
- [Spec 002: Authentication](/specs/002-auth.md)
- [Spec 003: Email Verification](/specs/003-email.md)
