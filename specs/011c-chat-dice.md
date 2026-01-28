# Spec 011c: Chat & Dice Rolling

## Goal

Add real-time chat to live sessions with dice rolling commands, private messaging between the DM and individual players, and persistent chat history (retained for 3 months). Chat is the primary text communication channel during gameplay.

## Scope

### In Scope

- Group chat visible to all session participants
- Private chat between DM and individual players (bidirectional)
- Dice rolling via `/roll` command (e.g., `/roll 3d6+1`)
- Dice roll results displayed inline in chat
- Chat message persistence in PostgreSQL
- 3-month retention with automatic cleanup
- Chat history loaded on session join (recent messages)
- Real-time message delivery via WebSocket
- Chat UI integrated into the session game view

### Out of Scope

- Chat between players (only DM↔Player private messages, plus group chat)
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

**ChatMessage Model (prisma/schema.prisma):**

```prisma
model ChatMessage {
  id        String          @id @default(cuid())
  content   String          // Raw message text (or dice command)
  type      ChatMessageType @default(TEXT)
  createdAt DateTime        @default(now())

  sessionId String
  session   Session         @relation(fields: [sessionId], references: [id], onDelete: Cascade)

  senderId  String
  sender    User            @relation(fields: [senderId], references: [id], onDelete: Cascade)

  // Private message target (null = group message)
  recipientId String?
  recipient   User?         @relation("chat_recipients", fields: [recipientId], references: [id], onDelete: Cascade)

  // Dice roll results (populated when type is ROLL)
  diceExpression String?    // e.g., "3d6+1"
  diceRolls      Json?      // e.g., [4, 2, 6]
  diceTotal      Int?       // e.g., 13 (sum + modifier)
  diceModifier   Int?       // e.g., 1

  @@index([sessionId, createdAt])
  @@index([sessionId, recipientId])
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
  messages ChatMessage[]
}
```

**Update User Model:**

```prisma
model User {
  // ... existing fields
  chatMessages     ChatMessage[]
  chatRecipients   ChatMessage[]  @relation("chat_recipients")
}
```

**Migration:** `011c_chat_messages` creates the chat_messages table.

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
| `chat:message` | `{ content, recipientId? }` | Send a chat message (or dice roll) |

The server determines if the message is a dice roll by checking if `content` starts with `/roll `. If so, the server:
1. Parses the dice expression
2. Rolls the dice (server-authoritative)
3. Stores the result as a ROLL message
4. Broadcasts the result

This ensures dice rolls are server-authoritative — no one can fake a roll.

**Server → Client:**

| Type | Payload | Description |
|------|---------|-------------|
| `chat:message` | `{ message }` | New chat message (text, roll, or system) |
| `chat:history` | `{ messages }` | Recent message history on connect |

**Message payload shape (matches DB record):**

```typescript
interface ChatMessagePayload {
  id: string
  content: string
  type: 'TEXT' | 'ROLL' | 'SYSTEM'
  createdAt: string
  sender: {
    id: string
    name: string
    avatarUrl: string | null
  }
  recipientId: string | null  // null = group, userId = private
  recipient?: {
    id: string
    name: string
  }
  // Dice roll fields (only for ROLL type)
  diceExpression?: string
  diceRolls?: number[]
  diceTotal?: number
  diceModifier?: number
}
```

**Private message routing:**
- If `recipientId` is set, the message is only sent to the sender and the recipient
- The sender sees their own private message in their chat (for confirmation)
- Other users never see private messages

**System messages:**
- Generated by the server (no sender action)
- Examples: "Dave joined the session", "Session paused", "Session resumed"
- Stored in DB with `type: SYSTEM` and `senderId` set to the acting user

### 4. REST API Endpoints

#### GET /api/sessions/:id/messages

Load chat history for a session. Used on initial page load (WebSocket provides live messages after connection).

**Query params:**
- `before` (optional): Cursor-based pagination — load messages before this message ID
- `limit` (optional): Number of messages to load (default 50, max 100)
- `recipientId` (optional): Filter to private messages with a specific user (DM use only)

