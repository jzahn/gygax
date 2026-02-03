# Spec 011b: Session Game View, DM Controls & Voice Chat

## Goal

Build the live session game view — the main screen where gameplay happens. This includes the session layout (map/backdrop display, player sidebar, DM controls), real-time map and backdrop switching, and WebRTC peer-to-peer voice chat.

## Scope

### In Scope

- Session game view layout (map/backdrop area + player sidebar)
- DM controls: switch active map, display backdrop, return to map
- Real-time map/backdrop sync to all connected players
- Player read-only map view (no editing tools)
- Player cards sidebar (DM and all players with character info)
- WebRTC voice chat (peer-to-peer audio)
- Mute/unmute controls
- Active speaker indicator
- DM pause/resume/end controls in game view
- Session status banner (paused state)
- Responsive layout (mobile: slide-out panels)

### Out of Scope

- Chat and dice rolling — spec 011c
- Fog of war — spec 011d
- Map editing during session (DM edits map mid-session) — future
- Token placement/movement — future
- Random encounter triggers — future
- Screen sharing or video — not in MVP

## Dependencies

**Builds on:**
- Spec 011a: Session model, WebSocket infrastructure, connection management
- Spec 010a-010d: MapCanvas component, map rendering
- Spec 008: Backdrops (backdrop display)

**New dependencies:**
- None — WebRTC is a browser-native API. The signaling goes through the existing WebSocket connection.

## Detailed Requirements

### 1. Session Game View Layout

The game view is shown when the session status is **ACTIVE** or **PAUSED**. When the session is **FORMING**, the lobby/waiting room UI from 011a is shown instead. The session page component (`SessionPage.tsx`) conditionally renders either the lobby view or the game view based on session status.

