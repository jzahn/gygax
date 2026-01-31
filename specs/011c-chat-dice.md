# Spec 011c: Chat & Dice Rolling

## Goal

Add real-time chat to live sessions with dice rolling commands, private messaging between any participants (DM↔Player, Player↔Player, or groups), and persistent chat history (retained for 1 month). Chat is the primary text communication channel during gameplay.

## Scope

### In Scope

- **Main chat channel** visible to all session participants (always the first tab)
- **Private 1:1 channels** between any two participants (DM↔Player, Player↔Player)
- **Group channels** for subsets of participants (e.g., DM + 2 players, or 3 players)
- Tab-based UI for switching between channels
- Dice rolling via `/roll` command (e.g., `/roll 3d6+1`)
- Dice roll results displayed inline in chat
- Chat message persistence in PostgreSQL
- 1-month retention with automatic cleanup
- Chat history loaded on session join (recent messages)
- Real-time message delivery via WebSocket
- Chat UI integrated into the session game view

### Out of Scope

- Rich text formatting (bold, italic, etc.)
- File/image sharing in chat
- Message editing or deletion
- Chat reactions/emoji
- Chat outside of sessions (no persistent messaging system)
- Dice macros or saved roll presets
- Advanced dice features (exploding dice, advantage/disadvantage)

## Dependencies

**Builds on:**
- Spec 011a: Session model, WebSocket infrastructure
- Spec 011b: Session game view layout (chat integrates into the game view)

**No new dependencies required.**

## Detailed Requirements

### 1. Database Schema

**ChatChannel Model (prisma/schema.prisma):**

Channels represent conversation contexts. Every session has one "Main" channel that automatically includes all participants. Additional channels can be created for 1:1 or group conversations.

```prisma
model ChatChannel {
  id        String   @id @default(cuid())
  sessionId String
  session   Session  @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  name      String?  // null for 1:1 channels, user-defined for groups
  isMain    Boolean  @default(false) // The main channel includes everyone
  createdAt DateTime @default(now())

  participants ChatChannelParticipant[]
  messages     ChatMessage[]

  @@index([sessionId])
  @@map("chat_channels")
}

model ChatChannelParticipant {
  id        String      @id @default(cuid())
  channelId String
  channel   ChatChannel @relation(fields: [channelId], references: [id], onDelete: Cascade)
  userId    String
  user      User        @relation(fields: [userId], references: [id], onDelete: Cascade)
  joinedAt  DateTime    @default(now())

  // Track unread state per user per channel
  lastReadAt DateTime   @default(now())

  @@unique([channelId, userId])
  @@map("chat_channel_participants")
}
```

**ChatMessage Model:**

```prisma
model ChatMessage {
  id        String          @id @default(cuid())
  content   String          // Raw message text (or dice command)
  type      ChatMessageType @default(TEXT)
  createdAt DateTime        @default(now())

  channelId String
  channel   ChatChannel     @relation(fields: [channelId], references: [id], onDelete: Cascade)

  senderId  String
  sender    User            @relation(fields: [senderId], references: [id], onDelete: Cascade)

  // Dice roll results (populated when type is ROLL)
  diceExpression String?    // e.g., "3d6+1"
  diceRolls      Json?      // e.g., [4, 2, 6]
  diceTotal      Int?       // e.g., 13 (sum + modifier)
  diceModifier   Int?       // e.g., 1

  @@index([channelId, createdAt])
  @@map("chat_messages")
}

enum ChatMessageType {
  TEXT       // Regular text message
  ROLL       // Dice roll result
  SYSTEM     // System message (player joined, session paused, etc.)
}
```

**Update Session Model:**

```prisma
model Session {
  // ... existing fields
  chatChannels ChatChannel[]
}
```

**Update User Model:**

```prisma
model User {
  // ... existing fields
  chatMessages            ChatMessage[]
  chatChannelParticipants ChatChannelParticipant[]
}
```

**Channel Behavior:**

1. **Main channel:** Created automatically when a session is created. All session participants are automatically added. Cannot be deleted or left. `isMain = true`.

2. **1:1 channels:** Created on-demand when a user starts a private conversation. `name = null`, two participants. If a 1:1 channel already exists between two users, reuse it.

3. **Group channels:** Created explicitly by any participant. `name` is optional (auto-generated if not provided, e.g., "Dave, Sarah, Gary"). Multiple participants.

**Migration:** `011c_chat_channels` creates the chat_channels, chat_channel_participants, and chat_messages tables.

### 2. Dice Rolling Parser

A utility that parses dice notation and produces roll results.

**Supported syntax:**
- `NdS` — Roll N dice with S sides (e.g., `3d6`, `1d20`, `2d8`)
- `NdS+M` — Roll with positive modifier (e.g., `3d6+1`, `1d20+5`)
- `NdS-M` — Roll with negative modifier (e.g., `1d20-2`)
- `dS` — Shorthand for 1dS (e.g., `d20` = `1d20`)

**Limits:**
- N (number of dice): 1–100
- S (sides): 1–1000
- M (modifier): -999 to +999

**Parser location:** `shared/src/dice.ts` (shared between client and server — client for preview, server for authoritative rolls)