**Response (200):**
```json
{
  "messages": [
    {
      "id": "clx...",
      "content": "You enter a dimly lit corridor...",
      "type": "TEXT",
      "createdAt": "2026-01-27T12:10:00.000Z",
      "sender": {
        "id": "clx...",
        "name": "Gary",
        "avatarUrl": null
      },
      "recipientId": null
    },
    {
      "id": "clx...",
      "content": "/roll 1d20+3",
      "type": "ROLL",
      "createdAt": "2026-01-27T12:10:30.000Z",
      "sender": {
        "id": "clx...",
        "name": "Dave",
        "avatarUrl": null
      },
      "recipientId": null,
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
- DM and active participants can load messages
- Players can only see group messages and their own private messages
- DM can see all messages including all private conversations

**Errors:**
- 401: Not authenticated
- 403: Not a DM or participant of this session
- 404: Session not found

### 5. Chat UI

#### Chat Panel (client/src/components/ChatPanel.tsx)

The chat panel is integrated into the session game view layout.

**Desktop layout:** The chat panel sits below the map display area (or below the player sidebar — implementation can choose the best fit).

**Layout option — bottom bar (preferred):**
```
┌──────────────────────────────────────────────────────────────────┐
│  Header                                                          │
├──────────────────────────────────────────────┬───────────────────┤
│                                              │ Player sidebar    │
│           MAP / BACKDROP AREA                │                   │
│                                              │                   │
├──────────────────────────────────────────────┤                   │
│  CHAT                                        │                   │
│  ┌──────────────────────────────────────┐    │                   │
│  │ Gary: You enter a dimly lit corridor │    │                   │
│  │ Dave: I check for traps             │    │                   │
│  │ Dave: /roll 1d20+3                  │    │                   │
│  │ ⚅ Dave rolled 1d20+3: [17]+3 = 20  │    │                   │
│  │ Gary: The corridor is clear.        │    │                   │
│  └──────────────────────────────────────┘    │                   │
│  [Group ▾] ┌────────────────────────┐ [Send]│                   │
│            │ Type a message...      │       │                   │
│            └────────────────────────┘       │                   │
├──────────────────────────────────────────────┴───────────────────┤
│  DM Controls                                                     │
└──────────────────────────────────────────────────────────────────┘
```

**Chat area features:**
- Scrollable message list (newest at bottom)
- Auto-scroll to bottom on new messages (unless user has scrolled up)
- "New messages" indicator when scrolled up and new messages arrive
- Load more button at top (or infinite scroll) for history
- Messages grouped by timestamp (if <1 minute apart from same sender, collapse)

**Input area:**
- Text input field (single line, Enter to send, Shift+Enter for newline)
- Channel selector dropdown: "Group" (default), or a player name for private messages
- Send button
- DM sees all player names in the channel selector
- Players see only "Group" and "DM" in the channel selector

**Mobile layout:**
- Chat panel in a slide-up drawer
- Toggle button shows unread message count badge
- Full-width when open, covers bottom portion of screen

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

**Private message (visible to sender and recipient only):**
```
┌─────────────────────────────────────────────┐
│ 🔒 Gary → Dave (private)         12:11 PM  │
│ Make a secret perception check.             │
└─────────────────────────────────────────────┘
```

Private messages styled differently:
- Lock icon prefix
- "→ Recipient" shown after sender name
- "(private)" label
- Slightly different background (light gray tint or dashed border)

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

Chat messages are retained for **3 months** from creation.

**Cleanup approach:** A scheduled task or database trigger deletes messages older than 3 months.

**Implementation options (in order of preference):**

1. **Cron job in server:** On server startup, schedule a daily cleanup that runs:
   ```sql
   DELETE FROM chat_messages WHERE "createdAt" < NOW() - INTERVAL '3 months'
   ```

2. **Manual cleanup endpoint** (admin use): `DELETE /api/admin/cleanup-chat` — run manually or via external cron.

For this spec, implement option 1 (scheduled cleanup on server startup, runs daily at 3:00 AM server time).

### 7. Type Definitions (shared/src/types.ts additions)

```typescript
// Chat types
export type ChatMessageType = 'TEXT' | 'ROLL' | 'SYSTEM'