**Desktop Layout (≥1024px):**

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Adventure    The Keep on the Borderlands    K7X9M2    ● LIVE │
├──────────────────────────────────────────────────┬───────────────┤
│                                                  │ ★ Gary (DM)  │
│                                                  │   ● Speaking  │
│                                                  │───────────────│
│                                                  │ Theron        │
│                                                  │ Fighter 3     │
│              MAP / BACKDROP                      │ HP: 18/22     │
│              DISPLAY AREA                        │ AC: 4         │
│                                                  │───────────────│
│                                                  │ Elara         │
│                                                  │ Magic-User 2  │
│                                                  │ HP: 6/6       │
│                                                  │ AC: 9         │
│                                                  │───────────────│
│                                                  │ Bodo          │
│                                                  │ Halfling 1    │
│                                                  │ HP: 4/4       │
│                                                  │ AC: 7         │
│                                                  │───────────────│
│                                                  │               │
│                                                  │ [🔇 Mute]     │
├──────────────────────────────────────────────────┴───────────────┤
│  DM CONTROLS (only for DM):                                     │
│  [Map ▾] [Backdrop ▾] [Clear Display] │ [Pause] [End Session]  │
└──────────────────────────────────────────────────────────────────┘
```

**Tablet Layout (768px–1023px):**
- Player sidebar collapses to a toggle button
- Sidebar slides over the map when opened
- DM controls remain at bottom

**Mobile Layout (<768px):**
- Map/backdrop takes full screen
- Player list accessible via toggle button (slides in from right)
- DM controls accessible via toggle button (slides up from bottom)
- Voice controls float as a small pill in the corner

### 2. Map Display Area

When the DM has selected a map, display it using the existing MapCanvas component in **read-only mode** for players.

**DM view:**
- Full MapCanvas with pan and zoom (same as map editor)
- No drawing tools visible (this is session view, not editor)
- Map name shown in the display area header

**Player view:**
- Same MapCanvas with pan and zoom
- Read-only (no editing capabilities)
- Map syncs in real-time when DM switches maps

**No map selected:**
- Display a centered message: "Awaiting the Dungeon Master..." in display font
- Parchment background

### 3. Backdrop Display Area

When the DM displays a backdrop, it replaces the map in the display area.

- Backdrop image fills the display area with object-fit cover
- Backdrop title overlaid if present (using the backdrop's title position)
- Parchment border frame around the image
- DM can switch between backdrop and map freely

### 4. DM Controls

A control bar at the bottom of the game view, visible only to the DM.

**Map Selector:**
- Dropdown listing all maps in the adventure
- Selecting a map sets it as the active display
- Current map highlighted
- Shows map name and grid type (Square/Hex)

**Backdrop Selector:**
- Dropdown listing all backdrops in the adventure
- Selecting a backdrop replaces the map display
- Shows backdrop name and thumbnail

**Clear Display:**
- Button to clear both map and backdrop (shows "Awaiting..." state)
- Useful for narrative moments with no visual

**Session Controls:**
- Pause Session → pauses, shows paused banner to all
- End Session → confirmation dialog, then ends session

### 5. Player Cards Sidebar

A vertical list of all session participants (DM + players) on the right side.

**DM Card:**
```
┌───────────────────────┐
│ [Avatar] ★ Gary       │
│          Dungeon Master│
│          ● Speaking    │
└───────────────────────┘
```

**Player Card:**
```
┌───────────────────────┐
│ [Avatar] Theron       │
│          Fighter 3    │
│          HP: 18/22    │
│          AC: 4        │
│          ● Online     │
└───────────────────────┘
```

**Card details:**
- Avatar image (square, brutalist style)
- Character name (for players) or user name (for DM)
- Class and level (players only)
- HP current/max (players only) — visible to everyone (like a real tabletop)
- AC (players only) — visible to everyone
- Connection status indicator (Online/Offline)
- Active speaker indicator (when speaking via WebRTC)

**Avatar fallback chain:** Character's avatarUrl → User's avatarUrl → Initials. Full color (per design system — avatars are one of the rare color elements).

**Star icon (★):** Marks the DM in the list. DM always appears first.

### 6. WebRTC Voice Chat

#### Architecture

Peer-to-peer mesh topology using WebRTC. Each participant establishes a direct audio connection with every other participant. For sessions of 1 DM + up to 8 players (9 total), mesh is viable.

#### Signaling via WebSocket

WebRTC peer connections require a signaling channel to exchange SDP offers/answers and ICE candidates. Use the existing WebSocket connection for signaling.

**New WebSocket messages (Client → Server, relayed to target peer):**

| Type | Payload | Description |
|------|---------|-------------|
| `rtc:offer` | `{ targetUserId, sdp }` | SDP offer to initiate connection |
| `rtc:answer` | `{ targetUserId, sdp }` | SDP answer in response to offer |
| `rtc:ice-candidate` | `{ targetUserId, candidate }` | ICE candidate for NAT traversal |
| `rtc:mute-state` | `{ muted }` | Broadcast mute/unmute status |

**Server behavior:** The server relays these messages to the target user without inspecting the contents. It adds a `fromUserId` field so the recipient knows who sent it.

**New WebSocket messages (Server → Client):**

| Type | Payload | Description |
|------|---------|-------------|
| `rtc:offer` | `{ fromUserId, sdp }` | Relayed SDP offer |
| `rtc:answer` | `{ fromUserId, sdp }` | Relayed SDP answer |
| `rtc:ice-candidate` | `{ fromUserId, candidate }` | Relayed ICE candidate |
| `rtc:mute-state` | `{ userId, muted }` | Broadcast mute/unmute |

#### Connection Flow

1. User joins session and connects WebSocket
2. User receives `session:state` with list of connected users
3. For each already-connected user, the **newer** user (joiner) creates an RTCPeerConnection and sends an `rtc:offer`
4. The existing user receives the offer, creates an answer, sends `rtc:answer`
5. Both exchange ICE candidates via `rtc:ice-candidate`
6. Once connected, audio streams flow directly peer-to-peer
7. When a user disconnects, close all their peer connections

#### STUN/TURN Configuration

```typescript
const rtcConfig: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    // TURN server (optional, for users behind restrictive NAT)
    // Configure via environment variables if needed
  ]
}
```

For MVP, use free Google STUN servers. TURN is not required for most users but can be added later via environment configuration.

#### Audio Controls

**Mute/Unmute button:**
- Toggle button at the bottom of the player sidebar
- Default: unmuted (microphone active)
- Muted state: microphone track disabled, icon changes
- Broadcasts mute state via WebSocket so other users see the indicator

**No push-to-talk in MVP** — open mic with mute toggle (like Discord default).

**Active speaker detection:**
- Use `AudioContext` + `AnalyserNode` on incoming audio streams
- Detect when audio level exceeds threshold
- Show speaking indicator on the player card (subtle glow or pulsing dot)
- Speaking indicator uses green (one of the approved color accents)

#### Audio Hook (client/src/hooks/useVoiceChat.ts)

```typescript
interface UseVoiceChatOptions {
  sessionId: string
  userId: string
  connectedUsers: WSConnectedUser[]
  socket: WebSocket | null
  enabled?: boolean
}