```typescript
export interface DiceExpression {
  count: number      // Number of dice
  sides: number      // Sides per die
  modifier: number   // +/- modifier (0 if none)
  raw: string        // Original expression string
}

export interface DiceResult {
  expression: DiceExpression
  rolls: number[]    // Individual die results
  total: number      // Sum of rolls + modifier
}

/**
 * Parse a dice expression string.
 * Returns null if the string is not a valid dice expression.
 */
export function parseDice(input: string): DiceExpression | null

/**
 * Roll dice from a parsed expression.
 * Uses Math.random() — not cryptographically secure, fine for tabletop games.
 */
export function rollDice(expression: DiceExpression): DiceResult

/**
 * Format a dice result for display.
 * Example: "3d6+1: [4, 2, 6] + 1 = 13"
 */
export function formatDiceResult(result: DiceResult): string
```

### 3. WebSocket Messages

**Client → Server:**

| Type | Payload | Description |
|------|---------|-------------|
| `chat:message` | `{ channelId, content }` | Send a chat message (or dice roll) to a channel |
| `chat:create_channel` | `{ participantIds, name? }` | Create a new channel (1:1 or group) |
| `chat:mark_read` | `{ channelId }` | Mark a channel as read (updates lastReadAt) |

The server determines if the message is a dice roll by checking if `content` starts with `/roll `. If so, the server:
1. Parses the dice expression
2. Rolls the dice (server-authoritative)
3. Stores the result as a ROLL message
4. Broadcasts the result to all channel participants

This ensures dice rolls are server-authoritative — no one can fake a roll.

**Server → Client:**

| Type | Payload | Description |
|------|---------|-------------|
| `chat:message` | `{ channelId, message }` | New chat message (text, roll, or system) |
| `chat:channels` | `{ channels }` | List of channels user belongs to (sent on connect) |
| `chat:channel_created` | `{ channel }` | New channel was created (you were added) |
| `chat:history` | `{ channelId, messages, hasMore }` | Recent message history for a channel |

**Message payload shape:**

```typescript
interface ChatMessagePayload {
  id: string
  content: string
  type: 'TEXT' | 'ROLL' | 'SYSTEM'
  createdAt: string
  channelId: string
  sender: {
    id: string
    name: string
    avatarUrl: string | null
  }
  // Dice roll fields (only for ROLL type)
  diceExpression?: string
  diceRolls?: number[]
  diceTotal?: number
  diceModifier?: number
}
```

**Channel payload shape:**

```typescript
interface ChatChannelPayload {
  id: string
  name: string | null       // null for 1:1 channels
  isMain: boolean
  participants: Array<{
    id: string
    name: string
    avatarUrl: string | null
  }>
  unreadCount: number       // Messages since lastReadAt
  lastMessage?: {           // Preview for channel list
    content: string
    senderName: string
    createdAt: string
  }
}
```

**Channel creation flow:**
1. Client sends `chat:create_channel` with participant IDs
2. Server checks if 1:1 channel already exists (reuses if so)
3. Server creates channel and adds participants
4. Server sends `chat:channel_created` to all participants
5. New channel tab appears for all participants

**Message routing:**
- Messages are routed to all participants of the channel
- Each participant sees the message in real-time if connected
- Non-connected participants see the message on next connect

**System messages:**
- Generated by the server (no sender action)
- Examples: "Dave joined the session", "Session paused", "Session resumed"
- Posted to the Main channel
- Stored in DB with `type: SYSTEM` and `senderId` set to the acting user

### 4. REST API Endpoints

#### GET /api/sessions/:id/channels

List all chat channels the user belongs to for this session.

**Response (200):**
```json
{
  "channels": [
    {
      "id": "clx...",
      "name": null,
      "isMain": true,
      "participants": [
        { "id": "clx...", "name": "Gary", "avatarUrl": null },
        { "id": "clx...", "name": "Dave", "avatarUrl": null },
        { "id": "clx...", "name": "Sarah", "avatarUrl": null }
      ],
      "unreadCount": 0,
      "lastMessage": {
        "content": "You enter a dimly lit corridor...",
        "senderName": "Gary",
        "createdAt": "2026-01-27T12:10:00.000Z"
      }
    },
    {
      "id": "clx...",
      "name": null,
      "isMain": false,
      "participants": [
        { "id": "clx...", "name": "Gary", "avatarUrl": null },
        { "id": "clx...", "name": "Dave", "avatarUrl": null }
      ],
      "unreadCount": 2,
      "lastMessage": {
        "content": "Make a secret perception check.",
        "senderName": "Gary",
        "createdAt": "2026-01-27T12:11:00.000Z"
      }
    }
  ]
}
```

**Authorization:**
- Only returns channels where the user is a participant
- DM can also list all channels (for oversight)

**Errors:**
- 401: Not authenticated
- 403: Not a participant of this session
- 404: Session not found

---

#### POST /api/sessions/:id/channels

Create a new chat channel.

**Request body:**
```json
{
  "participantIds": ["clx...", "clx..."],
  "name": "Secret Planning"  // optional
}
```

**Behavior:**
- If exactly 2 participants (including self) and a 1:1 channel already exists, return the existing channel
- If `name` is not provided for a group (3+ participants), auto-generate from participant names
- Creator is automatically added as a participant

**Response (201):**
```json
{
  "channel": {
    "id": "clx...",
    "name": "Secret Planning",
    "isMain": false,
    "participants": [...],
    "unreadCount": 0,
    "lastMessage": null
  }
}
```

**Errors:**
- 400: Invalid participant IDs, or trying to create a channel with yourself only
- 401: Not authenticated
- 403: Not a participant of this session, or participant IDs include non-session members
- 404: Session not found

---

#### GET /api/channels/:id/messages

Load chat history for a specific channel.

**Query params:**
- `before` (optional): Cursor-based pagination — load messages before this message ID
- `limit` (optional): Number of messages to load (default 50, max 100)

