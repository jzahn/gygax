# Product Requirements Document: Gygax

## Overview

### Project Name

Gygax

### One-Line Description

Gygax is a web application that allows a Dungeon Master to host a D&D game online for a group of players.

### Problem Statement

Currently most pen and paper D&D games are played via Discord, which lacks purpose-built tools for tabletop RPGs. Existing virtual tabletop (VTT) solutions like Roll20 and Foundry are complex, expensive, or focused on modern D&D editions. There's a gap for a streamlined VTT that embraces the simplicity of old-school D&D (OSR) gameplay.

### Target Users

- **Dungeon Masters** running online campaigns, particularly those who prefer Moldvay B/X or other OSR systems
- **Players** joining remote D&D sessions who want a more immersive experience than Discord screen-sharing
- **OSR Community** members seeking a VTT that respects theater-of-the-mind gameplay while still providing useful visual aids

---

## Key Concepts

| Term                    | Definition                                                                                              |
| ----------------------- | ------------------------------------------------------------------------------------------------------- |
| **Campaign**            | A collection of Adventures with a name, description, and landscape banner image. Contains a world map accessible from all Adventures within it (with shared fog of war). |
| **Adventure**           | A DM's playable unit containing maps, encounters, backdrops, NPCs, and notes. The core organizational unit for game content that persists between sessions. |
| **Session**             | A live game instance started from an Adventure that players join. Real-time sync of map, chat, and audio. Players browse and join active Sessions (don't see Campaign/Adventure hierarchy). |
| **Map**                 | A drawable grid (hex for outdoor/wilderness, square for indoor/dungeon) in B/X black-and-white style.   |
| **Transition**          | Moving between maps. In Phase 1, DM manually switches the displayed map. Phase 2 adds formal linking.   |
| **Encounter**           | A meeting with creatures/NPCs. Can be **static** (placed on map) or **random** (triggered from tables). |
| **Fog of War**          | Unexplored areas hidden from players. Revealed by DM as party explores. State persists per-map.         |
| **Backdrop**            | An image a DM can display to players during a session instead of a map (town scenes, battle illustrations, monster images, etc.). |
| **Notes**               | DM notes with title and content for organizing adventure information.                                    |
| **DM (Dungeon Master)** | The user who creates campaigns/adventures, draws maps, runs sessions, and controls the game world.      |
| **Player**              | A user who creates characters and joins sessions to explore the DM's world.                             |

---

## Technical Specifications

### Tech Stack

- **Language:** TypeScript (full-stack)
- **Frontend:** React with Canvas/WebGL for map rendering
- **UI Components:** [Neobrutalism Components](https://www.neobrutalism.dev/) (React + Tailwind, shadcn/ui based) — customized for B/X aesthetic
- **Backend:** Node.js with Fastify
- **Real-time:** WebSockets (native WS) for chat, map sync, and game state
- **Audio:** WebRTC for peer-to-peer voice chat
- **Database:** PostgreSQL for persistent data (users, campaigns, maps, encounters)
- **Auth:** Email/password with JWT in httpOnly cookies (hand-rolled using Argon2id + jose)
- **File Storage:** S3-compatible storage for map images and avatars

### Project Type

Web application (SPA frontend + API backend)

### Platform/Environment

- **Server:** Node.js deployable to any cloud provider (Vercel, Railway, Fly.io, self-hosted)
- **Client:** Modern browsers (Chrome, Firefox, Safari, Edge) - desktop-first design
- **Development:** macOS/Linux/Windows with Docker for local database

---

## Core Features

### Application Structure

The application has two main navigation modes accessible via a persistent top navigation bar:

**Forge (DM Tools):** Where DMs create and manage campaigns, adventures, maps, backdrops, NPCs, and notes. This is the default landing page after login (dashboard at `/`).

**Adventure (Player Experience):** Where players create characters and browse/join active game sessions. Accessed via `/adventure`.

**Global Navigation:**
- A sticky navigation bar appears on all authenticated pages
- Logo and "GYGAX" brand on the left (links to Forge/dashboard)
- Forge and Adventure mode links centered in the navbar
- User avatar with dropdown menu on the right (displays user name, email, and logout option)
- On mobile (< 768px), the centered nav links collapse into a hamburger menu; avatar remains visible

### MVP Features (Must Have)

#### Authentication & Users
1. Users can login to the system with an email and password, or a magic link sent to their email.
2. Players and the DM should be able to input their character name and an avatar image.

#### Forge Mode - Campaigns
3. DMs can create, save, and manage multiple Campaigns (collections of Adventures).
4. Campaigns have a name, description, and landscape banner image with selectable hotspot.
5. Campaign detail page shows banner at top, title, description, and list of Adventure cards.
6. Each Campaign has a world map accessible from all Adventures within it (with shared fog of war).

#### Forge Mode - Adventures
7. DMs can create, save, and manage multiple Adventures within a Campaign.
8. Upon login, DMs see a dashboard listing their saved Campaigns and can select one to view Adventures.
9. DMs can build Adventure content (maps, encounters, backdrops, NPCs, notes) at any time.
10. All Adventure data persists automatically; DMs can log out and return to continue building.
11. DMs can start a live game session from any saved Adventure when ready to play.

#### Forge Mode - Maps
12. DMs can create and edit maps.
13. Maps are represented by a hexagonal grid when outdoors and a square grid when indoors.
14. Maps are viewed from an overhead perspective.
15. DM can switch between Adventure maps during a session, displaying any map to players.

#### Forge Mode - Backdrops
16. DMs can upload backdrop images for display during sessions.
17. Backdrops can show town scenes, battle illustrations, monster images, etc.
18. DM can display a backdrop to players instead of a map during a session.

#### Forge Mode - NPCs
19. DMs can create characters for use as NPCs in their Adventures.
20. DM NPCs use the same character sheet format as player characters.

#### Forge Mode - Notes
21. DMs can create notes with title and content for organizing Adventure information.

#### Forge Mode - Encounters
22. The DM can design random encounter charts and assign them to an area.
23. The DM should be able to place static encounters on the map in addition to random encounters.
24. Encounters can be both friendly or hostile.

#### Adventure Mode - Characters
25. Players can create characters in the Adventure section.
26. Characters are displayed on a B/X-style character sheet (matching Moldvay Basic rulebook).
27. Players can create multiple characters and choose which one to play when joining a session.

#### Adventure Mode - Sessions
28. Players can browse and join active game sessions being hosted by DMs.
29. When joining a session, players select which of their characters to play.
30. Users can join an existing live game session as a Player.

#### Live Sessions
31. Sessions start from an Adventure (not at Campaign level).
32. The DM and Players are represented as cards arranged vertically on the right edge of the screen.
33. The Players and Dungeon Master can communicate via a chat window at the bottom of the screen.
34. The Players and DM can see a map representation of the game world created by the DM.
35. Players can explore the map and experience a fog of war effect where undiscovered terrain is obscured.
36. The players can experience random encounters while exploring a map (indoor or outdoor).
37. A game session can be paused by the DM and persists until the next game session.
38. Players and the DM can also communicate by audio.
39. The DM should be able to private message any player back and forth.
40. The chat windows (main or private) should allow the players to roll with a command like `/roll 3d6+1`.

#### System
41. The application is designed to be used at first with the Moldvay B/X rule set.

### Nice-to-Have Features

1. Initiative tracker with turn order display
2. Bestiary/monster database for quick encounter setup
3. Dice roll history and statistics
4. Multiple map layers (GM layer hidden from players)
5. Token movement with measurement tools
6. Sound effects and ambient music integration
7. Export campaign data for backup

---

## Functional Requirements

### Inputs

- Group chat messages (text, dice commands like `/roll 3d6+1`)
- Private chat from DM to individual players or subgroups
- Map drawing input (DM uses in-app tools to create maps)
- Encounter data (monster stats, loot tables, trigger conditions)
- User profile data (character name, avatar image)
- Audio stream from microphone (WebRTC)

### Outputs

- Real-time synchronized map view with fog of war
- Chat messages with formatted dice roll results
- Encounter notifications and outcomes
- Session state (persisted for resume)
- Audio streams to other participants

### Key User Flows

#### Flow 1: DM Logs In and Manages Campaigns & Adventures

1. DM logs in or creates account
2. DM sees Forge dashboard with list of all saved Campaigns (or empty state if new user)
3. DM can create a new Campaign, or select an existing Campaign to view its Adventures
4. Within a Campaign, DM can create new Adventures or select an Adventure to edit
5. Selecting an Adventure opens the Adventure workspace
6. DM can log out at any time; all changes are auto-saved

#### Flow 2: DM Creates a Campaign

1. DM clicks "Create Campaign" from the Forge dashboard
2. DM enters Campaign name, description
3. DM uploads a landscape banner image and selects hotspot for display
4. DM optionally sets up the world map for the Campaign
5. Campaign is created and DM can now add Adventures to it

#### Flow 3: DM Builds an Adventure (Prep Mode)

1. DM creates a new Adventure or opens an existing one from a Campaign
2. DM works on Adventure content at their own pace:
   - Create and edit maps (see Flow 8)
   - Upload backdrop images for session display
   - Create NPC characters
   - Design random encounter tables
   - Place static encounters on maps
   - Add notes with titles and content
3. All changes persist automatically
4. DM can close the browser, log out, or switch to another Adventure
5. When DM returns (hours, days, weeks later), all work is preserved
6. DM continues building until ready to run a live session

#### Flow 4: DM Starts a Live Game Session

1. DM navigates to an Adventure from within a Campaign
2. DM clicks "Start Session" to go live
3. System generates a join code/link for players
4. DM shares the code/link with players (via Discord, text, email, etc.)
5. DM waits in lobby as players join
6. Once players are ready, DM begins the session
7. Adventure is now in "live" mode with real-time sync

#### Flow 5: Player Creates a Character

1. Player logs in or creates account
2. Player navigates to the Adventure section
3. Player clicks "Create Character"
4. Player fills out B/X-style character sheet (name, class, stats, equipment, etc.)
5. Character is saved and available for use in any session
6. Player can create multiple characters over time

#### Flow 6: Player Browses and Joins a Session

1. Player navigates to the Adventure section
2. Player sees list of active sessions available to join
3. Player selects a session to join
4. Player chooses which of their characters to play
5. Player joins the game lobby and appears in the player card list
6. Player connects to voice chat
7. Player views the map with fog of war active

#### Flow 7: Gameplay Loop

1. DM narrates and reveals map areas as players explore
2. Players move tokens (if applicable) or describe actions in chat
3. Players use `/roll` commands for skill checks, attacks, etc.
4. Random encounters trigger based on DM-defined rules and exploration
5. DM manages combat/roleplay through chat and private messages
6. DM can display backdrops during roleplay (town scenes, battle illustrations)
7. DM pauses session when done; state persists for next session
8. DM can resume the same session later, or start a new session in the same Adventure

#### Flow 8: DM Creates a New Map

1. DM opens map editor from Adventure workspace
2. DM selects grid type: hex (outdoor/wilderness) or square (indoor/dungeon)
3. DM sets map dimensions
4. For hex maps: DM stamps terrain types (forest, mountains, water, etc.)
5. For square maps: DM clicks cells to place walls (black), leaving white floor space
6. DM places feature stamps (doors, secret doors, stairs, pillars, etc.)
7. DM adds text labels for room names or notes
8. Map auto-saves; DM can return to edit it anytime

#### Flow 9: DM Switches Maps During Session

1. Party reaches a point where they should move to a different map (door, stairs, cave entrance, etc.)
2. DM selects a different Adventure map from the map list
3. All players' views switch to the selected map
4. Fog of war loads from saved state (previously explored areas remain visible)
5. Gameplay continues on the new map

*Note: Phase 2 will add formal map linking with transition markers and destination points for single-player experiences.*

#### Flow 10: DM Displays Backdrop During Session

1. DM decides to show players a backdrop (entering a town, encountering a monster, etc.)
2. DM selects a backdrop from the Adventure's backdrop library
3. All players' views switch from map to the backdrop image
4. DM narrates the scene
5. DM switches back to map view when ready to continue exploration

#### Flow 11: DM Edits Map Mid-Session

1. DM enters map edit mode (players see "DM is updating map...")
2. DM paints terrain, places tokens, adjusts fog boundaries
3. DM exits edit mode; changes sync to all players

#### Flow 12: DM Switches Between Campaigns and Adventures

1. DM returns to Forge dashboard from current Adventure workspace
2. DM sees list of all Campaigns with last-edited timestamps
3. DM selects a different Campaign to open
4. DM sees list of Adventures within that Campaign
5. Previous Adventure state is preserved; new Campaign/Adventure loads
6. DM can work on multiple Campaigns and Adventures over time without losing progress

---

## Non-Functional Requirements

### Performance

- Real-time sync latency < 100ms for chat and map updates
- Support 1 DM + up to 8 players per session
- Map rendering smooth at 60fps for panning/zooming
- Voice chat latency comparable to Discord (~50-150ms)
- Initial page load < 3 seconds

### Security

- Passwords hashed with Argon2id (OWASP recommended)
- Magic link tokens expire after 15 minutes, single-use
- Session tokens (JWT or secure cookies) with refresh rotation
- Game sessions private by default (invite-only via unique codes)
- Rate limiting on auth endpoints to prevent brute force
- Input sanitization on all chat messages (prevent XSS)
- File upload validation (image types only, size limits)

### Constraints

- Responsive design supporting desktop, tablet, and mobile (Tailwind breakpoints: sm/md/lg/xl)
- No support for video chat in MVP (audio only)
- Maps are 2D only (no 3D rendering)
- Single campaign per game session (no multi-campaign management in MVP)
- Moldvay B/X focus means no built-in support for 5e mechanics initially

---

## Production Infrastructure

### Deployment Requirements

The application should be deployable to a single VPS or cloud server without requiring managed services. Self-hosted infrastructure is preferred over SaaS dependencies where practical.

### Email Infrastructure

| Requirement | Description |
|-------------|-------------|
| SMTP Server | Self-hosted or relay-capable mail server |
| Email Types | Transactional only (verification, password reset, session invites) |
| Deliverability | SPF, DKIM, DMARC records for custom domain |
| Dev Environment | Local mail catcher (Mailpit) for testing |

### Storage

| Requirement | Description |
|-------------|-------------|
| Database | PostgreSQL (can be containerized or managed) |
| File Storage | S3-compatible object storage for avatars, map assets |
| Backups | Automated database backups with retention policy |

### Networking & Security

| Requirement | Description |
|-------------|-------------|
| SSL/TLS | Required for all production traffic |
| Domain | Custom domain with proper DNS configuration |
| Reverse Proxy | nginx or similar for SSL termination, static assets |
| Firewall | Restrict access to necessary ports only |

### Container Architecture

| Service | Purpose |
|---------|---------|
| app (server) | Fastify API + WebSocket server |
| client | Static build served by nginx (or bundled with app) |
| db | PostgreSQL database |
| mailpit (dev) | Development mail catcher |
| smtp (prod) | Production mail server (Postal, Postfix, or external relay) |
| redis (future) | Session storage, caching, pub/sub for scaling |

### Environment Configuration

Production deployments require environment-based configuration for:
- Database credentials
- JWT secrets
- SMTP credentials
- S3/storage credentials
- Application URLs
- Feature flags

### Monitoring & Logging (Future)

- Health check endpoints for uptime monitoring
- Structured logging for debugging
- Error tracking (self-hosted Sentry or similar)
- Basic metrics (response times, active sessions)

### Scaling Considerations (Future)

Initial deployment targets a single server supporting ~10 concurrent sessions. Future scaling may require:
- Redis for WebSocket pub/sub across instances
- Database read replicas
- CDN for static assets
- Horizontal scaling of API servers

---

## Visual Design

### Design Philosophy

The entire application should evoke the experience of playing D&D with pen, paper, and pencil circa 1981 when the Moldvay B/X rules were published. This is not a modern, polished VTT—it's a digital recreation of sitting around a table with photocopied character sheets, hand-drawn maps, and well-worn rulebooks.

**Core Principles:**

- Black and white with minimal grayscale—no color in the core UI
- Pen and ink aesthetic throughout
- Paper/parchment textures where appropriate
- Hand-drawn, imperfect charm over pixel-perfect polish
- Typography that feels typewritten or hand-lettered
- Functional, utilitarian design—nothing flashy or modern

### Overall App Aesthetic

**Color Palette:**

- Primary: Black (#000) and off-white/cream (#F5F5DC or similar parchment tone)
- Accents: Grayscale for most UI elements (shadows, disabled states, etc.)
- **Strategic color usage:** Color is used sparingly to make important things pop:
  - Player/DM avatars displayed in full color (stands out against B&W UI)
  - Critical alerts or warnings (low HP, danger indicators)
  - Active turn or selection highlights
  - Unread message indicators
  - Hostile vs. friendly encounter markers
- The rarity of color makes it meaningful—when something is colored, it demands attention

**Textures & Backgrounds:**

- Subtle paper/parchment texture for backgrounds
- Slight noise or grain to avoid sterile digital flatness
- Worn, slightly aged appearance (not pristine white)

**Borders & Frames:**

- Hand-drawn style borders (slightly irregular lines)
- Box frames reminiscent of 1980s RPG book layouts
- Decorative corner flourishes sparingly used (like TSR products)

**Iconography:**

- Simple line-art icons throughout
- Style consistent with B/X rulebook illustrations
- No filled/solid icons—outlines only

### Responsive Design

The application should be fully usable across all device sizes using Tailwind CSS breakpoints:

| Breakpoint | Min Width | Target Devices |
|------------|-----------|----------------|
| (default)  | 0px       | Mobile phones  |
| sm         | 640px     | Large phones   |
| md         | 768px     | Tablets        |
| lg         | 1024px    | Laptops        |
| xl         | 1280px    | Desktops       |

**Layout Adaptations:**
- **Mobile:** Single-column layouts, collapsible panels, touch-friendly tap targets (min 44px)
- **Tablet:** Two-column layouts where appropriate, side panels
- **Desktop:** Full multi-panel layouts, hover states, keyboard shortcuts

**Game Session Adaptations:**
- **Mobile:** Map takes full screen, player cards and chat in slide-out panels
- **Tablet:** Map with collapsible sidebar for players/chat
- **Desktop:** Map with persistent sidebars for players and chat

### Typography

**Fonts:**

- **Headers:** Serif font evoking old TSR products (similar to Souvenir or similar 70s/80s display fonts)
- **Body text:** Clean serif for readability (like the body text in B/X books)
- **Character sheets/forms:** Typewriter-style monospace font (Courier or similar)
- **Handwritten elements:** Script or hand-lettered font for notes, labels, annotations
- **Dice results:** Bold, clear display (consider a classic "fantasy" numeral style)

**Text Treatment:**

- No anti-aliased smoothness—embrace slight roughness
- All caps for headers (matching TSR style)
- Generous line spacing for readability

### Character Sheets

Character sheets should look like the original B/X character sheet from the Moldvay Basic rulebook:

**Layout:**

- Rectangular boxes for each stat/field
- Hand-ruled lines for write-in areas
- Organized in the classic arrangement (abilities, saves, equipment, etc.)
- Black border frames around sections

**Fields:**

- Character name, class, level, alignment
- Ability scores (STR, INT, WIS, DEX, CON, CHA) with modifiers
- Hit points, armor class, THAC0/attack bonus
- Saving throws (Death Ray, Wands, Paralysis, Breath, Spells)
- Equipment list with encumbrance
- Spells (for magic-users and clerics)
- Experience points and gold

**Styling:**

- Typewriter font for labels
- Handwritten-style font for player-entered values
- Checkbox squares for tracking (spells used, items consumed)
- Worn paper texture background

### UI Components

**Base Library:** [Neobrutalism Components](https://www.neobrutalism.dev/)

- Built on React + Tailwind CSS + shadcn/ui
- Provides thick borders, bold shadows, stark geometric forms
- Will be customized with B/X color palette (black, white, cream) and typography

**Customization Approach:**

- Replace default neobrutalism colors with B/X palette (black borders, cream/parchment backgrounds)
- Swap fonts to period-appropriate typefaces (serif headers, typewriter body)
- Adjust shadow colors from colored to black/gray
- Add paper texture overlays where appropriate
- Maintain the bold, chunky border aesthetic (fits pen-and-ink style)

**Buttons:**

- Neobrutalism base with black borders on cream background
- Bold black shadow offset
- Hover state: inverted (black fill, white text)
- Disabled state: gray text, dashed border

**Input Fields:**

- Thick black border boxes (neobrutalism style)
- Typewriter font for entered text
- No rounded corners anywhere
- Cream/parchment background

**Chat Window:**

- Resembles a scroll or logbook
- Messages appear as if typed or handwritten
- Dice roll results displayed with simple notation: `[3d6: 4+2+6 = 12]`
- Timestamps in small, unobtrusive text

**Player Cards:**

- Neobrutalism card component styled as index cards
- Display: avatar (full color—pops against B&W UI), character name, class, HP
- Slightly overlapping arrangement (like cards on a table)
- Active speaker indicator (subtle color pulse or glow)
- Bold black border with offset shadow

**Modals & Dialogs:**

- Neobrutalism dialog with parchment background
- Thick black border frame
- Bold shadow offset
- Hand-drawn style elements where appropriate

**Menus & Navigation:**

- Minimal chrome—text-based navigation
- Underline hover states
- Dropdown menus use neobrutalism card styling

**Navigation Bar (NavBar):**

- Sticky positioning at top of viewport (`top-0`, `z-40`)
- Height: 56px (`h-14`)
- Background: parchment with bottom border (`border-b-3 border-ink bg-parchment-100`)
- Full-width layout with three sections:
  - **Left:** Dragon logo (32x32px, bordered) + "GYGAX" text in display font, links to dashboard
  - **Center:** Forge and Adventure links, absolutely centered in viewport, hidden on mobile
  - **Right:** Square avatar (40x40px) with dropdown, hamburger menu button on mobile
- Active nav link styling: `text-ink underline underline-offset-4`
- Inactive nav link styling: `text-ink-soft` with hover to `text-ink`
- Forge link active when on: `/`, `/campaigns/*`, `/adventures/*`, `/maps/*`
- Adventure link active when on: `/adventure`, `/characters/*`, `/sessions/*`

**Avatar Component:**

- Square shape (brutalist, not rounded)
- Size: 40x40px (`w-10 h-10`)
- Border: `border-3 border-ink`
- Shadow: `shadow-brutal-sm`
- Displays user initials (2 characters max) in display font
- Dropdown menu contains: user name, user email (muted), separator, "Depart" logout action

**Mobile Menu:**

- Hamburger button visible only below 768px (`md:hidden`)
- Drawer slides in from right side
- Contains only Forge and Adventure navigation links
- User info and logout accessed via Avatar dropdown (always visible)

### Page Layouts

**Campaign Detail Page:**

- Landscape banner image at top (with hotspot positioning for focal point)
- Campaign title overlaid on banner with text shadow
- Description below banner
- Grid of Adventure cards below description (2:3 ratio cover images, like B/X module covers)
- "Create Adventure" button
- World map access button (for the Campaign's shared world map)

**Adventure Detail Page:**

- Portrait cover image as hero (if present) or decorative parchment header
- Adventure name overlaid on cover or displayed below
- Description text
- Section tabs or links for: Maps, Backdrops, NPCs, Notes, Encounters
- "Start Session" button to begin live play
- "Edit" button to modify Adventure details

### Map Aesthetic

Maps should evoke the classic black-and-white style of the original Moldvay Basic and Expert rulebooks (1981):

- **Color palette:** Strictly black, white, and grayscale
- **Line work:** Clean, hand-drawn appearance with solid black for walls (filled cells) and boundaries
- **Terrain icons:** Simple symbolic stamps for wilderness terrain (forest, mountains, water, settlements)
- **Typography:** Simple, utilitarian labels reminiscent of 1980s TSR cartography
- **Grid style:** Thin lines for hex/square grids; grids should feel functional, not decorative
- **Icons:** Simple symbolic icons for doors, stairs, traps, and features (not detailed illustrations)
- **Fog of war:** Represented as blank/empty paper or light crosshatch pattern (not dark overlay)

### Map Editor Tools

DMs draw maps directly in the application using:

- **Terrain stamps** (hex maps) for wilderness features (forest, mountains, water, settlements, etc.)
- **Wall tool** (square maps) to click cells and fill them black, creating dungeon walls
- **Feature stamps** (square maps) for dungeon elements (doors, stairs, pillars, statues, traps)
- **Path tools** (hex maps) for roads, rivers, borders, and trails
- **Text tool** for room labels and annotations
- **Eraser** for corrections
- **Grid toggle** between hex (outdoor) and square (indoor) modes

### Map Transitions

**Phase 1 (VTT Sessions):**

During live sessions, the DM controls which map is displayed to players. When the party reaches a transition point (door, stairs, cave entrance, etc.), the DM manually switches to the appropriate map. This keeps the DM in full control of pacing and narrative.

- DM selects any Adventure map to display during a session
- All connected players see the same map
- Fog of war state is preserved per-map (returning to a map shows previously explored areas)

**Phase 2 (Single-Player with NPCs):**

Future phase will add formal map linking for single-player experiences:

- Transition markers placed on maps (doors, stairs, cave entrances, town gates, portals)
- Each marker links to a destination map and arrival point
- Players can navigate between maps independently
- NPCs can guide players through linked areas

### Reference Style

The visual target is maps like:

- The sample dungeon in Moldvay Basic (B/X) page B59
- The Isle of Dread maps from Expert Set (X1)
- Dyson Logos-style clean dungeon cartography

---

## Project Structure

### Preferred Architecture

Modular monolith with clear separation between:

- **Client:** React SPA handling UI, map rendering, and real-time state
- **Server:** Node.js API + WebSocket server handling auth, game state, persistence
- **Shared:** Common types and utilities used by both client and server

### Key Directories

```
/client              # React frontend
  /src
    /components      # UI components (Chat, Map, PlayerCards, etc.)
    /canvas          # Map rendering logic (hex grid, square grid, fog)
    /editor          # Map editor tools (terrain, walls, features, paths)
    /assets          # Terrain icons, feature stamps (B/X style graphics)
    /hooks           # Custom React hooks (useWebSocket, useAudio, etc.)
    /stores          # State management (game state, user state)
    /utils           # Dice parser, formatters, helpers
/server              # Node.js backend
  /src
    /routes          # REST API endpoints
    /websocket       # Real-time event handlers
    /services        # Business logic (auth, game, encounters)
    /models          # Database models/schemas
    /utils           # Server utilities
/shared              # Shared TypeScript types and constants
/tests               # Unit and integration tests
/docs                # Documentation
```

---

## Success Criteria

### Definition of Done

#### Authentication & Navigation
- [ ] A DM can create an account and log in
- [ ] Application has two main modes: Forge (DM) and Adventure (Player)

#### Forge Mode - Campaigns
- [ ] DM sees a dashboard listing all their saved Campaigns
- [ ] DM can create a new Campaign with name, description, and landscape banner image
- [ ] Campaign detail page shows banner, title, description, and list of Adventures
- [ ] DM can manage multiple Campaigns independently

#### Forge Mode - Adventures
- [ ] DM can create and manage Adventures within a Campaign
- [ ] DM can open, edit, and save Adventures (maps, encounters, backdrops, NPCs, notes)
- [ ] Adventure data persists across sessions (log out, log back in, data is intact)
- [ ] DM can start a live game session from a saved Adventure

#### Forge Mode - Content
- [ ] DM can draw a map in-app using built-in tools (B/X black-and-white style) with hex or square grid
- [ ] DM can upload and manage backdrop images for session display
- [ ] DM can create NPC characters for use in Adventures
- [ ] DM can create notes with title and content
- [ ] DM can create random encounter tables and assign to map regions
- [ ] DM can place static encounters on the map

#### Adventure Mode - Players
- [ ] Players can create characters with B/X-style character sheets
- [ ] Players can browse and join active game sessions
- [ ] Players select which character to play when joining a session

#### Live Sessions
- [ ] Players can join via invite link/code and appear in player list
- [ ] Group chat works in real-time with dice roll parsing (`/roll 3d6+1` shows result)
- [ ] DM can send private messages to individual players
- [ ] Fog of war obscures unexplored areas for players
- [ ] DM can reveal map areas to players
- [ ] Random encounters trigger during exploration
- [ ] DM can switch between Adventure maps during a session
- [ ] DM can display backdrops to players during a session
- [ ] All players see the map or backdrop the DM has selected
- [ ] Fog of war state persists per-map when switching
- [ ] Voice chat works between all participants
- [ ] DM can pause session; state persists and can be resumed
- [ ] Application handles 1 DM + 6 players without performance issues

### Testing Requirements

- **Unit tests:** Dice parser, encounter logic, fog of war calculations
- **Integration tests:** Auth flow, WebSocket message handling, database operations
- **E2E tests:** Full user flows (create game, join game, chat, map interaction)
- **Manual testing:** Voice chat quality, map rendering performance, cross-browser compatibility

---

## Open Questions

1. ~~**Map creation tool:** Should DMs draw maps in-app, upload images, or both?~~ **RESOLVED:** DMs draw maps in-app using built-in tools.
2. **Token system:** Do players control their own tokens on the map, or is it theater-of-the-mind with DM-controlled visuals?
3. **Encounter resolution:** Is combat automated at all, or purely manual with dice rolls?
4. **Hosting model:** Self-hosted option, or SaaS-only? Free tier with limits?
5. **Data model:** How are "areas" defined for random encounter assignment? Polygon regions? Grid zones?
6. **Offline support:** Should the app work if a player briefly disconnects?
7. **Player visibility:** Can players see each other's HP/stats, or only the DM sees everything?
8. **Invite system:** Simple join codes, or full invite/friend system?

---

## References

### Design & UI

- [Neobrutalism Components](https://www.neobrutalism.dev/) - Base UI component library (React + Tailwind + shadcn/ui)
- [Moldvay Basic D&D (B/X)](https://en.wikipedia.org/wiki/Dungeons_%26_Dragons_Basic_Set#1981_revision) - Target ruleset and visual aesthetic
- [Dyson Logos Maps](https://dysonlogos.blog/) - B&W dungeon cartography style reference

### Existing VTTs (Reference)

- [Roll20](https://roll20.net/) - Feature reference (not to copy)
- [Foundry VTT](https://foundryvtt.com/) - Self-hosted VTT (architecture reference)
- [Owlbear Rodeo](https://www.owlbear.rodeo/) - Minimalist VTT (simplicity inspiration)

### Technical

- [WebRTC API](https://developer.mozilla.org/en-US/docs/Web/API/WebRTC_API) - Voice chat implementation
- [shadcn/ui](https://ui.shadcn.com/) - Component foundation for neobrutalism library
