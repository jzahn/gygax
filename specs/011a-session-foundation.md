# Spec 011a: Session Foundation & WebSocket Infrastructure

## Goal

Establish the Session data model, REST API for session lifecycle management, and WebSocket server infrastructure. This creates the foundation for live game sessions — DMs can create sessions from adventures, generate join codes, and players can discover and join them. WebSocket connections enable real-time presence tracking.

## Scope

### In Scope

- Session database model linked to adventures
- Session participant model (players in a session with their character)
- Session CRUD API endpoints
- Join code generation and redemption
- Session lifecycle (active, paused, ended)
- WebSocket server setup with authentication
- WebSocket connection management (connect, disconnect, reconnect)
- Real-time presence events (player joined, player left)
- Session browsing for players (active sessions list)
- Adventure page "Start Session" button
- Adventure mode session list page

### Out of Scope

- Session game UI layout (map display, player sidebar) — spec 011b
- WebRTC voice chat — spec 011b
- Chat messages and dice rolling — spec 011c
- Fog of war — spec 012
- DM map/backdrop switching during session — spec 011b
- Random encounters — future spec

## Dependencies

**Builds on:**
- Spec 002: Authentication (JWT, user context)
- Spec 004: Adventures (sessions belong to adventures)
- Spec 006: Characters (players select a character when joining)

**New dependencies:**
- `@fastify/websocket` — WebSocket support for Fastify
- `nanoid` — Short, URL-safe join code generation

## Detailed Requirements

### 1. Database Schema

**Session Model (prisma/schema.prisma):**

```prisma
model Session {
  id          String        @id @default(cuid())
  joinCode    String        @unique
  status      SessionStatus @default(ACTIVE)
  createdAt   DateTime      @default(now())
  updatedAt   DateTime      @updatedAt
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

  @@index([adventureId])
  @@index([dmId])
  @@index([status])
  @@index([joinCode])
  @@map("sessions")
}

enum SessionStatus {
  ACTIVE
  PAUSED
  ENDED
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
```

**Update User Model:**

```prisma
model User {
  // ... existing fields
  dmSessions     Session[]             @relation("dm_sessions")
  participations SessionParticipant[]
}
```

**Update Adventure Model:**

```prisma
model Adventure {
  // ... existing fields
  sessions Session[]
}
```

**Update Character Model:**

```prisma
model Character {
  // ... existing fields
  participations SessionParticipant[]
}
```

**Migration:** `011a_sessions` creates the sessions and session_participants tables.

### 2. Join Code Generation

Join codes are short, human-readable codes that players use to find and join sessions. They should be easy to read aloud over voice chat.

- Format: 6 uppercase alphanumeric characters (e.g., `K7X9M2`)
- Alphabet: `ABCDEFGHJKLMNPQRSTUVWXYZ23456789` (no 0/O/1/I/l to avoid confusion)
- Generated using `nanoid` with custom alphabet
- Unique constraint in database prevents collisions
- Retry on collision (up to 3 attempts)

### 3. API Endpoints

All session endpoints require authentication.

#### POST /api/adventures/:adventureId/sessions

Start a new session from an adventure. Only the adventure owner (DM) can start sessions.

**Request:** (no body required)

**Response (201):**
```json
{
  "session": {
    "id": "clx...",
    "joinCode": "K7X9M2",
    "status": "ACTIVE",
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
    "participants": []
  }
}
```

**Validation:**
- Adventure must exist and be owned by the authenticated user
- User's email must be verified
- Adventure must not already have an ACTIVE or PAUSED session (one live session per adventure at a time)

**Errors:**
- 401: Not authenticated
- 403: Email not verified OR not the adventure owner
- 404: Adventure not found
- 409: Adventure already has an active/paused session

#### GET /api/sessions

List sessions. Behavior differs by context:

**Query params:**
- `adventureId` (optional): Filter to a specific adventure's sessions (DM view)
- `status` (optional): Filter by status (`ACTIVE`, `PAUSED`, `ENDED`)
- `browse` (optional, boolean): If true, returns all joinable sessions across all adventures (player browse view)

**DM view** (with `adventureId`): Returns all sessions for that adventure, requires adventure ownership.