**Response (200):**
```json
{
  "messages": [
    {
      "id": "clx...",
      "content": "You enter a dimly lit corridor...",
      "type": "TEXT",
      "createdAt": "2026-01-27T12:10:00.000Z",
      "channelId": "clx...",
      "sender": {
        "id": "clx...",
        "name": "Gary",
        "avatarUrl": null
      }
    },
    {
      "id": "clx...",
      "content": "/roll 1d20+3",
      "type": "ROLL",
      "createdAt": "2026-01-27T12:10:30.000Z",
      "channelId": "clx...",
      "sender": {
        "id": "clx...",
        "name": "Dave",
        "avatarUrl": null
      },
      "diceExpression": "1d20+3",
      "diceRolls": [17],
      "diceTotal": 20,
      "diceModifier": 3
    }
  ],
  "hasMore": true
}
```

**Authorization:**
- Must be a participant of the channel to load messages

**Errors:**
- 401: Not authenticated
- 403: Not a participant of this channel
- 404: Channel not found

---

#### PATCH /api/channels/:id/read

Mark a channel as read (updates lastReadAt for the user).

**Response (204):** No content

**Errors:**
- 401: Not authenticated
- 403: Not a participant of this channel
- 404: Channel not found

### 5. Chat UI

#### Design Philosophy: Shared Bottom Panel

Mobile screen space is precious. The DM controls already occupy the bottom of the screen, and chat needs the same prime real estate. The solution: **a unified bottom panel that toggles between Chat and DM Tools**.

Key insight: A DM never needs to change the map/backdrop *while* typing a message. These are sequential actions, not simultaneous. By sharing the same space, we maximize the map display area.

#### Desktop Layout (≥1024px)

On desktop, there's enough space for both. Chat appears in a collapsible panel between the map and DM controls.

```
┌──────────────────────────────────────────────────────────────────┐
│  Header                                                          │
├──────────────────────────────────────────────┬───────────────────┤
│                                              │                   │
│                                              │  Player sidebar   │
│           MAP / BACKDROP AREA                │                   │
│              (flexible height)               │                   │
│                                              │                   │
├──────────────────────────────────────────────┤                   │
│  CHAT PANEL (collapsible, ~200px height)     │                   │
│  ┌─────────────────────────────────────────┐ │                   │
│  │ ▾ [Main] [Dave●2] [Secret+] ─────────── │ │                   │
│  ├─────────────────────────────────────────┤ │                   │
│  │ GARY         The corridor stretches...  │ │                   │
│  │ DAVE         I check for traps          │ │                   │
│  │ ⚅ DAVE       1d20+3 → [17]+3 = 20      │ │                   │
│  │ GARY         It's clear. Proceed.       │ │                   │
│  ├─────────────────────────────────────────┤ │                   │
│  │ [Address the party...          ] [Send] │ │                   │
│  └─────────────────────────────────────────┘ │                   │
├──────────────────────────────────────────────┴───────────────────┤
│  DM CONTROLS (dark bar)                                          │
└──────────────────────────────────────────────────────────────────┘
```

**Desktop chat features:**
- Collapsible with a toggle button (chevron) in the header
- Collapsed state shows just the tab bar with unread indicators
- Default expanded height: 200px (resizable via drag handle)
- Tab bar scrolls horizontally when many channels exist

#### Tablet Layout (768px–1023px)

Similar to desktop, but chat panel takes more vertical space when expanded.

#### Mobile Layout (<768px)

On mobile, chat and DM tools share the same bottom panel via a **mode toggle**.

```
┌─────────────────────────────────────────┐
│  Header (compact)                       │
├─────────────────────────────────────────┤
│                                         │
│                                         │
│         MAP / BACKDROP AREA             │
│         (maximized)                     │
│                                         │
│                                         │
├─────────────────────────────────────────┤
│  ┌─────────┬─────────┐                  │  ← Mode toggle (DM only)
│  │   DM    │  Chat   │                  │     Players see chat only
│  │  Tools  │  ●3     │                  │     ●3 = unread count
│  └─────────┴─────────┘                  │
│  ═══════════════════════════════════════│  ← Drag handle
│                                         │
│    [Content based on selected mode]     │
│                                         │
│  ─────────────────────────────────────  │
│  [Input field...                ] [⏎]  │
└─────────────────────────────────────────┘
```

**Mobile panel behavior:**

1. **Collapsed state (default):**
   - Shows only the mode toggle bar (~44px)
   - Unread badge visible on Chat tab
   - Tap to expand

2. **Expanded state:**
   - Slides up to ~50% of viewport
   - Drag handle allows resizing (40%–70% range)
   - Swipe down to collapse
   - Content changes based on selected mode

3. **For DM:**
   - Toggle between "DM Tools" and "Chat" modes
   - DM Tools mode shows map/backdrop selectors + session controls
   - Chat mode shows channel tabs + messages + input

4. **For Players:**
   - No toggle needed — panel is always Chat
   - Same expandable drawer behavior

#### Channel Tab Bar

The tab bar appears at the top of the chat content area.

```
┌──────────────────────────────────────────────────────┐
│  [Main] [Dave ●2] [Sarah] [Secret Planning] [+]     │
└──────────────────────────────────────────────────────┘
```

**Tab styling (neobrutalism):**
- Active tab: `bg-ink text-parchment-100` (inverted)
- Inactive tab: `bg-parchment-200 text-ink border-2 border-ink`
- Hover: `bg-parchment-300`
- Unread badge: small circle with count, `bg-blood-red text-parchment-100`
- Main tab: has a small ★ icon prefix, cannot be closed
- Private channels: has a small 🔒 icon prefix
- [+] button: opens channel creation dialog