export interface ChatMessage {
  id: string
  content: string
  type: ChatMessageType
  createdAt: string
  sender: {
    id: string
    name: string
    avatarUrl: string | null
  }
  recipientId: string | null
  recipient?: {
    id: string
    name: string
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
  content: string
  recipientId?: string
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
  messages: ChatMessage[]
  sendMessage: (content: string, recipientId?: string) => void
  loadMore: () => Promise<void>
  hasMore: boolean
  isLoading: boolean
  activeChannel: string | null  // null = group, recipientId = private
  setActiveChannel: (recipientId: string | null) => void
  unreadCount: number           // Unread messages since last view
}
```

**Behavior:**
1. On mount, load recent chat history via REST
2. Listen for `chat:message` and `chat:history` WebSocket events
3. Append new messages to local state
4. Handle channel switching (group vs private)
5. Track unread count when chat is not visible (mobile)
6. Support loading older messages via pagination

### 10. Project Structure Updates

**New Files:**
```
shared/src/dice.ts                            # Dice parser and roller
shared/src/dice.test.ts                       # Dice parser tests
server/src/services/chatCleanup.ts            # Scheduled chat cleanup
server/src/websocket/chatHandler.ts           # Chat WebSocket message handler
client/src/components/ChatPanel.tsx           # Chat UI panel
client/src/components/ChatMessage.tsx         # Individual message renderer
client/src/components/DiceResult.tsx          # Dice roll display component
client/src/components/ChatInput.tsx           # Chat input with channel selector
client/src/hooks/useChat.ts                   # Chat state management hook
```

**Modified Files:**
```
prisma/schema.prisma                          # Add ChatMessage model
shared/src/types.ts                           # Add chat types
server/src/app.ts                             # Register chat cleanup schedule
server/src/routes/sessions.ts                 # Add messages endpoint
server/src/websocket/handlers.ts              # Add chat message handling
client/src/pages/SessionGameView.tsx          # Integrate ChatPanel
client/src/hooks/useSessionSocket.ts          # Handle chat message types
```

## Design Details

### Chat Aesthetic

The chat should resemble a logbook or adventure journal:

- **Background:** Parchment with subtle paper texture
- **Messages:** Body font for message content
- **Sender name:** Display font, all caps, small size
- **Timestamp:** Muted ink color, small size, right-aligned
- **Dice rolls:** Monospace font for the roll expression and numbers
- **Private messages:** Dashed border or subtle background change
- **System messages:** Centered, italic, muted

### Dice Roll Styling

Dice results should feel tactile and exciting:

```
┌─────────────────────────────────────────┐
│  ⚅  3d6+1                              │
│  [4] [2] [6] + 1 = 13                  │
└─────────────────────────────────────────┘
```

- Each individual die result in a small box/badge (like a die face)
- Modifier shown separately
- Total is bold and larger
- Natural 20 on d20: bold with subtle highlight
- Natural 1 on d20: muted/crossed style
- Die icon (⚅) uses the display font

### Chat Input Styling

```
┌──────────────┬────────────────────────────────────┬──────┐
│ [Group ▾]    │ Type a message or /roll 2d6...     │ Send │
└──────────────┴────────────────────────────────────┴──────┘
```

- Channel selector: small dropdown, neobrutalism style
- Input: thick black border, parchment background
- Send button: neobrutalism button (inverts on hover)
- Placeholder text changes based on channel:
  - Group: "Address the party..."
  - Private (DM): "Whisper to the Dungeon Master..."
  - Private (Player): "Whisper to {name}..."

## Acceptance Criteria

### Chat Messages
- [ ] Users can send text messages visible to all participants
- [ ] Messages appear in real-time for all connected users
- [ ] Messages display sender name, content, and timestamp
- [ ] Messages persist in database
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

### Private Messages
- [ ] DM can send private message to any player
- [ ] Player can send private message to DM only
- [ ] Private messages only visible to sender and recipient
- [ ] Private messages visually distinct (lock icon, label)
- [ ] Channel selector allows switching between group and private
- [ ] DM channel selector lists all player names
- [ ] Player channel selector shows only "Group" and "DM"

### System Messages
- [ ] "Player joined" message appears when player joins
- [ ] "Player left" message appears when player leaves
- [ ] "Session paused" / "Session resumed" messages appear
- [ ] System messages centered and styled differently

### Chat Retention
- [ ] Messages stored with session and user references
- [ ] Cleanup job deletes messages older than 3 months
- [ ] Cleanup runs daily
- [ ] Cascade delete removes messages when session deleted

### Chat UI
- [ ] Chat panel visible in session game view
- [ ] Mobile: slide-up drawer with unread badge
- [ ] Messages render correctly (text, rolls, private, system)
- [ ] Input field clears after sending
- [ ] Enter sends, Shift+Enter adds newline
- [ ] B/X aesthetic matches rest of application

## Verification Steps

### 1. Group Chat

1. DM and two players in a session
2. DM types message → all three see it
3. Player 1 types message → all three see it
4. Verify timestamps and sender names correct
5. Refresh page → chat history loads
6. Scroll up → "Load more" loads older messages

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

### 3. Private Messages

1. DM selects "Dave" from channel selector
2. DM types private message → only DM and Dave see it
3. Player 2 (Sarah) does not see the message
4. Dave selects "DM" from channel selector
5. Dave replies privately → only DM and Dave see it
6. Switch back to "Group" → messages visible to all

### 4. System Messages

1. New player joins session → "PlayerName joined the session" appears
2. Player leaves → "PlayerName left the session" appears
3. DM pauses → "Session paused" message
4. DM resumes → "Session resumed" message

### 5. Retention

1. Create a session and send messages
2. Verify messages in database
3. Manually set some messages' createdAt to 4 months ago
4. Trigger cleanup (or wait for scheduled run)
5. Verify old messages deleted, recent messages retained

## Future Considerations

- **Dice macros:** Players could save common rolls (e.g., "Attack" = `1d20+3`, "Damage" = `1d8+1`)
- **Dice result history:** Sidebar or modal showing all rolls for the session
- **Rich formatting:** Markdown-lite support (bold, italic)
- **Chat export:** Export session log as text file
- **Whisper groups:** DM messages to subset of players
- **Character name in chat:** Show character name instead of user name during sessions

## References

- [PRD: Chat Window](/prd.md#chat-window)
- [PRD: Req 33 - Chat at bottom of screen](/prd.md#live-sessions)
- [PRD: Req 39 - DM private messages](/prd.md#live-sessions)
- [PRD: Req 40 - Dice rolling commands](/prd.md#live-sessions)
- [Spec 011a: Session Foundation](/specs/011a-session-foundation.md)
- [Spec 011b: Session Game View](/specs/011b-session-game-view.md)