**Player browse view** (with `browse=true`): Returns all ACTIVE sessions the player can join (not their own adventures). Includes adventure name and DM name for discovery.

**Response (200):**
```json
{
  "sessions": [
    {
      "id": "clx...",
      "joinCode": "K7X9M2",
      "status": "ACTIVE",
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
    "joinCode": "K7X9M2",
    "status": "ACTIVE",
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

#### GET /api/sessions/join/:joinCode

Look up a session by join code. Used by players to preview a session before joining.

**Response (200):**
```json
{
  "session": {
    "id": "clx...",
    "joinCode": "K7X9M2",
    "status": "ACTIVE",
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
}
```

**Errors:**
- 401: Not authenticated
- 404: No active session with that join code
- 410: Session is paused or ended

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
- Session must be ACTIVE
- Character must be owned by the authenticated user
- User must not already be a participant in this session
- User must not be the DM of this session (DMs don't join their own session as players)
- Maximum 8 players per session

**Errors:**
- 400: Missing characterId, or character not owned by user
- 401: Not authenticated
- 403: Cannot join own session as player
- 404: Session not found, or character not found
- 409: Already a participant, or session is full (8 players)
- 410: Session is paused or ended

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
- ACTIVE → PAUSED (sets `pausedAt`)
- PAUSED → ACTIVE (clears `pausedAt`)
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

### 4. WebSocket Infrastructure

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
- If no ping received in 60 seconds, server closes the connection
- Client detects close and triggers reconnection

### 5. Type Definitions (shared/src/types.ts)

```typescript
// Session types
export type SessionStatus = 'ACTIVE' | 'PAUSED' | 'ENDED'

export interface Session {
  id: string
  joinCode: string
  status: SessionStatus
  adventureId: string
  dmId: string
  activeMapId: string | null
  activeBackdropId: string | null
  createdAt: string
  updatedAt: string
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
}

export interface SessionListItem {
  id: string
  joinCode: string
  status: SessionStatus
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

### 6. Client Implementation

#### Adventure Page Updates (client/src/pages/AdventurePage.tsx)

Add a "Start Session" button to the adventure detail page. Only visible to the adventure owner.

**Button placement:** In the adventure header area, next to existing edit controls.

```
┌─────────────────────────────────────────────────────┐
│  [Hero/Header - existing]                           │
│                              [Start Session] [Edit]  │
├─────────────────────────────────────────────────────┤
│  ...existing content...                             │
```

**Behavior:**
- If no active/paused session exists: button says "START SESSION", clicking creates a new session and navigates to `/sessions/:id`
- If an active/paused session exists: button says "RESUME SESSION" (active) or "RETURN TO SESSION" (paused), clicking navigates to existing session

#### Adventure Mode Session List (client/src/pages/SessionBrowsePage.tsx)

**Route:** `/adventure/sessions`

A page where players can browse active sessions or enter a join code.

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│  FIND A SESSION                                     │
│  ═══════════════════════════════════════════════    │
│                                                     │
│  JOIN BY CODE                                       │
│  ┌──────────────────────┐  [JOIN]                   │
│  │ Enter join code...   │                           │
│  └──────────────────────┘                           │
│                                                     │
│  ──────────── OR ────────────                       │
│                                                     │
│  ACTIVE SESSIONS                                    │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  The Keep on the Borderlands                │    │
│  │  DM: Gary • 3 players                       │    │
│  │  Code: K7X9M2                    [JOIN]      │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  ┌─────────────────────────────────────────────┐    │
│  │  Tomb of the Serpent Kings                  │    │
│  │  DM: Erol • 1 player                       │    │
│  │  Code: T3N8P5                    [JOIN]      │    │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  (No active sessions)                               │
│  No quests await... check back later                │
│  or enter a join code from your DM.                 │
└─────────────────────────────────────────────────────┘
```

**Join flow:**
1. Player clicks JOIN on a session (or enters code and clicks JOIN)
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

#### Session Page Placeholder (client/src/pages/SessionPage.tsx)

**Route:** `/sessions/:id`

For this spec, the session page is a minimal view showing:
- Session status (active/paused)
- Join code (for DM to share)
- Connected users list
- DM controls: Pause/Resume/End session buttons
- Player: Leave session button

The full game UI (map, chat, player cards sidebar) is spec 011b.

**DM View:**
```
┌─────────────────────────────────────────────────────┐
│  ← Back to Adventure    SESSION: The Keep on the... │
├─────────────────────────────────────────────────────┤
│                                                     │
│  JOIN CODE: K7X9M2              [Copy]              │
│  Share this code with your players                  │
│                                                     │
│  ─────────────────────────────────────────────      │
│                                                     │
│  STATUS: ● ACTIVE                                   │
│                                                     │
│  CONNECTED                                          │
│  ┌─────────────────────────────────────────────┐    │
│  │ ★ Gary (DM)                          ● Online│   │
│  │   Dave — Theron the Bold (Ftr 3)     ● Online│   │
│  │   Sarah — Elara (M-U 2)             ○ Away  │   │
│  └─────────────────────────────────────────────┘    │
│                                                     │
│  [Pause Session]  [End Session]                     │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**Player View:**
```
┌─────────────────────────────────────────────────────┐
│  ← Back to Sessions    SESSION: The Keep on the...  │
├─────────────────────────────────────────────────────┤
│                                                     │
│  Playing as: Theron the Bold (Fighter, Level 3)     │
│                                                     │
│  CONNECTED                                          │
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

### 7. WebSocket Client Hook (client/src/hooks/useSessionSocket.ts)

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

### 8. Routing Updates

**client/src/App.tsx:**

```tsx
<Route path="/adventure/sessions" element={<ProtectedRoute><SessionBrowsePage /></ProtectedRoute>} />
<Route path="/sessions/:id" element={<ProtectedRoute><SessionPage /></ProtectedRoute>} />
```

**Navigation:** Add "Sessions" link in the Adventure mode nav area, linking to `/adventure/sessions`.

### 9. Project Structure Updates

**New Files:**
```
server/src/routes/sessions.ts              # Session REST endpoints
server/src/websocket/index.ts              # WebSocket server setup
server/src/websocket/sessionManager.ts     # In-memory session/connection state
server/src/websocket/handlers.ts           # WebSocket message handlers
server/src/services/joinCode.ts            # Join code generation
client/src/pages/SessionBrowsePage.tsx     # Player session browser
client/src/pages/SessionPage.tsx           # Session view (placeholder for 011b)
client/src/components/SelectCharacterModal.tsx  # Character picker for joining
client/src/hooks/useSessionSocket.ts       # WebSocket connection hook
```

**Modified Files:**
```
prisma/schema.prisma                       # Add Session, SessionParticipant models
shared/src/types.ts                        # Add session and WebSocket types
server/src/app.ts                          # Register session routes + WebSocket
client/src/App.tsx                         # Add session routes
client/src/pages/AdventurePage.tsx          # Add Start/Resume Session button
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
- Join code displayed in monospace/typewriter font
- JOIN button uses standard neobrutalism button style

### Status Indicators

- **Active:** Filled black circle ●
- **Paused:** Half-filled circle ◐ (or use "PAUSED" text badge)
- **Online (connected via WS):** Green dot (one of the rare uses of color per the design system — connection status is important)
- **Offline (not connected):** Empty circle ○

### Join Code Display

The join code should be prominent and easy to read:
- Large monospace font
- Letter-spaced for clarity: `K 7 X 9 M 2`
- Copy button copies the code to clipboard
- Shown on the session page for the DM to share

## Acceptance Criteria

### Database
- [ ] Session model created with all fields
- [ ] SessionParticipant model created
- [ ] Session-Adventure relationship established
- [ ] Session-User (DM) relationship established
- [ ] SessionParticipant-User and SessionParticipant-Character relationships work
- [ ] Cascade delete removes sessions when adventure deleted
- [ ] Unique constraint on joinCode
- [ ] Unique constraint on (sessionId, userId) for participants

### API
- [ ] POST /api/adventures/:id/sessions creates a session with join code
- [ ] POST returns 409 if adventure already has active/paused session
- [ ] GET /api/sessions?adventureId=x returns sessions for that adventure
- [ ] GET /api/sessions?browse=true returns all active sessions (player view)
- [ ] GET /api/sessions/:id returns full session details
- [ ] GET /api/sessions/:id returns 403 for unauthorized users
- [ ] GET /api/sessions/join/:code looks up session by join code
- [ ] POST /api/sessions/:id/join adds player with character
- [ ] POST /api/sessions/:id/join validates character ownership
- [ ] POST /api/sessions/:id/join rejects if session full (8 players)
- [ ] POST /api/sessions/:id/join rejects DM joining own session
- [ ] POST /api/sessions/:id/leave soft-deletes participant
- [ ] PATCH /api/sessions/:id updates status (DM only)
- [ ] PATCH validates status transitions
- [ ] DELETE /api/sessions/:id deletes ended sessions only
- [ ] POST /api/sessions/:id/ws-token returns short-lived token

### WebSocket
- [ ] WebSocket server starts with Fastify
- [ ] Token-based authentication works
- [ ] User added to session on connect
- [ ] `session:state` sent to connecting user
- [ ] `user:connected` broadcast on join
- [ ] `user:disconnected` broadcast on leave
- [ ] `session:updated` broadcast when session state changes
- [ ] Ping/pong keepalive works
- [ ] Stale connections cleaned up after 60s no ping
- [ ] Multiple users in same session receive each other's events

### Client
- [ ] Adventure page shows Start/Resume Session button
- [ ] Session browse page lists active sessions
- [ ] Join code input works
- [ ] Character selection modal appears for multi-character players
- [ ] Session page shows connected users in real-time
- [ ] DM can pause/resume/end session
- [ ] Player can leave session
- [ ] WebSocket auto-reconnects on disconnect
- [ ] Join code copy-to-clipboard works

### Visual Design
- [ ] Session cards match B/X aesthetic
- [ ] Status indicators visible and clear
- [ ] Join code prominent and readable
- [ ] Typography follows design system
- [ ] Animations consistent with existing UI

## Verification Steps

### 1. Session Lifecycle

1. Login as DM, navigate to an adventure
2. Click "Start Session" → session created, redirected to session page
3. Verify join code is displayed
4. Copy join code
5. Open incognito window, login as player
6. Navigate to Adventure > Sessions
7. Verify the active session appears in the browse list
8. Enter join code → session preview shown
9. Select character → join session
10. Verify DM's session page shows player connected
11. DM clicks Pause → status updates for both users
12. DM clicks Resume → session active again
13. Player clicks Leave → removed from participant list
14. DM clicks End Session → session ended

### 2. WebSocket Tests

1. DM starts session, opens session page
2. Player joins session, opens session page
3. Verify both see each other as "Online"
4. Player refreshes page → reconnects, still shows online
5. Player closes tab → DM sees player go offline
6. Player reopens → auto-reconnects, DM sees them online again
7. DM pauses session → player sees status update in real-time

### 3. Edge Cases

1. Try to start session when one already active → 409 error
2. Try to join with someone else's character → 400 error
3. Try to join as DM of the session → 403 error
4. Try to join when session is full (8 players) → 409 error
5. Try to join paused/ended session → 410 error
6. Delete adventure with active session → cascade deletes session
7. Two players join simultaneously → both succeed, both see each other

### 4. Authorization Tests

1. Non-owner tries to start session on someone else's adventure → 403
2. Non-participant tries to GET session details → 403
3. Player tries to pause/end session → 403
4. Player tries to delete session → 403
5. Non-participant tries to get WS token → 403

## Future Considerations

This spec establishes infrastructure for:
- **Spec 011b:** Session game view UI, DM controls (map/backdrop switching), WebRTC voice
- **Spec 011c:** Chat messages and dice rolling over WebSocket
- **Spec 012:** Fog of war state management per session/map

The WebSocket message protocol is extensible — new message types can be added without breaking existing connections. The `sessionManager` module will be extended in 011b and 011c to handle additional message types.

## References

- [PRD: Flow 4 - DM Starts Session](/prd.md#flow-4-dm-starts-a-live-game-session)
- [PRD: Flow 6 - Player Joins Session](/prd.md#flow-6-player-browses-and-joins-a-session)
- [PRD: Session Requirements (28-40)](/prd.md#live-sessions)
- [Spec 002: Auth System](/specs/002-auth.md)
- [Spec 004: Adventures](/specs/004-adventures.md)
- [Spec 006: Characters](/specs/006-characters.md)