**Tab overflow:**
- Horizontal scroll with CSS `overflow-x: auto`
- Subtle fade gradient on edges when scrollable
- Touch-friendly scroll on mobile

#### Chat Messages Area

```
┌─────────────────────────────────────────────────────┐
│  ┌─ Load older messages ─┐                          │  ← Pagination
│  └───────────────────────┘                          │
│                                                     │
│  GARY                                    12:10 PM   │
│  The corridor stretches into darkness ahead.        │
│  You can hear dripping water somewhere deeper.      │
│                                                     │
│  DAVE                                    12:11 PM   │
│  I'll check for traps before we proceed.           │
│                                                     │
│  ┌─────────────────────────────────────────────┐   │
│  │  ⚅  DAVE rolled 1d20+3                      │   │  ← Dice roll
│  │     [17] + 3 = 20                           │   │     (special card)
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  GARY                                    12:11 PM   │
│  The path is clear. No traps detected.             │
│                                                     │
│            — Sarah joined the session —             │  ← System message
│                                                     │
│  ┌──────────────────────────────────────────────┐  │
│  │           ↓ New messages below               │  │  ← Scroll indicator
│  └──────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
```

**Message grouping:**
- Consecutive messages from same sender within 1 minute collapse (no repeated name/timestamp)
- Sender name in display font (IM Fell English), uppercase, small
- Timestamp right-aligned, muted color
- Message body in body font (Spectral)

**Message types:**

1. **Text message:** Standard display with sender, timestamp, content
2. **Dice roll:** Special card with die icon, expression, individual results, total
3. **System message:** Centered, italic, muted, no sender/timestamp

#### Dice Roll Display

Dice rolls get special treatment to feel tactile and exciting:

```
┌─────────────────────────────────────────────────────┐
│  ⚅  DAVE rolled 3d6+1                              │
│                                                     │
│     ┌───┐ ┌───┐ ┌───┐                              │
│     │ 4 │ │ 2 │ │ 6 │  + 1  =  13                  │
│     └───┘ └───┘ └───┘                              │
└─────────────────────────────────────────────────────┘
```

**Dice styling:**
- Die icon (⚅) in display font
- Individual die results in small boxes (like physical dice faces)
- Boxes have thick black borders, parchment background
- Modifier shown after dice, total is bold
- Natural 20 on d20: total gets `text-green-700` with subtle glow
- Natural 1 on d20: total gets `text-blood-red` with strikethrough effect

#### Chat Input Area

```
┌─────────────────────────────────────────────────────┐
│  [Address the party...                    ] [Send]  │
└─────────────────────────────────────────────────────┘
```

**Input styling:**
- Input field: thick black border, parchment background, Special Elite font
- Placeholder changes per channel:
  - Main: "Address the party..."
  - 1:1: "Whisper to {name}..."
  - Group: "Message {channel name}..."
- Send button: neobrutalism primary style, `bg-ink text-parchment-100`
- Enter to send, Shift+Enter for newline
- `/roll` hint appears subtly when input starts with `/r`

#### Private Channel Header

When viewing a non-Main channel, a subtle header indicates privacy:

```
┌─────────────────────────────────────────────────────┐
│  🔒 Private conversation with Dave                  │
└─────────────────────────────────────────────────────┘
```

- Dashed border, slightly dimmed background
- Lock icon prefix
- Lists participants (or channel name for groups)
- Appears once at top of message list, not on each message

#### Create Channel Dialog

```
┌─────────────────────────────────────────────────────┐
│                                                     │
│           START A CONVERSATION                      │
│                                                     │
│  Select participants:                               │
│  ┌─────────────────────────────────────────────┐   │
│  │ ☑ Dave (Fighter 3)                          │   │
│  │ ☐ Sarah (Magic-User 2)                      │   │
│  │ ☐ Gary (DM)                                 │   │
│  └─────────────────────────────────────────────┘   │
│                                                     │
│  Channel name (optional):                           │
│  ┌─────────────────────────────────────────────┐   │
│  │ Secret Planning                             │   │
│  └─────────────────────────────────────────────┘   │
│  (Leave blank for auto-generated name)             │
│                                                     │
│           [Cancel]        [Create]                 │
│                                                     │
└─────────────────────────────────────────────────────┘
```

- Modal dialog with neobrutalism styling
- Checkbox list of session participants
- Optional name field (only shown if 3+ selected)
- Cancel and Create buttons

#### Quick 1:1 from Sidebar

Clicking a player's name in the participant sidebar:
- If 1:1 channel exists → switch to it
- If not → create it and switch to it
- On mobile → also expand the chat panel

#### Message Rendering

**Text message:**
```
┌─────────────────────────────────────────────┐
│ Gary                              12:10 PM  │
│ You enter a dimly lit corridor stretching    │
│ into darkness ahead.                        │
└─────────────────────────────────────────────┘
```

**Dice roll message:**
```
┌─────────────────────────────────────────────┐
│ Dave                              12:10 PM  │
│ ⚅ 1d20+3: [17] + 3 = 20                   │
└─────────────────────────────────────────────┘
```

Dice roll display:
- Die icon (⚅) prefix
- Expression shown: `1d20+3`
- Individual rolls in brackets: `[17]` or `[4, 2, 6]` for multiple dice
- Modifier shown if non-zero: `+ 3` or `- 2`
- Total emphasized (bold): `= 20`
- Natural 20 on a d20: total highlighted (approved accent color)
- Natural 1 on a d20: total shown in muted/danger style

