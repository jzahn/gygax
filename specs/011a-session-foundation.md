# Spec 011a: Session Foundation & WebSocket Infrastructure

## Goal

Establish the Session data model, REST API for session lifecycle management, and WebSocket server infrastructure. This creates the foundation for live game sessions — DMs can create sessions from adventures, and players can discover and join them based on access type (Open, Campaign, or Invite). WebSocket connections enable real-time presence tracking.

## Scope

### In Scope

- Session database model linked to adventures
- Session participant model (players in a session with their character)
- Session CRUD API endpoints
- Session access types (Open, Campaign, Invite)
- Campaign membership model and API
- Session invite model and API
- Session lifecycle (forming, active, paused, ended)
- WebSocket server setup with authentication
- WebSocket connection management (connect, disconnect, reconnect)
- Real-time presence events (player joined, player left)
- Session browsing for players (FORMING for all; ACTIVE for Campaign/Invite late-join)
- Adventure page "Start Session" button
- Adventure mode session list page

### Out of Scope

- Session game UI layout (map display, player sidebar) — spec 011b
- WebRTC voice chat — spec 011b
- Chat messages and dice rolling — spec 011c
- Fog of war — spec 011d
- DM map/backdrop switching during session — spec 011b
- Random encounters — future spec

## Dependencies

**Builds on:**
- Spec 002: Authentication (JWT, user context)
- Spec 004: Adventures (sessions belong to adventures)
- Spec 005: Campaigns (campaign membership for access control)
- Spec 006: Characters (players select a character when joining)

**New dependencies:**
- `@fastify/websocket` — WebSocket support for Fastify

## Detailed Requirements

### 1. Database Schema

**Session Model (prisma/schema.prisma):**

```prisma
model Session {
  id          String            @id @default(cuid())
  status      SessionStatus     @default(FORMING)
  accessType  SessionAccessType @default(OPEN)
  createdAt   DateTime          @default(now())
  updatedAt   DateTime          @updatedAt
  startedAt   DateTime?         // When DM started the session (FORMING → ACTIVE)
  pausedAt    DateTime?
  endedAt     DateTime?

  adventureId String
  adventure   Adventure     @relation(fields: [adventureId], references: [id], onDelete: Cascade)

  dmId        String
  dm          User          @relation("dm_sessions", fields: [dmId], references: [id], onDelete: Cascade)

  // Current display state
  activeMapId      String?
  activeBackdropId String?

  participants SessionParticipant[]
  invites      SessionInvite[]

  @@index([adventureId])
  @@index([dmId])
  @@index([status])
  @@index([accessType])
  @@map("sessions")
}

enum SessionStatus {
  FORMING  // DM is gathering players, session visible in browse lists
  ACTIVE   // Session is live, removed from browse lists
  PAUSED   // Session paused mid-game
  ENDED    // Session complete
}

enum SessionAccessType {
  OPEN      // Anyone can browse and join
  CAMPAIGN  // Campaign members have automatic access
  INVITE    // DM explicitly invites specific players
}

model SessionParticipant {
  id        String   @id @default(cuid())
  joinedAt  DateTime @default(now())
  leftAt    DateTime?

  sessionId   String
  session     Session   @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  userId      String
  user        User      @relation(fields: [userId], references: [id], onDelete: Cascade)

  characterId String
  character   Character @relation(fields: [characterId], references: [id], onDelete: Cascade)

  @@unique([sessionId, userId])
  @@index([sessionId])
  @@index([userId])
  @@map("session_participants")
}

model CampaignMember {
  id         String   @id @default(cuid())
  joinedAt   DateTime @default(now())

  campaignId String
  campaign   Campaign @relation(fields: [campaignId], references: [id], onDelete: Cascade)

  userId     String
  user       User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([campaignId, userId])
  @@index([campaignId])
  @@index([userId])
  @@map("campaign_members")
}

model SessionInvite {
  id         String    @id @default(cuid())
  createdAt  DateTime  @default(now())
  acceptedAt DateTime?
  declinedAt DateTime?

  sessionId  String
  session    Session   @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  userId     String?   // Existing user (if known)
  user       User?     @relation(fields: [userId], references: [id], onDelete: Cascade)

  email      String?   // Or invite by email (for users not yet registered)

  @@unique([sessionId, userId])
  @@unique([sessionId, email])
  @@index([sessionId])
  @@index([userId])
  @@index([email])
  @@map("session_invites")
}
```

**Update User Model:**

```prisma
model User {
  // ... existing fields
  dmSessions        Session[]             @relation("dm_sessions")
  participations    SessionParticipant[]
  campaignMembers   CampaignMember[]
  sessionInvites    SessionInvite[]
}
```

**Update Quest Model:**

```prisma
model Adventure {
  // ... existing fields
  sessions Session[]
}
```

**Update Campaign Model:**

```prisma
model Campaign {
  // ... existing fields
  members CampaignMember[]
}
```

**Update Character Model:**

```prisma
model Character {
  // ... existing fields
  participations SessionParticipant[]
}
```

**Migration:** `011a_sessions` creates the sessions, session_participants, campaign_members, and session_invites tables.

### 2. API Endpoints

All session endpoints require authentication.

#### POST /api/adventures/:adventureId/sessions

Start a new session from an adventure. Only the adventure owner (DM) can start sessions.

**Request:**
```json
{
  "accessType": "OPEN"  // Optional, defaults to OPEN. Values: "OPEN", "CAMPAIGN", "INVITE"
}
```

**Response (201):**
```json
{
  "session": {
    "id": "clx...",
    "status": "FORMING",
    "accessType": "OPEN",
    "adventureId": "clx...",
    "dmId": "clx...",
    "activeMapId": null,
    "activeBackdropId": null,
    "createdAt": "2026-01-27T12:00:00.000Z",
    "updatedAt": "2026-01-27T12:00:00.000Z",
    "startedAt": null,
    "pausedAt": null,
    "endedAt": null,
    "adventure": {
      "id": "clx...",
      "name": "The Keep on the Borderlands"
    },
    "dm": {
      "id": "clx...",
      "name": "Gary",
      "avatarUrl": null
    },
    "participants": [],
    "invites": []
  }
}
```

**Validation:**
- Adventure must exist and be owned by the authenticated user
- User's email must be verified
- Adventure must not already have a FORMING, ACTIVE, or PAUSED session (one live session per adventure at a time)

**Errors:**
- 401: Not authenticated
- 403: Email not verified OR not the adventure owner
- 404: Adventure not found
- 409: Adventure already has a forming/active/paused session

#### GET /api/sessions

List sessions. Behavior differs by context:

**Query params:**
- `adventureId` (optional): Filter to a specific adventure's sessions (DM view)
- `status` (optional): Filter by status (`FORMING`, `ACTIVE`, `PAUSED`, `ENDED`)
- `browse` (optional, boolean): If true, returns all joinable sessions across all adventures (player browse view)

**DM view** (with `adventureId`): Returns all sessions for that adventure, requires adventure ownership.

**Player browse view** (with `browse=true`): Returns joinable sessions the player can access, filtered by access type:
- **OPEN sessions:** Only FORMING OPEN sessions (strangers can't join mid-game)
- **CAMPAIGN sessions:** FORMING or ACTIVE CAMPAIGN sessions where player is a Campaign member (members can join late)
- **INVITE sessions:** FORMING or ACTIVE INVITE sessions where player has been invited (invitees can join late)

PAUSED sessions are not shown in browse lists (the game is on hold).

Results are sorted by access type: INVITE first, then CAMPAIGN, then OPEN. Within each type, sorted by creation date (newest first).

**Response (200):**
```json
{
  "sessions": [
    {
      "id": "clx...",
      "status": "ACTIVE",
      "accessType": "INVITE",
      "adventureId": "clx...",
      "createdAt": "2026-01-27T12:00:00.000Z",
      "adventure": {
        "id": "clx...",
        "name": "The Keep on the Borderlands"
      },
      "dm": {
        "id": "clx...",
        "name": "Gary",
        "avatarUrl": null
      },
      "participantCount": 3
    }
  ]
}
```

**Errors:**
- 401: Not authenticated
- 403: Email not verified (for adventureId filter, must own the adventure)

#### GET /api/sessions/:id

Get a single session with full details. Accessible to the DM or any participant.

**Response (200):**
```json
{
  "session": {
    "id": "clx...",
    "status": "ACTIVE",
    "accessType": "OPEN",
    "adventureId": "clx...",
    "dmId": "clx...",
    "activeMapId": null,
    "activeBackdropId": null,
    "createdAt": "2026-01-27T12:00:00.000Z",
    "updatedAt": "2026-01-27T12:00:00.000Z",
    "pausedAt": null,
    "endedAt": null,
    "adventure": {
      "id": "clx...",
      "name": "The Keep on the Borderlands"
    },
    "dm": {
      "id": "clx...",
      "name": "Gary",
      "avatarUrl": null
    },
    "participants": [
      {
        "id": "clx...",
        "joinedAt": "2026-01-27T12:05:00.000Z",
        "user": {
          "id": "clx...",
          "name": "Dave",
          "avatarUrl": null
        },
        "character": {
          "id": "clx...",
          "name": "Theron the Bold",
          "class": "Fighter",
          "level": 3,
          "hitPointsCurrent": 18,
          "hitPointsMax": 22,
          "armorClass": 4,
          "avatarUrl": null
        }
      }
    ]
  }
}
```

**Errors:**
- 401: Not authenticated
- 403: Not the DM or a participant of this session
- 404: Session not found

#### POST /api/sessions/:id/join

Join a session as a player with a selected character.

**Request:**
```json
{
  "characterId": "clx..."
}
```

**Response (200):**
```json
{
  "participant": {
    "id": "clx...",
    "joinedAt": "2026-01-27T12:05:00.000Z",
    "user": {
      "id": "clx...",
      "name": "Dave",
      "avatarUrl": null
    },
    "character": {
      "id": "clx...",
      "name": "Theron the Bold",
      "class": "Fighter",
      "level": 3
    }
  }
}
```

**Validation:**
- Session must be in a joinable state (see below)
- Character must be owned by the authenticated user
- User must not already be a participant in this session
- User must not be the DM of this session (DMs don't join their own session as players)
- Maximum 8 players per session
- User must have access based on session accessType:
  - OPEN: Anyone can join, but only during FORMING
  - CAMPAIGN: Must be a member of the adventure's campaign, can join during FORMING or ACTIVE
  - INVITE: Must have a SessionInvite record, can join during FORMING or ACTIVE

**Joinable states by access type:**
- OPEN sessions: FORMING only (strangers can't join mid-game)
- CAMPAIGN sessions: FORMING or ACTIVE (members can join late)
- INVITE sessions: FORMING or ACTIVE (invitees can join late)

**Errors:**
- 400: Missing characterId, or character not owned by user
- 401: Not authenticated
- 403: Cannot join own session as player, or no access (CAMPAIGN/INVITE restrictions)
- 404: Session not found, or character not found
- 409: Already a participant, or session is full (8 players)
- 410: Session is not in a joinable state (OPEN sessions must be FORMING; all sessions reject PAUSED/ENDED)

#### POST /api/sessions/:id/leave

Leave a session as a player.

**Response (200):**
```json
{
  "success": true
}
```

Sets `leftAt` on the participant record (soft delete — keeps history).

**Errors:**
- 401: Not authenticated
- 403: Not a participant of this session
- 404: Session not found

#### PATCH /api/sessions/:id

Update session state. DM only.

**Request:**
```json
{
  "status": "PAUSED"
}
```

Valid status transitions:
- FORMING → ACTIVE (sets `startedAt`, session removed from browse lists)
- FORMING → ENDED (cancel before starting)
- ACTIVE → PAUSED (sets `pausedAt`)
- ACTIVE → FORMING (re-open for more players, clears `startedAt`)
- PAUSED → ACTIVE (clears `pausedAt`)
- PAUSED → FORMING (re-open for more players, clears `startedAt` and `pausedAt`)
- ACTIVE → ENDED (sets `endedAt`)
- PAUSED → ENDED (sets `endedAt`)

Cannot transition from ENDED to any other status.

**Response (200):**
```json
{
  "session": { ... }
}
```

**Errors:**
- 400: Invalid status transition
- 401: Not authenticated
- 403: Not the DM of this session
- 404: Session not found

#### DELETE /api/sessions/:id

Delete a session permanently. DM only. Only ENDED sessions can be deleted.

**Response (200):**
```json
{
  "success": true
}
```

**Errors:**
- 400: Session is not ended (must end before deleting)
- 401: Not authenticated
- 403: Not the DM of this session
- 404: Session not found

### 4. Campaign Membership API

Campaign membership allows DMs to add players to their campaigns. Members have automatic access to CAMPAIGN-type sessions.

#### GET /api/campaigns/:campaignId/members

List all members of a campaign. Campaign owner only.

**Response (200):**
```json
{
  "members": [
    {
      "id": "clx...",
      "joinedAt": "2026-01-27T12:00:00.000Z",
      "user": {
        "id": "clx...",
        "name": "Dave",
        "email": "dave@example.com",
        "avatarUrl": null
      }
    }
  ]
}
```

**Errors:**
- 401: Not authenticated
- 403: Not the campaign owner
- 404: Campaign not found

#### POST /api/campaigns/:campaignId/members

Add a member to a campaign. Campaign owner only.

**Request:**
```json
{
  "email": "player@example.com"  // OR
  "userId": "clx..."             // One of email or userId required
}
```

**Response (201):**
```json
{
  "member": {
    "id": "clx...",
    "joinedAt": "2026-01-27T12:00:00.000Z",
    "user": {
      "id": "clx...",
      "name": "Dave",
      "email": "dave@example.com",
      "avatarUrl": null
    }
  }
}
```

**Validation:**
- If email provided, user must exist with that email
- User must not already be a member
- Cannot add campaign owner as a member (they're the DM)

**Errors:**
- 400: Neither email nor userId provided, or user not found
- 401: Not authenticated
- 403: Not the campaign owner
- 404: Campaign not found
- 409: User is already a member

#### DELETE /api/campaigns/:campaignId/members/:userId

Remove a member from a campaign. Campaign owner only.

**Response (200):**
```json
{
  "success": true
}
```

**Errors:**
- 401: Not authenticated
- 403: Not the campaign owner
- 404: Campaign or member not found

### 5. Session Invites API (for INVITE-type sessions)

Session invites allow DMs to explicitly invite players to INVITE-type sessions.

#### GET /api/sessions/:sessionId/invites

List all invites for a session. DM only.

**Response (200):**
```json
{
  "invites": [
    {
      "id": "clx...",
      "createdAt": "2026-01-27T12:00:00.000Z",
      "acceptedAt": null,
      "declinedAt": null,
      "user": {
        "id": "clx...",
        "name": "Dave",
        "email": "dave@example.com"
      },
      "email": null
    },
    {
      "id": "clx...",
      "createdAt": "2026-01-27T12:01:00.000Z",
      "acceptedAt": null,
      "declinedAt": null,
      "user": null,
      "email": "newplayer@example.com"
    }
  ]
}
```

**Errors:**
- 401: Not authenticated
- 403: Not the DM of this session
- 404: Session not found

#### POST /api/sessions/:sessionId/invites

Create an invite for a player. DM only. Only valid for INVITE-type sessions.

**Request:**
```json
{
  "email": "player@example.com"  // OR
  "userId": "clx..."             // One of email or userId required
}
```

**Response (201):**
```json
{
  "invite": {
    "id": "clx...",
    "createdAt": "2026-01-27T12:00:00.000Z",
    "acceptedAt": null,
    "declinedAt": null,
    "user": {
      "id": "clx...",
      "name": "Dave",
      "email": "dave@example.com"
    },
    "email": null
  }
}
```

**Validation:**
- Session must be INVITE type
- Cannot invite the DM
- Cannot invite someone who's already invited
- If userId provided, user must exist

**Errors:**
- 400: Neither email nor userId provided, or session is not INVITE type
- 401: Not authenticated
- 403: Not the DM of this session
- 404: Session not found, or user not found
- 409: User/email already invited

#### DELETE /api/sessions/:sessionId/invites/:inviteId

Remove an invite. DM only.

**Response (200):**
```json
{
  "success": true
}
```

**Errors:**
- 401: Not authenticated
- 403: Not the DM of this session
- 404: Session or invite not found

### 6. WebSocket Infrastructure

#### Server Setup

Register `@fastify/websocket` in the Fastify app. WebSocket connections are established at a single endpoint with session context.

**Connection endpoint:** `ws://localhost:3000/ws/sessions/:sessionId`

**Authentication:** The WebSocket connection must be authenticated. Since WebSocket upgrade requests can't easily carry httpOnly cookies in all browsers, use a token-based approach:

1. Client calls `POST /api/sessions/:id/ws-token` to get a short-lived token (30-second expiry)
2. Client connects to WebSocket with the token as a query parameter: `ws://localhost:3000/ws/sessions/:sessionId?token=xxx`
3. Server validates the token, associates the connection with the user and session
4. Token is single-use and expires after 30 seconds

**POST /api/sessions/:id/ws-token**

**Response (200):**
```json
{
  "token": "eyJ..."
}
```

**Errors:**
- 401: Not authenticated
- 403: Not the DM or a participant of this session
- 404: Session not found

#### Connection Management

**Server-side state** (in-memory, not persisted):

```typescript
interface ConnectedUser {
  userId: string
  userName: string
  avatarUrl: string | null
  role: 'dm' | 'player'
  characterId?: string    // Players only
  characterName?: string  // Players only
  socket: WebSocket
  connectedAt: Date
}

// Map of sessionId → Map of userId → ConnectedUser
const sessions: Map<string, Map<string, ConnectedUser>>
```

**Connection lifecycle:**
1. Client connects with valid token
2. Server adds user to session's connected users map
3. Server broadcasts `user:connected` to all other users in session
4. Server sends `session:state` to the connecting user (current session state, connected users)
5. On disconnect, server removes user from map and broadcasts `user:disconnected`
6. Client implements automatic reconnection with exponential backoff (1s, 2s, 4s, 8s, max 30s)

#### WebSocket Message Protocol

All messages are JSON with a `type` field and a `payload` field:

```typescript
interface WSMessage {
  type: string
  payload: Record<string, unknown>
}
```

**Server → Client messages:**

| Type | Payload | Description |
|------|---------|-------------|
| `session:state` | `{ session, connectedUsers }` | Full session state on connect |
| `session:updated` | `{ status, activeMapId, activeBackdropId, pausedAt, endedAt }` | Session state changed |
| `user:connected` | `{ userId, userName, avatarUrl, role, characterId?, characterName? }` | User joined the WebSocket |
| `user:disconnected` | `{ userId }` | User left the WebSocket |
| `participant:joined` | `{ participant }` | New player joined the session (REST + broadcast) |
| `participant:left` | `{ userId }` | Player left the session |
| `error` | `{ message }` | Error message |

**Client → Server messages:**

| Type | Payload | Description |
|------|---------|-------------|
| `ping` | `{}` | Keepalive ping |

The client doesn't send much in this spec — most actions go through REST endpoints which then broadcast via WebSocket. Future specs (011b, 011c) add more client→server messages for chat, map changes, etc.

**Server → Client (DM-only messages):**

| Type | Payload | Description |
|------|---------|-------------|
| `session:participant-count` | `{ count }` | Updated participant count (sent periodically or on change) |

#### Heartbeat / Keepalive

- Client sends `ping` every 30 seconds
- Server responds with WebSocket pong frame (built-in)
- If no ping received in 120 seconds, server closes the connection
- Client detects close and triggers reconnection

### 7. Type Definitions (shared/src/types.ts)

```typescript
// Session types
export type SessionStatus = 'FORMING' | 'ACTIVE' | 'PAUSED' | 'ENDED'
export type SessionAccessType = 'OPEN' | 'CAMPAIGN' | 'INVITE'

export interface Session {
  id: string
  status: SessionStatus
  accessType: SessionAccessType
  adventureId: string
  dmId: string
  activeMapId: string | null
  activeBackdropId: string | null
  createdAt: string
  updatedAt: string
  startedAt: string | null
  pausedAt: string | null
  endedAt: string | null
}

export interface SessionWithDetails extends Session {
  adventure: {
    id: string
    name: string
  }
  dm: {
    id: string
    name: string
    avatarUrl: string | null
  }
  participants: SessionParticipantWithDetails[]
  invites: SessionInviteWithDetails[]
}

export interface SessionListItem {
  id: string
  status: SessionStatus
  accessType: SessionAccessType
  adventureId: string
  createdAt: string
  adventure: {
    id: string
    name: string
  }
  dm: {
    id: string
    name: string
    avatarUrl: string | null
  }
  participantCount: number
}

export interface SessionParticipant {
  id: string
  sessionId: string
  userId: string
  characterId: string
  joinedAt: string
  leftAt: string | null
}

export interface SessionParticipantWithDetails extends SessionParticipant {
  user: {
    id: string
    name: string
    avatarUrl: string | null
  }
  character: {
    id: string
    name: string
    class: CharacterClass
    level: number
    hitPointsCurrent: number
    hitPointsMax: number
    armorClass: number
    avatarUrl: string | null
  }
}

// Campaign Membership types
export interface CampaignMember {
  id: string
  campaignId: string
  userId: string
  joinedAt: string
}

export interface CampaignMemberWithDetails extends CampaignMember {
  user: {
    id: string
    name: string
    email: string
    avatarUrl: string | null
  }
}

export interface CampaignMembersResponse {
  members: CampaignMemberWithDetails[]
}

export interface CampaignMemberResponse {
  member: CampaignMemberWithDetails
}

export interface AddCampaignMemberRequest {
  email?: string
  userId?: string
}

// Session Invite types
export interface SessionInvite {
  id: string
  sessionId: string
  userId: string | null
  email: string | null
  createdAt: string
  acceptedAt: string | null
  declinedAt: string | null
}

export interface SessionInviteWithDetails extends SessionInvite {
  user: {
    id: string
    name: string
    email: string
  } | null
}

export interface SessionInvitesResponse {
  invites: SessionInviteWithDetails[]
}

export interface SessionInviteResponse {
  invite: SessionInviteWithDetails
}

export interface CreateSessionInviteRequest {
  email?: string
  userId?: string
}

export interface CreateSessionRequest {
  accessType?: SessionAccessType
}

export interface SessionListResponse {
  sessions: SessionListItem[]
}

export interface SessionResponse {
  session: SessionWithDetails
}

export interface JoinSessionRequest {
  characterId: string
}

export interface SessionParticipantResponse {
  participant: SessionParticipantWithDetails
}

export interface UpdateSessionRequest {
  status?: SessionStatus
}

export interface WSTokenResponse {
  token: string
}

// WebSocket message types
export interface WSMessage<T = unknown> {
  type: string
  payload: T
}

export interface WSSessionState {
  session: SessionWithDetails
  connectedUsers: WSConnectedUser[]
}

export interface WSConnectedUser {
  userId: string
  userName: string
  avatarUrl: string | null
  role: 'dm' | 'player'
  characterId?: string
  characterName?: string
}

export interface WSUserConnected {
  userId: string
  userName: string
  avatarUrl: string | null
  role: 'dm' | 'player'
  characterId?: string
  characterName?: string
}

export interface WSUserDisconnected {
  userId: string
}

export interface WSSessionUpdated {
  status: SessionStatus
  activeMapId: string | null
  activeBackdropId: string | null
  pausedAt: string | null
  endedAt: string | null
}
```

### 8. Client Implementation

#### Entry Points: Top-Level Session Buttons

The primary entry points for sessions are prominent buttons in the page headers of both Forge and Adventure modes. These replace the redundant "New Campaign" and "New Character" buttons that duplicate functionality already available in section headers.

**Forge Dashboard (client/src/pages/DashboardPage.tsx)**

Replace the header "+ New Campaign" button with "Start Session":

```
┌─────────────────────────────────────────────────────┐
│  FORGE                             [Start Session]  │
│  Forge adventures or entire worlds...               │
├─────────────────────────────────────────────────────┤
```

Clicking "Start Session" opens a **StartSessionModal** that shows:

```
┌────────────────────────────────────────────────────────┐
│  START A SESSION                                   ✕   │
│  ══════════════════════════════════════════════════    │
│                                                        │
│  YOUR SESSIONS                                         │
│  ┌──────────────────────────────────────────────────┐  │
│  │  ○ The Keep on the Borderlands     [View]        │  │
│  │    FORMING • 2 players waiting                   │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  ● Tomb of Horrors                 [View]        │  │
│  │    ACTIVE • 3 players                            │  │
│  └──────────────────────────────────────────────────┘  │
│  ┌──────────────────────────────────────────────────┐  │
│  │  ◐ Caves of Chaos                  [View]        │  │
│  │    PAUSED • 2 players                            │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ──────────── OR CREATE NEW ────────────               │
│                                                        │
│  SELECT AN ADVENTURE                                   │
│  ┌──────────────────────────────────────────────────┐  │
│  │  Village of Hommlet                [Create]      │  │
│  │    Standalone                                    │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  (No adventures available)                             │
│  Create an adventure first to start a session.         │
└────────────────────────────────────────────────────────┘
```

**Status indicators:**
- ○ FORMING - gathering players (visible in browse lists)
- ● ACTIVE - session in progress
- ◐ PAUSED - session paused

- **Your Sessions**: Shows any FORMING/ACTIVE/PAUSED sessions the DM owns. "View" navigates to the session page.
- **Create New**: Lists adventures that don't have an existing session. Clicking "Create" opens the access type selection modal, then creates a FORMING session.

**Quest Mode Page (client/src/pages/AdventureModePage.tsx)**

Replace the header "+ New Character" button with "Join Session":

```
┌─────────────────────────────────────────────────────┐
│  ADVENTURE                           [Join Session]  │
│  Create characters and embark on epic quests...      │
├─────────────────────────────────────────────────────┤
```

Clicking "Join Session" opens a **JoinSessionModal** that shows available sessions:

```
┌────────────────────────────────────────────────────────┐
│  JOIN A SESSION                                    ✕   │
│  ══════════════════════════════════════════════════    │
│                                                        │
│  AVAILABLE SESSIONS                                    │
│  (Sorted: Invited → Campaign → Open)                   │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  🔒 Invite  ● ACTIVE                              │  │
│  │  The Keep on the Borderlands                     │  │
│  │  DM: Gary • 3 players              [JOIN]        │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  👥 Campaign  ○ FORMING                           │  │
│  │  Tomb of the Serpent Kings                       │  │
│  │  DM: Erol • 1 player               [JOIN]        │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  ┌──────────────────────────────────────────────────┐  │
│  │  🌐 Open  ○ FORMING                               │  │
│  │  Caves of Chaos                                  │  │
│  │  DM: Mike • 0 players              [JOIN]        │  │
│  └──────────────────────────────────────────────────┘  │
│                                                        │
│  (No sessions available)                               │
│  No quests await... check back later.                  │
└────────────────────────────────────────────────────────┘
```

**Note:** Invite and Campaign sessions show both FORMING and ACTIVE states (late join allowed). Open sessions only show FORMING (must join before the session starts).

The modal includes the join flow: session browsing and character selection.

**Note:** The `/adventure/sessions` route (SessionBrowsePage) still exists for direct navigation, but the modal provides quick access without leaving the current page.

#### Adventure Page Updates (client/src/pages/AdventurePage.tsx)

Add a "Start Session" button to the adventure detail page. Only visible to the adventure owner.

**Button placement:** In the adventure header area, next to existing edit controls.

```
┌─────────────────────────────────────────────────────┐
│  [Hero/Header - existing]                           │
│                            [Create Session] [Edit]  │
├─────────────────────────────────────────────────────┤
│  ...existing content...                             │
```

**Behavior:**
- If no session exists: button says "CREATE SESSION", clicking opens access type selection, then creates a FORMING session and navigates to `/sessions/:id`
- If a FORMING session exists: button says "VIEW SESSION", clicking navigates to existing session (lobby)
- If an ACTIVE session exists: button says "RESUME SESSION", clicking navigates to existing session
- If a PAUSED session exists: button says "RETURN TO SESSION", clicking navigates to existing session

#### Quest Mode Session List (client/src/pages/SessionBrowsePage.tsx)

**Route:** `/adventure/sessions`

A page where players can browse joinable sessions they have access to.

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  FIND A SESSION                                     │
│  ═══════════════════════════════════════════════    │
│                                                     │
│  AVAILABLE SESSIONS                                 │
│  (Sorted: Invited → Campaign → Open)                │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  🔒 Invite  ● ACTIVE                         │    │
│  │  The Keep on the Borderlands                │    │
│  │  DM: Gary • 3 players            [JOIN]      │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  👥 Campaign  ○ FORMING                      │    │
│  │  Tomb of the Serpent Kings                  │    │
│  │  DM: Erol • 1 player             [JOIN]      │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  🌐 Open  ○ FORMING                          │    │
│  │  Caves of Chaos                             │    │
│  │  DM: Mike • 0 players            [JOIN]      │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  (No sessions available)                            │
│  No quests await... check back later.               │
└─────────────────────────────────────────────────────┘
```

**Note:** Invite and Campaign sessions can be joined during FORMING or ACTIVE (late join). Open sessions can only be joined during FORMING.

**Sorting Logic:**
Sessions are automatically sorted by access type priority:
1. **INVITE** sessions first (you were specifically invited)
2. **CAMPAIGN** sessions second (you're a campaign member)
3. **OPEN** sessions last (available to everyone)

Within each group, sessions are sorted by creation date (newest first).

**Join flow:**
1. Player clicks JOIN on a session
2. If player has no characters → show message: "You need a character to join. Create one first." with link to character creation
3. If player has one character → auto-select it, show confirmation
4. If player has multiple characters → show character selection modal
5. After character selected → call POST /api/sessions/:id/join → navigate to `/sessions/:id`

#### Character Selection Modal (client/src/components/SelectCharacterModal.tsx)

**Title:** "CHOOSE YOUR ADVENTURER"

```
┌────────────────────────────────────────────┐
│  CHOOSE YOUR ADVENTURER                ✕   │
│  ══════════════════════════════════════    │
│                                            │
│  ┌────────┐  ┌────────┐  ┌────────┐        │
│  │ Avatar │  │ Avatar │  │ Avatar │        │
│  │ Theron │  │ Elara  │  │ Bodo   │        │
│  │ Ftr 3  │  │ M-U 2  │  │ Hlf 1  │        │
│  └────────┘  └────────┘  └────────┘        │
│                                            │
│  Selected: Theron the Bold                 │
│                                            │
│              [Cancel]  [JOIN SESSION]       │
└────────────────────────────────────────────┘
```

Displays the player's characters as selectable cards. Clicking one selects it, then "JOIN SESSION" confirms.

#### SessionTypeChip Component (client/src/components/SessionTypeChip.tsx)

A small chip/badge that indicates the session access type. Used in session lists to help players understand their access.

```
┌─────────────────────┐
│ 🔒 Invite           │  - Lock icon, for sessions you're specifically invited to
└─────────────────────┘

┌─────────────────────┐
│ 👥 Campaign         │  - Users icon, for sessions in a campaign you belong to
└─────────────────────┘

┌─────────────────────┐
│ 🌐 Open             │  - Globe icon, for public sessions anyone can join
└─────────────────────┘
```

**Styling:**
- Small pill/badge shape
- Subtle background color to differentiate:
  - Invite: Light amber/gold background (stands out as "special")
  - Campaign: Light blue background
  - Open: Light gray background
- Black text and icon

**Props:**
```typescript
interface SessionTypeChipProps {
  accessType: SessionAccessType
}
```

#### Start Session Flow Updates (AdventurePage.tsx)

When DM clicks "Start Session", show a modal to select access type:

```
┌────────────────────────────────────────────┐
│  START NEW SESSION                     ✕   │
│  ══════════════════════════════════════    │
│                                            │
│  Who can join this session?                │
│                                            │
│  ○ Open                                    │
│    Anyone can browse and join              │
│                                            │
│  ○ Campaign Members                        │
│    Only members of "Greyhawk" can join     │
│                                            │
│  ○ Invite Only                             │
│    You'll invite specific players          │
│                                            │
│              [Cancel]  [START SESSION]      │
└────────────────────────────────────────────┘
```

#### Campaign Members Section (CampaignPage.tsx)

Add a "Members" section to the Campaign detail page where DMs can manage who belongs to their campaign.

```
┌─────────────────────────────────────────────────────┐
│  MEMBERS                              [Add Member]  │
│  ─────────────────────────────────────────────      │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ 👤 Dave the Brave                           │    │
│  │   dave@example.com              [Remove]    │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ 👤 Sarah Spellslinger                       │    │
│  │   sarah@example.com             [Remove]    │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  (Campaign members can join any Campaign-type       │
│   sessions in this campaign automatically)          │
└─────────────────────────────────────────────────────┘
```

**Add Member Modal:**
```
┌────────────────────────────────────────────┐
│  ADD CAMPAIGN MEMBER                   ✕   │
│  ══════════════════════════════════════    │
│                                            │
│  Enter player's email address:             │
│  ┌──────────────────────────────────┐      │
│  │ player@example.com               │      │
│  └──────────────────────────────────┘      │
│                                            │
│              [Cancel]  [ADD MEMBER]         │
└────────────────────────────────────────────┘
```

#### Session Page Placeholder (client/src/pages/SessionPage.tsx)

**Route:** `/sessions/:id`

For this spec, the session page is a minimal view showing:
- Session status (forming/active/paused) and access type
- Connected users list (participants who have joined)
- DM controls vary by state:
  - FORMING: Start Session, Cancel Session
  - ACTIVE: Pause, Re-open (back to FORMING), End Session
  - PAUSED: Resume, Re-open (back to FORMING), End Session
- Player: Leave session button

The full game UI (map, chat, player cards sidebar) is spec 011b.

**DM View — FORMING (Lobby):**
```
┌─────────────────────────────────────────────────────┐
│  ← Back to Adventure    SESSION: The Keep on the... │
├─────────────────────────────────────────────────────┤
│                                                     │
│  STATUS: ○ FORMING         ACCESS: 🔒 Invite        │
│  Waiting for players to join...                     │
│                                                     │
│  PLAYERS (2/8)                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ ★ Gary (DM)                          ● Online│   │
│  │   Dave — Theron the Bold (Ftr 3)     ● Online│   │
│  │   Sarah — Elara (M-U 2)             ● Online│   │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  [Start Session]  [Cancel]                          │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**DM View — ACTIVE:**
```
┌─────────────────────────────────────────────────────┐
│  ← Back to Adventure    SESSION: The Keep on the... │
├─────────────────────────────────────────────────────┤
│                                                     │
│  STATUS: ● ACTIVE          ACCESS: 🔒 Invite        │
│                                                     │
│  PLAYERS (2/8)                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ ★ Gary (DM)                          ● Online│   │
│  │   Dave — Theron the Bold (Ftr 3)     ● Online│   │
│  │   Sarah — Elara (M-U 2)             ○ Away  │   │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  [Pause]  [Re-open]  [End Session]                  │
│                                                     │
└─────────────────────────────────────────────────────┘
```

"Re-open" moves the session back to FORMING state so more players can join (useful if someone drops out mid-session).

**Player View — FORMING (Waiting):**
```
┌─────────────────────────────────────────────────────┐
│  ← Back to Sessions    SESSION: The Keep on the...  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Playing as: Theron the Bold (Fighter, Level 3)     │
│                                                     │
│  STATUS: ○ FORMING                                  │
│  Waiting for the DM to start the session...         │
│                                                     │
│  PLAYERS (2/8)                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ ★ Gary (DM)                          ● Online│   │
│  │   Dave — Theron the Bold (Ftr 3)     ● Online│   │
│  │   Sarah — Elara (M-U 2)             ● Online│   │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  [Leave Session]                                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Player View — ACTIVE:**
```
┌─────────────────────────────────────────────────────┐
│  ← Back to Sessions    SESSION: The Keep on the...  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Playing as: Theron the Bold (Fighter, Level 3)     │
│                                                     │
│  PLAYERS (2/8)                                      │
│  ┌─────────────────────────────────────────────┐    │
│  │ ★ Gary (DM)                          ● Online│   │
│  │   Dave — Theron the Bold (Ftr 3)     ● Online│   │
│  │   Sarah — Elara (M-U 2)             ● Online│   │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  [Leave Session]                                    │
│                                                     │
└─────────────────────────────────────────────────────┘
```

### 9. WebSocket Client Hook (client/src/hooks/useSessionSocket.ts)

A React hook managing the WebSocket connection for a session.

```typescript
interface UseSessionSocketOptions {
  sessionId: string
  enabled?: boolean
}

interface UseSessionSocketReturn {
  isConnected: boolean
  connectedUsers: WSConnectedUser[]
  sessionState: WSSessionState | null
  lastMessage: WSMessage | null
}
```

**Behavior:**
1. On mount (if enabled), fetch a WS token via REST
2. Connect to WebSocket with token
3. Handle incoming messages, update state
4. Auto-reconnect on disconnect with exponential backoff
5. Send ping every 30 seconds
6. Clean up on unmount

### 10. Routing Updates

**client/src/App.tsx:**

```tsx
<Route path="/adventure/sessions" element={<ProtectedRoute><SessionBrowsePage /></ProtectedRoute>} />
<Route path="/sessions/:id" element={<ProtectedRoute><SessionPage /></ProtectedRoute>} />
```

**Navigation:** Add "Sessions" link in the Adventure mode nav area, linking to `/adventure/sessions`.

### 11. Project Structure Updates

**New Files:**
```
server/src/routes/sessions.ts              # Session REST endpoints
server/src/routes/campaignMembers.ts       # Campaign membership endpoints
server/src/routes/sessionInvites.ts        # Session invite endpoints
server/src/websocket/index.ts              # WebSocket server setup
server/src/websocket/sessionManager.ts     # In-memory session/connection state
server/src/websocket/handlers.ts           # WebSocket message handlers
client/src/pages/SessionBrowsePage.tsx     # Player session browser (also used in JoinSessionModal)
client/src/pages/SessionPage.tsx           # Session view (placeholder for 011b)
client/src/pages/CampaignMembersPage.tsx   # Campaign member management (or section in CampaignPage)
client/src/components/StartSessionModal.tsx # Forge: DM picks adventure or resumes session
client/src/components/JoinSessionModal.tsx # Adventure: Player browses/joins sessions
client/src/components/SelectCharacterModal.tsx  # Character picker for joining
client/src/components/SessionTypeChip.tsx  # Access type indicator chip
client/src/components/InvitePlayerModal.tsx # Modal to invite players to INVITE sessions
client/src/hooks/useSessionSocket.ts       # WebSocket connection hook
```

**Modified Files:**
```
prisma/schema.prisma                       # Add Session, SessionParticipant, CampaignMember, SessionInvite models
shared/src/types.ts                        # Add session, membership, invite, and WebSocket types
server/src/app.ts                          # Register session routes + WebSocket
client/src/App.tsx                         # Add session routes
client/src/pages/DashboardPage.tsx         # Replace "+ New Campaign" header button with "Start Session"
client/src/pages/AdventureModePage.tsx     # Replace "+ New Character" header button with "Join Session"
client/src/pages/AdventurePage.tsx         # Add Start/Resume Session button with access type selection
client/src/pages/CampaignPage.tsx          # Add Members section for managing campaign membership
client/src/pages/index.ts                  # Export new pages
client/src/components/index.ts             # Export new components
```

## Design Details

### Session Card Aesthetic

Session cards in the browse list follow the B/X aesthetic:
- Parchment background with thick black border (3px)
- Bold shadow offset
- Adventure name in display font (all caps)
- DM name and player count in body font
- Access type chip (SessionTypeChip) in top corner
- JOIN button uses standard neobrutalism button style

### Status Indicators

**Session status:**
- **Forming:** Empty circle ○ (gathering players, visible in browse lists)
- **Active:** Filled black circle ●
- **Paused:** Half-filled circle ◐

**Connection status:**
- **Online (connected via WS):** Green dot (one of the rare uses of color per the design system — connection status is important)
- **Offline (not connected):** Gray empty circle

## Acceptance Criteria

### Database
- [ ] Session model created with all fields including accessType
- [ ] SessionParticipant model created
- [ ] CampaignMember model created
- [ ] SessionInvite model created
- [ ] Session-Adventure relationship established
- [ ] Session-User (DM) relationship established
- [ ] SessionParticipant-User and SessionParticipant-Character relationships work
- [ ] CampaignMember-Campaign and CampaignMember-User relationships work
- [ ] SessionInvite-Session and SessionInvite-User relationships work
- [ ] Cascade delete removes sessions when adventure deleted
- [ ] Cascade delete removes campaign members when campaign deleted
- [ ] Cascade delete removes session invites when session deleted
- [ ] Unique constraint on (sessionId, userId) for participants
- [ ] Unique constraint on (campaignId, userId) for campaign members
- [ ] Unique constraints on (sessionId, userId) and (sessionId, email) for invites

### API - Sessions
- [ ] POST /api/adventures/:id/sessions creates a session with accessType
- [ ] POST returns 409 if adventure already has forming/active/paused session
- [ ] GET /api/sessions?adventureId=x returns sessions for that adventure
- [ ] GET /api/sessions?browse=true returns sessions filtered by access type (OPEN, CAMPAIGN membership, INVITE)
- [ ] GET /api/sessions?browse=true sorts results: INVITE → CAMPAIGN → OPEN
- [ ] GET /api/sessions/:id returns full session details
- [ ] GET /api/sessions/:id returns 403 for unauthorized users
- [ ] POST /api/sessions/:id/join adds player with character
- [ ] POST /api/sessions/:id/join validates character ownership
- [ ] POST /api/sessions/:id/join validates access based on accessType
- [ ] POST /api/sessions/:id/join rejects if session full (8 players)
- [ ] POST /api/sessions/:id/join rejects DM joining own session
- [ ] POST /api/sessions/:id/leave soft-deletes participant
- [ ] PATCH /api/sessions/:id updates status (DM only)
- [ ] PATCH validates status transitions
- [ ] DELETE /api/sessions/:id deletes ended sessions only
- [ ] POST /api/sessions/:id/ws-token returns short-lived token

### API - Campaign Membership
- [ ] GET /api/campaigns/:id/members lists campaign members (owner only)
- [ ] POST /api/campaigns/:id/members adds member by email or userId
- [ ] POST validates user exists and is not already a member
- [ ] DELETE /api/campaigns/:id/members/:userId removes member

### API - Session Invites
- [ ] GET /api/sessions/:id/invites lists invites (DM only)
- [ ] POST /api/sessions/:id/invites creates invite (INVITE sessions only)
- [ ] POST validates session is INVITE type
- [ ] DELETE /api/sessions/:id/invites/:inviteId removes invite

### WebSocket
- [ ] WebSocket server starts with Fastify
- [ ] Token-based authentication works
- [ ] User added to session on connect
- [ ] `session:state` sent to connecting user
- [ ] `user:connected` broadcast on join
- [ ] `user:disconnected` broadcast on leave
- [ ] `session:updated` broadcast when session state changes
- [ ] Ping/pong keepalive works
- [ ] Stale connections cleaned up after 120s no ping
- [ ] Multiple users in same session receive each other's events

### Client - Entry Points
- [ ] Forge dashboard header button changed from "+ New Campaign" to "Start Session"
- [ ] StartSessionModal opens showing FORMING/ACTIVE/PAUSED sessions + adventures to create from
- [ ] DM can view any of their sessions from StartSessionModal
- [ ] DM can create new FORMING session from any available adventure
- [ ] Adventure mode header button changed from "+ New Character" to "Join Session"
- [ ] JoinSessionModal opens showing browsable FORMING sessions
- [ ] Player can join from browse list in JoinSessionModal

### Client - Session Management
- [ ] Adventure page shows Create/View Session button based on existing session state
- [ ] Create Session flow allows selecting access type (Open, Campaign, Invite)
- [ ] Session browse page lists joinable sessions: FORMING for all types, plus ACTIVE for CAMPAIGN/INVITE
- [ ] Session browse page sorts sessions: Invite → Campaign → Open
- [ ] SessionTypeChip displays correct icon and label for each access type
- [ ] Character selection modal appears for multi-character players
- [ ] Session page shows connected users in real-time
- [ ] Session page shows status (FORMING/ACTIVE/PAUSED) and access type
- [ ] DM can start session (FORMING → ACTIVE)
- [ ] DM can pause session (ACTIVE → PAUSED)
- [ ] DM can resume session (PAUSED → ACTIVE)
- [ ] DM can re-open session for more players (ACTIVE/PAUSED → FORMING)
- [ ] DM can end/cancel session
- [ ] Player can leave session
- [ ] WebSocket auto-reconnects on disconnect
- [ ] Campaign page shows Members section (owner only)
- [ ] DM can add members to campaign by email
- [ ] DM can remove members from campaign
- [ ] DM can invite players to INVITE sessions
- [ ] DM can remove invites from INVITE sessions

### Visual Design
- [ ] Session cards match B/X aesthetic
- [ ] SessionTypeChip differentiates access types visually (icon + subtle background color)
- [ ] Status indicators visible and clear
- [ ] Typography follows design system
- [ ] Animations consistent with existing UI

## Verification Steps

### 1. Entry Point Buttons

**Forge Dashboard:**
1. Login as DM, navigate to Forge dashboard
2. Verify header button says "Start Session" (not "+ New Campaign")
3. Click "Start Session" → StartSessionModal opens
4. Verify modal shows any FORMING/ACTIVE/PAUSED sessions (if any)
5. Verify modal lists adventures available to create new sessions from
6. Click "Create" on an adventure → access type selection appears
7. Close modal, verify campaign section still has "+ New Campaign" button

**Quest Mode:**
1. Switch to Adventure mode
2. Verify header button says "Join Session" (not "+ New Character")
3. Click "Join Session" → JoinSessionModal opens
4. Verify modal shows joinable sessions (FORMING for all, plus ACTIVE for CAMPAIGN/INVITE types)
5. Close modal, verify characters section still has "+ New Character" button

### 2. Session Lifecycle (OPEN session)

1. Login as DM, click "Start Session" on Forge dashboard
2. Select an adventure, then select "Open" access type
3. Session created in FORMING state, redirected to session page
4. Verify session shows ○ FORMING status and 🌐 Open access type
5. Open incognito window, login as player
6. Navigate to Adventure > Sessions (or use Join Session button)
7. Verify the FORMING session appears in the browse list with 🌐 Open chip
8. Click JOIN, select character → join session
9. Verify DM's session page shows player in the players list
10. DM clicks "Start Session" → status changes to ● ACTIVE
11. Player's view updates to show session is now active
12. Verify OPEN session NO LONGER appears in browse list (OPEN = FORMING only)
13. New player cannot join an ACTIVE OPEN session (would need to wait for re-open)
14. DM clicks Pause → status changes to ◐ PAUSED
15. DM clicks Resume → status back to ● ACTIVE
16. DM clicks "Re-open" → status back to ○ FORMING (session reappears in browse list)
17. Player clicks Leave → removed from participant list
18. DM clicks End Session → session ended

### 3. Campaign Membership Flow (late join)

1. Login as DM, navigate to a campaign
2. Click "Add Member" in the Members section
3. Enter player's email → member added
4. Verify member appears in the members list
5. DM creates a CAMPAIGN-type session from an adventure in that campaign (FORMING state)
6. DM starts the session (FORMING → ACTIVE)
7. Open incognito window, login as the campaign member (late arrival)
8. Navigate to Adventure > Sessions
9. Player sees the ACTIVE session with 👥 Campaign chip (campaign members can join late!)
10. Player joins the ACTIVE session successfully
11. Verify DM's session page shows the late player connected
12. DM removes player from campaign members
13. If player leaves and tries to rejoin, they can no longer see/join the session

### 4. Session Invite Flow (late join)

1. Login as DM, navigate to an adventure
2. Click "Start Session" → select "Invite Only" access type
3. Session created in FORMING state, DM sees invite management UI
4. DM clicks "Invite Player" → enters player's email
5. Invite created and shown in invites list
6. DM starts the session (FORMING → ACTIVE)
7. Open incognito window, login as invited player (late arrival)
8. Navigate to Adventure > Sessions
9. Player sees ACTIVE session with 🔒 Invite chip (invitees can join late!)
10. Player joins the ACTIVE session successfully
11. Login as different player (not invited)
12. Navigate to Adventure > Sessions
13. This player does NOT see the INVITE session (not invited)
14. DM removes invite from the first player
15. If that player leaves and tries to rejoin, they can no longer see/join the session

### 5. Session List Sorting & Late Join

1. Create sessions with different access types and states:
   - OPEN session in FORMING state
   - OPEN session in ACTIVE state
   - CAMPAIGN session in ACTIVE state
   - INVITE session in ACTIVE state
2. Login as a player who is: invited to one, campaign member of another, and can see open ones
3. Navigate to Adventure > Sessions
4. Verify OPEN ACTIVE session does NOT appear (OPEN = FORMING only)
5. Verify CAMPAIGN ACTIVE session DOES appear (members can join late)
6. Verify INVITE ACTIVE session DOES appear (invitees can join late)
7. Verify order: Invite sessions first, Campaign sessions second, Open sessions last
8. Within each group, verify newest sessions appear first

### 6. WebSocket Tests

1. DM creates session (FORMING), opens session page
2. Player joins session, opens session page
3. Verify both see each other as "Online"
4. Player refreshes page → reconnects, still shows online
5. Player closes tab → DM sees player go offline
6. Player reopens → auto-reconnects, DM sees them online again
7. DM pauses session → player sees status update in real-time

### 7. Edge Cases

1. Try to create session when one already exists (FORMING/ACTIVE/PAUSED) → 409 error
2. Try to join with someone else's character → 400 error
3. Try to join as DM of the session → 403 error
4. Try to join when session is full (8 players) → 409 error
5. Try to join PAUSED or ENDED session → 410 error
6. Try to join ACTIVE OPEN session → 410 error (OPEN = FORMING only)
7. Try to join ACTIVE CAMPAIGN session as non-member → 403 error
8. Try to join ACTIVE INVITE session without invite → 403 error
9. Join ACTIVE CAMPAIGN session as member → succeeds (late join allowed)
10. Join ACTIVE INVITE session with invite → succeeds (late join allowed)
11. Delete adventure with session → cascade deletes session
12. Delete campaign → cascade deletes campaign members
13. Two players join simultaneously → both succeed, both see each other

### 8. Authorization Tests

1. Non-owner tries to start session on someone else's adventure → 403
2. Non-participant tries to GET session details → 403
3. Player tries to pause/end session → 403
4. Player tries to delete session → 403
5. Non-participant tries to get WS token → 403
6. Non-owner tries to add/remove campaign members → 403
7. Non-DM tries to create/remove session invites → 403
8. Try to invite to non-INVITE session → 400

## Future Considerations

This spec establishes infrastructure for:
- **Spec 011b:** Session game view UI, DM controls (map/backdrop switching), WebRTC voice
- **Spec 011c:** Chat messages and dice rolling over WebSocket
- **Spec 011d:** Fog of war state management per session/map

The WebSocket message protocol is extensible — new message types can be added without breaking existing connections. The `sessionManager` module will be extended in 011b and 011c to handle additional message types.

## References

- [PRD: Flow 4 - DM Starts Session](/prd.md#flow-4-dm-starts-a-live-game-session)
- [PRD: Flow 6 - Player Joins Session](/prd.md#flow-6-player-browses-and-joins-a-session)
- [PRD: Session Requirements (28-40)](/prd.md#live-sessions)
- [Spec 002: Auth System](/specs/002-auth.md)
- [Spec 004: Adventures](/specs/004-adventures.md)
- [Spec 006: Characters](/specs/006-characters.md)