interface UseVoiceChatReturn {
  isMuted: boolean
  toggleMute: () => void
  speakingUsers: Set<string>  // Set of userIds currently speaking
  audioEnabled: boolean       // Whether audio permission was granted
  error: string | null
}
```

**Behavior:**
1. Auto-connect: Request microphone permission on mount (when game view loads)
2. Create local audio stream (unmuted by default)
3. For each connected user, manage an RTCPeerConnection
4. Handle offer/answer/ICE exchange via WebSocket
5. Play received audio streams (create `<audio>` elements)
6. Detect active speakers
7. Clean up all connections on unmount

**Auto-connect UX:** Voice connects automatically when entering the game view. Users who deny microphone permission can still participate — they just can't speak (voice disabled, map/chat work normally). A visual indicator shows voice status.

### 7. Map/Backdrop Switching WebSocket Messages

**New WebSocket messages (Client → Server, DM only):**

| Type | Payload | Description |
|------|---------|-------------|
| `session:set-map` | `{ mapId }` | DM selects a map to display |
| `session:set-backdrop` | `{ backdropId }` | DM selects a backdrop to display |
| `session:clear-display` | `{}` | DM clears the display |

**Server behavior:**
1. Validate the sender is the DM
2. Update the session's `activeMapId`/`activeBackdropId` in the database
3. Broadcast `session:updated` to all connected users with the new state

**Client behavior:**
- On receiving `session:updated`, check `activeMapId` and `activeBackdropId`
- If `activeMapId` changed → fetch map data via REST (`GET /api/adventures/:adventureId/maps/:mapId`) and render MapCanvas
- If `activeBackdropId` changed → fetch backdrop data via REST (`GET /api/adventures/:adventureId/backdrops/:backdropId`) and display image
- If both null → show "Awaiting..." state
- Cache fetched maps/backdrops in memory for the session duration (switching back to a previously shown map is instant)

### 8. Session Status Banner

When the DM pauses a session, all users see a banner across the top of the game view:

```
┌──────────────────────────────────────────────────────────────────┐
│  ⏸ SESSION PAUSED — The Dungeon Master has paused the session    │
└──────────────────────────────────────────────────────────────────┘
```

- Banner appears below the header bar
- Parchment background with dashed border
- DM sees: "⏸ SESSION PAUSED" with a [Resume] button
- Players see: "⏸ SESSION PAUSED — The Dungeon Master has paused the session"
- Map/backdrop still visible but dimmed slightly (opacity 0.6)
- Voice chat remains active during pause (players can still talk)

When the session ends:

```
┌──────────────────────────────────────────────────────────────────┐
│  SESSION ENDED — The adventure concludes... for now.             │
│  [Return to Adventure] (DM) / [Return to Sessions] (Player)     │
└──────────────────────────────────────────────────────────────────┘
```

### 9. Type Definitions (shared/src/types.ts additions)

```typescript
// WebSocket messages for 011b
export interface WSSetMap {
  mapId: string | null
}

export interface WSSetBackdrop {
  backdropId: string | null
}

export interface WSRtcOffer {
  targetUserId: string
  sdp: RTCSessionDescriptionInit
}

export interface WSRtcAnswer {
  targetUserId: string
  sdp: RTCSessionDescriptionInit
}

export interface WSRtcIceCandidate {
  targetUserId: string
  candidate: RTCIceCandidateInit
}

export interface WSRtcMuteState {
  muted: boolean
}

// Relayed versions (server adds fromUserId)
export interface WSRtcOfferRelayed {
  fromUserId: string
  sdp: RTCSessionDescriptionInit
}

export interface WSRtcAnswerRelayed {
  fromUserId: string
  sdp: RTCSessionDescriptionInit
}

export interface WSRtcIceCandidateRelayed {
  fromUserId: string
  candidate: RTCIceCandidateInit
}