**Non-Main channel indicator:**

When viewing a 1:1 or group channel, a subtle header indicates the channel context:
```
┌─────────────────────────────────────────────┐
│ 🔒 Private: You and Dave                    │
├─────────────────────────────────────────────┤
│ messages...                                 │
└─────────────────────────────────────────────┘
```

Channel header styling:
- Lock icon for non-Main channels
- Participant names listed
- Subtle background (light gray or dashed border)
- This header appears once at top of message list, not on every message

**System message:**
```
┌─────────────────────────────────────────────┐
│          — Dave joined the session —         │
└─────────────────────────────────────────────┘
```

System messages:
- Centered text
- Muted color (ink-soft)
- Em dash surrounds
- No avatar or timestamp

### 6. Chat Retention & Cleanup

Chat messages are retained for **1 month** from creation.

**Cleanup approach:** A scheduled task or database trigger deletes messages older than 1 month.

**Implementation options (in order of preference):**

1. **Cron job in server:** On server startup, schedule a daily cleanup that runs:
   ```sql
   DELETE FROM chat_messages WHERE "createdAt" < NOW() - INTERVAL '1 month'
   ```

2. **Manual cleanup endpoint** (admin use): `DELETE /api/admin/cleanup-chat` — run manually or via external cron.

For this spec, implement option 1 (scheduled cleanup on server startup, runs daily at 3:00 AM server time).

### 7. Type Definitions (shared/src/types.ts additions)

```typescript
// Chat Channel types
export interface ChatChannelParticipant {
  id: string
  name: string
  avatarUrl: string | null
}

export interface ChatChannel {
  id: string
  name: string | null       // null for 1:1 channels
  isMain: boolean
  participants: ChatChannelParticipant[]
  unreadCount: number
  lastMessage?: {
    content: string
    senderName: string
    createdAt: string
  }
}

export interface ChatChannelListResponse {
  channels: ChatChannel[]
}

export interface CreateChatChannel {
  participantIds: string[]
  name?: string
}

// Chat Message types
export type ChatMessageType = 'TEXT' | 'ROLL' | 'SYSTEM'

export interface ChatMessage {
  id: string
  content: string
  type: ChatMessageType
  createdAt: string
  channelId: string
  sender: {
    id: string
    name: string
    avatarUrl: string | null
  }
  diceExpression?: string
  diceRolls?: number[]
  diceTotal?: number
  diceModifier?: number
}

export interface ChatMessageListResponse {
  messages: ChatMessage[]
  hasMore: boolean
}

export interface SendChatMessage {
  channelId: string
  content: string
}

// Dice types
export interface DiceExpression {
  count: number
  sides: number
  modifier: number
  raw: string
}

export interface DiceResult {
  expression: DiceExpression
  rolls: number[]
  total: number
}
```

### 8. Dice Parser (shared/src/dice.ts)

```typescript
const DICE_REGEX = /^(\d+)?d(\d+)([+-]\d+)?$/i

export function parseDice(input: string): DiceExpression | null {
  const trimmed = input.trim().toLowerCase()
  const match = trimmed.match(DICE_REGEX)
  if (!match) return null

  const count = match[1] ? parseInt(match[1], 10) : 1
  const sides = parseInt(match[2], 10)
  const modifier = match[3] ? parseInt(match[3], 10) : 0

  // Validate limits
  if (count < 1 || count > 100) return null
  if (sides < 1 || sides > 1000) return null
  if (modifier < -999 || modifier > 999) return null

  return { count, sides, modifier, raw: trimmed }
}

export function rollDice(expression: DiceExpression): DiceResult {
  const rolls: number[] = []
  for (let i = 0; i < expression.count; i++) {
    rolls.push(Math.floor(Math.random() * expression.sides) + 1)
  }
  const total = rolls.reduce((sum, r) => sum + r, 0) + expression.modifier
  return { expression, rolls, total }
}

export function formatDiceResult(result: DiceResult): string {
  const { expression, rolls, total } = result
  const rollsStr = `[${rolls.join(', ')}]`
  const modStr = expression.modifier > 0
    ? ` + ${expression.modifier}`
    : expression.modifier < 0
      ? ` - ${Math.abs(expression.modifier)}`
      : ''
  return `${expression.raw}: ${rollsStr}${modStr} = ${total}`
}
```

### 9. Chat Hook (client/src/hooks/useChat.ts)

```typescript
interface UseChatOptions {
  sessionId: string
  socket: WebSocket | null
  isConnected: boolean
}

interface UseChatReturn {
  // Channels
  channels: ChatChannel[]
  activeChannelId: string | null
  setActiveChannelId: (channelId: string) => void
  createChannel: (participantIds: string[], name?: string) => Promise<ChatChannel>

  // Messages (for active channel)
  messages: ChatMessage[]
  sendMessage: (content: string) => void
  loadMore: () => Promise<void>
  hasMore: boolean
  isLoading: boolean

  // Unread tracking
  totalUnreadCount: number      // Total across all channels
  markChannelRead: (channelId: string) => void
}
```

**Behavior:**
1. On mount, load channels list via REST
2. Auto-select Main channel as active
3. Load recent messages for active channel
4. Listen for WebSocket events:
   - `chat:channels` — initial channel list on connect
   - `chat:message` — new message (update appropriate channel)
   - `chat:channel_created` — add new channel to list
   - `chat:history` — message history for a channel
5. Track unread counts per channel
6. Mark channel as read when selected (update lastReadAt)
7. Support loading older messages via pagination
8. Handle channel switching — load messages if not already cached

### 10. Project Structure Updates

**New Files:**
```
shared/src/dice.ts                            # Dice parser and roller
shared/src/dice.test.ts                       # Dice parser tests
server/src/services/chatCleanup.ts            # Scheduled chat cleanup
server/src/services/chatService.ts            # Channel/message business logic
server/src/routes/channels.ts                 # Channel REST endpoints
server/src/websocket/chatHandler.ts           # Chat WebSocket message handler
client/src/components/ChatPanel.tsx           # Chat UI panel (desktop, with tabs)
client/src/components/ChatTabs.tsx            # Channel tab bar component
client/src/components/ChatMessage.tsx         # Individual message renderer
client/src/components/DiceRollCard.tsx        # Dice roll display component
client/src/components/ChatInput.tsx           # Chat input field
client/src/components/SystemMessage.tsx       # System message display
client/src/components/CreateChannelDialog.tsx # Dialog for creating new channels
client/src/components/MobileBottomPanel.tsx   # Shared mobile panel (chat + DM tools)
client/src/components/ModeToggle.tsx          # DM Tools / Chat toggle for mobile
client/src/hooks/useChat.ts                   # Chat state management hook
client/src/hooks/usePanelDrag.ts              # Mobile panel drag/resize hook
```

**Modified Files:**
```
prisma/schema.prisma                          # Add ChatChannel, ChatChannelParticipant, ChatMessage models
shared/src/types.ts                           # Add chat and channel types
server/src/app.ts                             # Register chat cleanup schedule, channel routes
server/src/routes/sessions.ts                 # Add channels endpoint
server/src/websocket/handlers.ts              # Add chat message handling
client/src/pages/SessionGameView.tsx          # Integrate chat, refactor bottom panel
client/src/components/DMControls.tsx          # Extract into MobileBottomPanel
client/src/hooks/useSessionSocket.ts          # Handle chat message types
client/src/index.css                          # Add chat-specific animations and styles
```

## Design Details

### Chat Aesthetic — "The Adventure Log"

The chat should feel like a shared adventure journal being written in real-time by the party. Think of the handwritten session notes from 1981, complete with margin scribbles and dramatic narration.

**Overall feel:**
- Parchment texture background (`card-texture` class)
- Thick black borders on containers (3px, neobrutalism)
- Paper grain visible under text
- Warm candlelight shadows at edges

### Typography

| Element | Font | Style |
|---------|------|-------|
| Sender name | IM Fell English | Uppercase, 0.75rem, tracking-wider |
| Message body | Spectral | Regular, 0.9rem, line-height 1.5 |
| Timestamp | Spectral | Italic, 0.7rem, `text-ink-faded` |
| Dice expression | Special Elite | 0.85rem, monospace feel |
| Dice results | Cinzel | Bold, number font |
| System message | Spectral | Italic, 0.8rem, `text-ink-ghost` |
| Input placeholder | Special Elite | 0.9rem, `text-ink-faded` |

### Color Usage

| Element | Color Token |
|---------|-------------|
| Chat background | `parchment-100` |
| Message area | `parchment-50` (slightly lighter) |
| Active tab | `ink` bg, `parchment-100` text |
| Inactive tab | `parchment-200` bg, `ink` text |
| Unread badge | `blood-red` bg, `parchment-100` text |
| Natural 20 | `green-700` text, subtle glow |
| Natural 1 | `blood-red` text |
| System message | `ink-ghost` text |
| Private header | `parchment-300` bg, dashed border |

### Component Specifications

#### Mode Toggle (Mobile, DM only)

```css
.mode-toggle {
  display: flex;
  border: 3px solid var(--color-ink);
  background: var(--color-parchment-200);
}

.mode-toggle-option {
  flex: 1;
  padding: 0.5rem 1rem;
  font-family: var(--font-display);
  text-transform: uppercase;
  letter-spacing: 0.1em;
  font-size: 0.75rem;
  text-align: center;
  transition: all 0.15s ease-out;
}

.mode-toggle-option.active {
  background: var(--color-ink);
  color: var(--color-parchment-100);
}

.mode-toggle-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.25rem;
  height: 1.25rem;
  padding: 0 0.25rem;
  margin-left: 0.5rem;
  background: var(--color-blood-red);
  color: var(--color-parchment-100);
  font-family: var(--font-number);
  font-size: 0.65rem;
  font-weight: bold;
  border-radius: 0; /* Brutalist — no rounded corners */
}
```

#### Channel Tabs

```css
.channel-tab {
  display: inline-flex;
  align-items: center;
  gap: 0.375rem;
  padding: 0.375rem 0.75rem;
  border: 2px solid var(--color-ink);
  background: var(--color-parchment-200);
  font-family: var(--font-body);
  font-size: 0.8rem;
  white-space: nowrap;
  transition: all 0.1s ease-out;
}

.channel-tab:hover {
  background: var(--color-parchment-300);
}

.channel-tab.active {
  background: var(--color-ink);
  color: var(--color-parchment-100);
  box-shadow: var(--shadow-brutal-sm);
}

.channel-tab-icon {
  font-size: 0.7rem;
  opacity: 0.7;
}

.channel-tab-unread {
  min-width: 1rem;
  height: 1rem;
  padding: 0 0.25rem;
  background: var(--color-blood-red);
  color: var(--color-parchment-100);
  font-family: var(--font-number);
  font-size: 0.6rem;
  font-weight: bold;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

#### Dice Roll Card

```css
.dice-roll-card {
  margin: 0.5rem 0;
  padding: 0.75rem;
  border: 3px solid var(--color-ink);
  background: var(--color-parchment-50);
  box-shadow: var(--shadow-brutal-sm);
}