export interface WSRtcMuteStateRelayed {
  userId: string
  muted: boolean
}
```

### 10. Project Structure Updates

**New Files:**
```
client/src/pages/SessionGameView.tsx           # Main game view component
client/src/components/PlayerCardsSidebar.tsx    # Player cards panel
client/src/components/SessionPlayerCard.tsx     # Individual player card
client/src/components/DMControls.tsx            # DM control bar
client/src/components/MapDisplay.tsx            # Map display in session context
client/src/components/BackdropDisplay.tsx       # Backdrop display in session
client/src/components/SessionStatusBanner.tsx   # Pause/end banner
client/src/components/VoiceControls.tsx         # Mute/unmute UI
client/src/hooks/useVoiceChat.ts               # WebRTC voice hook
server/src/websocket/rtcRelay.ts               # WebRTC signaling relay
```

**Modified Files:**
```
shared/src/types.ts                            # Add WebRTC and display types
server/src/websocket/handlers.ts               # Add map/backdrop/RTC message handlers
server/src/websocket/sessionManager.ts         # Add display state management
client/src/pages/SessionPage.tsx               # Conditionally render game view vs lobby
client/src/hooks/useSessionSocket.ts           # Handle new message types
```

**Existing endpoints used (no changes needed):**
```
GET /api/adventures/:adventureId/maps          # List maps for DM dropdown
GET /api/adventures/:adventureId/maps/:id      # Fetch full map data on switch
GET /api/adventures/:adventureId/backdrops     # List backdrops for DM dropdown
GET /api/adventures/:adventureId/backdrops/:id # Fetch backdrop data on switch
```

## Design Details

### Game View Aesthetic

The game view should feel like sitting at a table with a map spread out and character sheets around it:

- **Map area:** The MapCanvas component (already B/X styled — black ink on white, parchment frame)
- **Sidebar:** Parchment background, player cards as index card components
- **DM controls:** Dark control bar at bottom (black background, cream text) — like the edge of the game table
- **Overall:** No chrome or polish beyond the B/X aesthetic. Functional, utilitarian.

### Player Card Design

Cards use the neobrutalism card style:
- Thick black border (3px)
- Parchment background
- Shadow offset
- Avatar in full color (square, 48x48px)
- Character name in display font
- Stats in body font
- Speaking indicator: green pulsing dot (approved accent color)

### DM Controls Bar

```
┌──────────────────────────────────────────────────────────────────┐
│  📜 [Dungeon Level 1 ▾]  🖼 [Backdrops ▾]  [✕ Clear]  │  ⏸ ■  │
└──────────────────────────────────────────────────────────────────┘
```

- Dark background (ink color) with cream text — inverted from the rest of the UI
- Map dropdown shows all adventure maps with grid type indicator
- Backdrop dropdown shows all adventure backdrops with thumbnails
- Clear button removes current display
- Pause (⏸) and End (■) buttons on the right side
- Fixed to the bottom of the viewport

### Responsive Considerations

**Desktop (≥1024px):**
- Map area: ~75% width
- Player sidebar: ~25% width, always visible
- DM controls: full-width bar at bottom

**Tablet (768px–1023px):**
- Map area: full width
- Player sidebar: overlay panel, toggles via button in header
- DM controls: full-width bar at bottom

**Mobile (<768px):**
- Map area: full screen
- Player sidebar: slide-in panel from right
- DM controls: slide-up panel from bottom
- Voice controls: floating pill in bottom-left corner

## Acceptance Criteria

### Game View Layout
- [ ] Session page shows game view when session is ACTIVE or PAUSED
- [ ] Session page shows lobby view when session is FORMING
- [ ] Map area fills available space
- [ ] Player sidebar shows DM and all participants
- [ ] DM controls bar visible only to DM
- [ ] Layout is responsive across desktop/tablet/mobile

### Map Display
- [ ] DM can select a map from adventure maps dropdown
- [ ] Selected map renders in MapCanvas (read-only for players)
- [ ] Map change broadcasts to all connected users in real-time
- [ ] Players see the same map the DM selected
- [ ] Pan and zoom work for both DM and players (independent viewports)
- [ ] "Awaiting..." message shown when no map/backdrop selected

### Backdrop Display
- [ ] DM can select a backdrop from adventure backdrops dropdown
- [ ] Backdrop image displays with object-fit cover
- [ ] Backdrop title overlaid if present
- [ ] Backdrop replaces map display (and vice versa)
- [ ] Backdrop change broadcasts to all connected users

### DM Controls
- [ ] Map dropdown lists all adventure maps
- [ ] Backdrop dropdown lists all adventure backdrops
- [ ] Clear display button works
- [ ] Pause button pauses session, shows banner to all
- [ ] Resume button (visible when paused) resumes session
- [ ] End button shows confirmation, then ends session

### Player Cards
- [ ] DM card shows first with star indicator
- [ ] Player cards show character name, class, level, HP, AC
- [ ] All participants see all player stats (like a real tabletop)
- [ ] Online/offline status updates in real-time
- [ ] Speaking indicator appears when user is talking
- [ ] Avatar shows character avatar → user avatar → initials fallback

### Voice Chat
- [ ] Voice auto-connects when entering game view
- [ ] Browser prompts for microphone permission automatically
- [ ] Audio streams between all participants
- [ ] Mute/unmute toggle works
- [ ] Mute state visible to other users
- [ ] Active speaker detection shows speaking indicator
- [ ] Voice continues during paused session
- [ ] Voice disconnects when leaving session
- [ ] Handles users joining/leaving mid-session (new connections established/torn down)
- [ ] Graceful fallback if microphone denied (voice disabled, everything else works)

### Session Status
- [ ] Paused banner appears for all users when DM pauses
- [ ] Map/backdrop dims during pause
- [ ] End banner shows with navigation links
- [ ] DM navigated back to adventure, player to sessions list

## Verification Steps

### 1. Map/Backdrop Switching

1. DM starts session, opens game view
2. Player joins, opens game view
3. DM selects a map → both see the map
4. DM switches to a different map → both see the new map
5. DM selects a backdrop → map replaced by backdrop for both
6. DM clicks Clear → both see "Awaiting..." message
7. DM selects map again → both see map

### 2. Voice Chat

1. DM and player both in session
2. Both grant microphone permission
3. Verify audio is heard in both directions
4. DM mutes → player sees mute indicator, hears no audio from DM
5. DM unmutes → audio resumes
6. Second player joins → voice connects with both existing participants
7. Player leaves → their voice connection closes, others unaffected
8. Deny microphone → voice disabled, map/chat still work

### 3. Player Cards

1. DM starts session → DM card shows in sidebar
2. Player 1 joins → their card appears with character name, class, level, HP, AC
3. Player 2 joins → their card appears below Player 1
4. Verify all participants see HP/AC for all players (tabletop style)
5. Player 1 speaks → speaking indicator on their card
6. Player 2 disconnects → card shows offline status
7. Player 2 reconnects → card shows online status
8. Verify avatar fallback: character avatar → user avatar → initials

### 4. Session Lifecycle in Game View

1. DM pauses → banner appears, map dims, voice continues
2. DM resumes → banner disappears, map returns to normal
3. DM ends → end banner appears with navigation links
4. DM clicks "Return to Adventure" → navigated to adventure page
5. Player clicks "Return to Sessions" → navigated to session browse

### 5. Responsive Layout

1. Open session on desktop → sidebar visible, map fills rest
2. Resize to tablet → sidebar becomes toggle panel
3. Resize to mobile → full-screen map, slide-out panels
4. Verify voice controls accessible at all sizes
5. Verify DM controls accessible at all sizes

## Future Considerations

- **Spec 011c:** Chat window will be added below the map area or in a slide-out panel
- **Spec 011d:** Fog of war overlay on the map display
- **Map editing mid-session:** DM could enter edit mode, players see "DM is updating..." (PRD Flow 11)
- **Token placement:** Player/NPC tokens on the map
- **TURN server:** For users behind restrictive NATs, add TURN server configuration

## References

- [PRD: Flow 7 - Gameplay Loop](/prd.md#flow-7-gameplay-loop)
- [PRD: Flow 9 - DM Switches Maps](/prd.md#flow-9-dm-switches-maps-during-session)
- [PRD: Flow 10 - DM Displays Backdrop](/prd.md#flow-10-dm-displays-backdrop-during-session)
- [PRD: Player Cards](/prd.md#player-cards)
- [PRD: WebRTC Audio](/prd.md#audio)
- [Spec 011a: Session Foundation](/specs/011a-session-foundation.md)
- [Spec 010a: Map Foundation](/specs/010a-map-foundation.md)
- [Spec 008: Backdrops](/specs/008-backdrops.md)
- [WebRTC API (MDN)](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API)