.dice-roll-header {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.5rem;
}

.dice-roll-icon {
  font-size: 1.25rem;
  font-family: var(--font-display);
}

.dice-roll-expression {
  font-family: var(--font-input);
  font-size: 0.85rem;
  color: var(--color-ink-soft);
}

.dice-roll-results {
  display: flex;
  align-items: center;
  gap: 0.375rem;
  flex-wrap: wrap;
}

.dice-roll-die {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 2rem;
  height: 2rem;
  border: 2px solid var(--color-ink);
  background: var(--color-parchment-100);
  font-family: var(--font-number);
  font-size: 0.9rem;
  font-weight: bold;
}

.dice-roll-modifier {
  font-family: var(--font-body);
  font-size: 0.9rem;
  color: var(--color-ink-soft);
}

.dice-roll-equals {
  font-family: var(--font-body);
  font-size: 0.9rem;
  margin: 0 0.25rem;
}

.dice-roll-total {
  font-family: var(--font-number);
  font-size: 1.25rem;
  font-weight: bold;
}

.dice-roll-total.nat-20 {
  color: var(--color-green-700, #15803d);
  text-shadow: 0 0 8px rgba(21, 128, 61, 0.3);
}

.dice-roll-total.nat-1 {
  color: var(--color-blood-red);
  text-decoration: line-through;
}
```

#### System Message

```css
.system-message {
  text-align: center;
  padding: 0.5rem 0;
  font-family: var(--font-body);
  font-size: 0.8rem;
  font-style: italic;
  color: var(--color-ink-ghost);
}

.system-message::before,
.system-message::after {
  content: '—';
  margin: 0 0.5rem;
}
```

#### Chat Panel Drag Handle (Mobile)

```css
.chat-drag-handle {
  width: 100%;
  height: 1.5rem;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--color-parchment-200);
  border-bottom: 1px solid var(--color-ink);
  cursor: grab;
}

.chat-drag-handle::after {
  content: '';
  width: 2.5rem;
  height: 4px;
  background: var(--color-ink-faded);
  border-radius: 2px;
}

.chat-drag-handle:active {
  cursor: grabbing;
}
```

### Animation & Micro-interactions

**New message arrival:**
- Subtle fade-in + slide-up (100ms)
- Uses `animate-ink-reveal` class

**Tab switch:**
- Instant background change
- Content cross-fades (150ms)

**Dice roll:**
- Card slides in from bottom
- Individual dice "tumble" in with staggered delays (50ms each)
- Total fades in last (200ms delay)

**Panel expand/collapse (mobile):**
- Spring physics: `transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)`
- Content opacity transitions slightly delayed

**Unread badge:**
- Pulse animation when count increases
- `animation: unreadPulse 0.3s ease-out`

```css
@keyframes unreadPulse {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.2); }
}
```

### Responsive Breakpoints

| Breakpoint | Behavior |
|------------|----------|
| <768px (mobile) | Shared bottom panel with mode toggle, expandable drawer |
| 768px–1023px (tablet) | Similar to mobile but larger touch targets |
| ≥1024px (desktop) | Inline chat panel below map, collapsible |
| ≥1280px (large desktop) | Wider chat panel, more message history visible |

## Acceptance Criteria

### Chat Channels
- [ ] Main channel auto-created when session starts
- [ ] Main channel includes all session participants automatically
- [ ] Main channel always appears as first tab
- [ ] Users can create 1:1 channels with any participant
- [ ] Users can create group channels with multiple participants
- [ ] 1:1 channels reuse existing channel if one exists
- [ ] Group channels can have optional custom names
- [ ] Tabs show channel name (or participant names for unnamed)
- [ ] Tabs show unread message count badge
- [ ] [+] button opens channel creation dialog
- [ ] Clicking participant in sidebar opens/creates 1:1 channel

### Chat Messages
- [ ] Users can send text messages in active channel
- [ ] Messages appear in real-time for all channel participants
- [ ] Messages display sender name, content, and timestamp
- [ ] Messages persist in database with channel reference
- [ ] Chat history loads on session page visit
- [ ] Older messages loadable via scroll/button (pagination)
- [ ] Auto-scroll to newest message
- [ ] "New messages" indicator when scrolled up

### Dice Rolling
- [ ] `/roll 3d6` rolls 3 six-sided dice and shows result
- [ ] `/roll 1d20+5` rolls with positive modifier
- [ ] `/roll 2d8-1` rolls with negative modifier
- [ ] `/roll d20` shorthand works (= 1d20)
- [ ] Invalid expressions show error message (not a roll)
- [ ] Rolls are server-authoritative (server generates random numbers)
- [ ] Roll results show individual dice, modifier, and total
- [ ] Natural 20 on d20 visually highlighted
- [ ] Natural 1 on d20 visually distinct

### System Messages
- [ ] "Player joined" message appears when player joins (Main channel)
- [ ] "Player left" message appears when player leaves (Main channel)
- [ ] "Session paused" / "Session resumed" messages appear (Main channel)
- [ ] System messages centered and styled differently

### Chat Retention
- [ ] Messages stored with channel and user references
- [ ] Cleanup job deletes messages older than 1 month
- [ ] Cleanup runs daily
- [ ] Cascade delete removes messages when channel/session deleted

### Chat UI
- [ ] Desktop: Chat panel visible below map, collapsible
- [ ] Desktop: Collapsed state shows tab bar with unread indicators
- [ ] Mobile: Shared bottom panel with mode toggle (DM) or chat-only (players)
- [ ] Mobile: Panel expands to ~50% viewport on tap
- [ ] Mobile: Drag handle allows resizing (40%–70%)
- [ ] Mobile: Swipe down to collapse
- [ ] Tab bar for switching channels (horizontal scroll)
- [ ] Active tab inverted (ink bg, parchment text)
- [ ] Unread badge on tabs with count
- [ ] Messages render correctly (text, rolls, system)
- [ ] Dice rolls display individual die faces in boxes
- [ ] Natural 20 highlighted green with glow
- [ ] Natural 1 shown in red with strikethrough
- [ ] Non-Main channels show private indicator header
- [ ] System messages centered with em-dashes
- [ ] Input field clears after sending
- [ ] Enter sends, Shift+Enter adds newline
- [ ] Placeholder text reflects active channel
- [ ] New message animation (fade-in + slide-up)
- [ ] B/X aesthetic matches rest of application

## Verification Steps

### 1. Main Channel Chat

1. DM and two players in a session
2. Verify Main tab appears first and is selected by default
3. DM types message → all three see it in Main tab
4. Player 1 types message → all three see it
5. Verify timestamps and sender names correct
6. Refresh page → chat history loads
7. Scroll up → "Load more" loads older messages

### 2. Dice Rolling

1. Type `/roll 3d6` → see roll result with 3 individual dice and total
2. Type `/roll 1d20+5` → see d20 result plus modifier
3. Type `/roll d20` → shorthand works, 1 die shown
4. Type `/roll 100d6` → many dice rolled, sum shown
5. Type `/roll 0d6` → error, not a valid roll
6. Type `/roll abc` → treated as regular text message (not a dice command)
7. Verify all rolls show individual dice values
8. Roll until natural 20 on d20 → verify highlight
9. Roll until natural 1 on d20 → verify distinct style

### 3. Private 1:1 Channels

1. DM clicks [+] button, selects Dave only, creates channel
2. New "Dave" tab appears for both DM and Dave
3. DM types message in Dave channel → only DM and Dave see it
4. Sarah does NOT see a "Dave" tab or the message
5. Dave clicks on DM tab and replies → only DM and Dave see it
6. Verify unread badge appears when message received while on different tab
7. Switch back to Main → messages visible to all (Main channel still works)

### 4. Player-to-Player Channels

1. Player Dave clicks [+] button, selects Sarah
2. New "Sarah" tab appears for both Dave and Sarah
3. Dave types message → only Dave and Sarah see it
4. DM does NOT see this 1:1 channel
5. Sarah replies → conversation continues privately

### 5. Group Channels

1. DM clicks [+] button, selects Dave and Sarah (creator is auto-included)
2. Optionally names it "Secret Planning"
3. "Secret Planning" tab appears for DM, Dave, and Sarah
4. Messages in this channel only visible to the three participants
5. Other players (if any) do not see this channel

### 6. System Messages

1. New player joins session → "PlayerName joined the session" appears in Main
2. Player leaves → "PlayerName left the session" appears in Main
3. DM pauses → "Session paused" message in Main
4. DM resumes → "Session resumed" message in Main

### 7. Retention

1. Create a session and send messages
2. Verify messages in database with channelId
3. Manually set some messages' createdAt to 2 months ago
4. Trigger cleanup (or wait for scheduled run)
5. Verify old messages deleted, recent messages retained

### 8. Mobile Layout (DM)

1. Open session on mobile device (<768px)
2. Verify mode toggle shows "DM Tools" and "Chat" options
3. "DM Tools" is selected by default
4. DM Tools shows map/backdrop selectors and session controls
5. Tap "Chat" → panel switches to chat view
6. Verify unread badge appears on Chat tab when messages arrive
7. Tap drag handle and pull up → panel expands
8. Swipe down → panel collapses
9. Switch back to "DM Tools" → original DM controls visible

### 9. Mobile Layout (Player)

1. Join session as player on mobile device
2. Verify NO mode toggle (players don't see DM Tools)
3. Chat panel shows directly
4. Tap to expand, swipe to collapse
5. Verify all chat functionality works

### 10. Desktop Layout

1. Open session on desktop (≥1024px)
2. Verify chat panel visible below map
3. Click collapse button → panel minimizes to tab bar only
4. Verify unread badges still visible when collapsed
5. Click expand → full chat panel returns
6. Verify chat and DM controls are both visible simultaneously
7. Resize chat panel via drag handle

## Future Considerations

- **Dice macros:** Players could save common rolls (e.g., "Attack" = `1d20+3`, "Damage" = `1d8+1`)
- **Dice result history:** Sidebar or modal showing all rolls for the session
- **Rich formatting:** Markdown-lite support (bold, italic)
- **Chat export:** Export session log as text file
- **Character name in chat:** Show character name instead of user name during sessions
- **Channel notifications:** Browser/push notifications for messages in non-active channels
- **Channel archiving:** Archive old channels instead of keeping all tabs visible

## References

- [PRD: Chat Window](/prd.md#chat-window)
- [PRD: Req 33 - Chat at bottom of screen](/prd.md#live-sessions)
- [PRD: Req 39 - DM private messages](/prd.md#live-sessions)
- [PRD: Req 40 - Dice rolling commands](/prd.md#live-sessions)
- [Spec 011a: Session Foundation](/specs/011a-session-foundation.md)
- [Spec 011b: Session Game View](/specs/011b-session-game-view.md)
