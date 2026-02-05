# Spec 016: Codebase Refactoring

## Goal

Eliminate widespread code duplication, centralize shared constants and utilities, and standardize patterns across the codebase. This is a pure refactoring effort — no new features, no behavior changes.

## Scope

### In Scope

- Extract duplicated auth helpers to shared server utilities
- Centralize validation constants in the shared package
- Consolidate `API_URL` client-side definition
- Deduplicate response formatter functions on the server
- Deduplicate `TOKEN_COLORS` (3 locations → 1)
- Deduplicate `cellsEqual` utility (2 locations → 1)
- Standardize `requireAdventureOwnership` error codes
- Remove empty `client/src/stores/` directory

### Out of Scope

- Splitting large files (`MapCanvas.tsx`, `SessionGameView.tsx`, `AdventurePage.tsx`) — separate spec
- Service layer extraction from route handlers — separate spec
- New features or behavior changes
- Database schema changes
- Dependency upgrades

## Dependencies

None — this is a standalone refactoring of existing code.

## Design Decisions

1. **Shared validation constants go in `@gygax/shared`** — Both client and server need the same limits. A single source of truth prevents drift.
2. **Server auth helpers go in `server/src/utils/auth.ts`** — These use Fastify types and Prisma, so they don't belong in the shared package.
3. **Server formatters go in `server/src/utils/formatters.ts`** — Response formatting is server-only logic.
4. **Client API_URL goes in `client/src/lib/api.ts`** — Single module for API configuration, imported everywhere.
5. **Standardize on 404 for ownership checks** — Existing convention (don't reveal resource existence to non-owners). The `maps.ts` 403 is the outlier; standardize to 404.
6. **No functional changes** — Every refactoring must produce identical runtime behavior. If tests exist, they must continue to pass unchanged.

---

## Phase 1: Shared Validation Constants

### 1.1 Create `shared/src/constants.ts`

Centralize all validation limits currently duplicated across 13+ server routes and 7+ client components.

```typescript
// --- Entity field limits ---

export const ADVENTURE_LIMITS = {
  MAX_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 1000,
} as const

export const CAMPAIGN_LIMITS = {
  MAX_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 1000,
} as const

export const MAP_LIMITS = {
  MAX_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 1000,
  MIN_DIMENSION: 5,
  MAX_DIMENSION: 100,
  DEFAULT_DIMENSION: 30,
  DEFAULT_CELL_SIZE: 40,
} as const

export const CHARACTER_LIMITS = {
  MAX_NAME_LENGTH: 100,
  MAX_NOTES_LENGTH: 5000,
  MAX_EQUIPMENT_LENGTH: 2000,
  MAX_SPELLS_LENGTH: 2000,
} as const

export const NPC_LIMITS = {
  MAX_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 2000,
  MAX_NOTES_LENGTH: 5000,
  MAX_EQUIPMENT_LENGTH: 2000,
  MAX_SPELLS_LENGTH: 2000,
} as const

export const BACKDROP_LIMITS = {
  MAX_NAME_LENGTH: 100,
  MAX_DESCRIPTION_LENGTH: 2000,
} as const

export const NOTE_LIMITS = {
  MAX_NAME_LENGTH: 200,
  MAX_CONTENT_LENGTH: 10000,
} as const

// --- Upload limits ---

export const UPLOAD = {
  MAX_FILE_SIZE: 5 * 1024 * 1024, // 5MB
  ALLOWED_MIME_TYPES: ['image/jpeg', 'image/png', 'image/webp'] as readonly string[],
} as const

// --- B/X domain constants ---

export const VALID_CLASSES = [
  'Fighter', 'Magic-User', 'Cleric', 'Thief',
  'Elf', 'Dwarf', 'Halfling',
] as const

export const VALID_ALIGNMENTS = ['Lawful', 'Neutral', 'Chaotic'] as const
```

### 1.2 Export from `shared/src/index.ts`

Add re-export: `export * from './constants'`

### 1.3 Remove local constant definitions

**Server routes — remove local constants, import from `@gygax/shared`:**

| File | Constants to remove |
|------|-------------------|
| `server/src/routes/adventures.ts` | `MAX_NAME_LENGTH`, `MAX_DESCRIPTION_LENGTH`, `ALLOWED_MIME_TYPES` |
| `server/src/routes/campaigns.ts` | `MAX_NAME_LENGTH`, `MAX_DESCRIPTION_LENGTH`, `ALLOWED_MIME_TYPES` |
| `server/src/routes/characters.ts` | `MAX_NAME_LENGTH`, `MAX_NOTES_LENGTH`, `MAX_EQUIPMENT_LENGTH`, `MAX_SPELLS_LENGTH`, `ALLOWED_MIME_TYPES`, `VALID_CLASSES`, `VALID_ALIGNMENTS` |
| `server/src/routes/npcs.ts` | `MAX_NAME_LENGTH`, `MAX_DESCRIPTION_LENGTH`, `MAX_NOTES_LENGTH`, `MAX_EQUIPMENT_LENGTH`, `MAX_SPELLS_LENGTH`, `ALLOWED_MIME_TYPES`, `VALID_CLASSES`, `VALID_ALIGNMENTS` |
| `server/src/routes/backdrops.ts` | `MAX_NAME_LENGTH`, `MAX_DESCRIPTION_LENGTH`, `ALLOWED_MIME_TYPES` |
| `server/src/routes/maps.ts` | `MAX_NAME_LENGTH`, `MAX_DESCRIPTION_LENGTH`, and any dimension constants |
| `server/src/routes/notes.ts` | `MAX_NAME_LENGTH`, `MAX_CONTENT_LENGTH` |

**Client components — remove local constants, import from `@gygax/shared`:**

| File | Constants to remove |
|------|-------------------|
| `client/src/components/CreateAdventureModal.tsx` | `MAX_NAME_LENGTH`, `MAX_DESCRIPTION_LENGTH` |
| `client/src/components/CreateCampaignModal.tsx` | `MAX_NAME_LENGTH`, `MAX_DESCRIPTION_LENGTH` |
| `client/src/components/CreateMapModal.tsx` | `MAX_NAME_LENGTH`, `MAX_DESCRIPTION_LENGTH`, dimension constants |
| `client/src/components/CreateCharacterModal.tsx` | `MAX_NAME_LENGTH` |
| `client/src/components/CreateNPCModal.tsx` | `MAX_NAME_LENGTH`, `MAX_DESCRIPTION_LENGTH` |
| `client/src/components/CreateBackdropModal.tsx` | `MAX_NAME_LENGTH`, `MAX_DESCRIPTION_LENGTH` |
| `client/src/components/EditBackdropModal.tsx` | `MAX_NAME_LENGTH`, `MAX_DESCRIPTION_LENGTH` |
| `client/src/components/CreateNoteModal.tsx` | `MAX_NAME_LENGTH`, `MAX_CONTENT_LENGTH` |
| `client/src/components/ImageUpload.tsx` | `MAX_FILE_SIZE` |
| `client/src/components/BannerUpload.tsx` | `MAX_FILE_SIZE` |

---

## Phase 2: Consolidate `TOKEN_COLORS`

### Current state (3 identical definitions)

| File | Variable name |
|------|--------------|
| `shared/src/types.ts:1095` | `TOKEN_COLORS` |
| `server/src/services/tokenService.ts:5` | `DEFAULT_COLORS` |
| `client/src/components/MapCanvas.tsx:760` | `TOKEN_COLORS` |

### Action

- Keep the definition in `shared/src/types.ts` (already exported)
- `server/src/services/tokenService.ts` — remove `DEFAULT_COLORS`, import `TOKEN_COLORS` from `@gygax/shared`
- `client/src/components/MapCanvas.tsx` — remove local `TOKEN_COLORS`, import from `@gygax/shared`

---

## Phase 3: Client API Configuration

### Current state (21 files)

`const API_URL = import.meta.env.VITE_API_URL || ''` is defined in 21 separate files. Two files (`useChat.ts`, `useSessionSocket.ts`) use a different fallback (`'http://localhost:3000'`).

### Action

Create `client/src/lib/api.ts`:

```typescript
export const API_URL = import.meta.env.VITE_API_URL || ''
```

Update all 21 files to import from `@/lib/api` instead of defining locally.

For `useChat.ts` and `useSessionSocket.ts`, the WebSocket URL derivation should also move into this module:

```typescript
export const WS_URL = API_URL
  ? API_URL.replace(/^http/, 'ws')
  : 'ws://localhost:3000'
```

**Files to update:**

| Directory | Files |
|-----------|-------|
| `client/src/pages/` | `AdventurePage.tsx`, `AdventureModePage.tsx`, `CampaignPage.tsx`, `CharacterPage.tsx`, `DashboardPage.tsx`, `ForgotPasswordPage.tsx`, `MapEditorPage.tsx`, `NPCPage.tsx`, `ResetPasswordPage.tsx`, `SessionBrowsePage.tsx`, `SessionGameView.tsx`, `SessionPage.tsx`, `UnverifiedPage.tsx`, `VerifyEmailPage.tsx` |
| `client/src/components/` | `HealthCheck.tsx`, `JoinSessionModal.tsx`, `StartSessionModal.tsx` |
| `client/src/hooks/` | `useChat.ts`, `useSessionSocket.ts`, `useSessionBrowseSSE.ts` |
| `client/src/contexts/` | `AuthContext.tsx` |

---

## Phase 4: Server Auth Utilities

### 4.1 Create `server/src/utils/auth.ts`

Extract `requireVerifiedUser` — currently duplicated identically in 10+ route files.

```typescript
import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'

/**
 * Verifies the request has a valid JWT and the user's email is verified.
 * Returns the user object or null (after sending an error reply).
 */
export async function requireVerifiedUser(
  fastify: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<{ id: string; email: string; emailVerified: boolean } | null> {
  // ... existing implementation (identical across all files)
}
```

### 4.2 Extract `requireAdventureOwnership`

Currently in 4 files with variations in error codes (some 403, some 404). Standardize on 404:

```typescript
/**
 * Verifies the user owns the specified adventure.
 * Returns the adventure or null (after sending 404).
 */
export async function requireAdventureOwnership(
  fastify: FastifyInstance,
  reply: FastifyReply,
  adventureId: string,
  userId: string
): Promise<Adventure | null> {
  // ... standardized implementation using 404
}
```

### 4.3 Update all route files

Remove local definitions, import from `../utils/auth`:

| File | Functions to remove |
|------|-------------------|
| `server/src/routes/adventures.ts` | `requireVerifiedUser` |
| `server/src/routes/backdrops.ts` | `requireVerifiedUser`, `requireAdventureOwnership` |
| `server/src/routes/campaignMembers.ts` | `requireVerifiedUser` |
| `server/src/routes/campaigns.ts` | `requireVerifiedUser` |
| `server/src/routes/channels.ts` | `requireVerifiedUser` |
| `server/src/routes/characters.ts` | `requireVerifiedUser` |
| `server/src/routes/maps.ts` | `requireVerifiedUser`, `requireAdventureOwnership` |
| `server/src/routes/notes.ts` | `requireVerifiedUser`, `requireAdventureOwnership` |
| `server/src/routes/npcs.ts` | `requireVerifiedUser`, `requireAdventureOwnership` |
| `server/src/routes/sessionInvites.ts` | `requireVerifiedUser` |
| `server/src/routes/sessionMaps.ts` | `requireVerifiedUser` |
| `server/src/routes/sessions.ts` | `requireVerifiedUser` (if present) |

---

## Phase 5: Server Response Formatters

### Current state (duplicated across routes + websocket handlers)

| Function | Locations |
|----------|-----------|
| `formatSessionParticipant` | `routes/sessions.ts:59`, `websocket/handlers.ts:42` |
| `formatSessionInvite` | `routes/sessions.ts:103`, `routes/sessionInvites.ts:9`, `websocket/handlers.ts:86` |
| `formatSessionWithDetails` | `routes/sessions.ts:131`, `websocket/handlers.ts:114` |
| `formatSessionListItem` | `routes/sessions.ts:206`, `routes/sessionBrowseSSE.ts:7` |

### Action

Create `server/src/utils/formatters.ts` with all session-related format functions. Import in all consuming files.

```typescript
export function formatSessionParticipant(participant: ...) { ... }
export function formatSessionInvite(invite: ...) { ... }
export function formatSessionWithDetails(session: ...) { ... }
export function formatSessionListItem(session: ...) { ... }
```

**Files to update:**

| File | Remove local functions |
|------|----------------------|
| `server/src/routes/sessions.ts` | `formatSessionParticipant`, `formatSessionInvite`, `formatSessionWithDetails`, `formatSessionListItem` |
| `server/src/routes/sessionInvites.ts` | `formatSessionInvite` |
| `server/src/routes/sessionBrowseSSE.ts` | `formatSessionListItem` |
| `server/src/websocket/handlers.ts` | `formatSessionParticipant`, `formatSessionInvite`, `formatSessionWithDetails` |

---

## Phase 6: Client Utility Deduplication

### 6.1 Extract `cellsEqual` to `client/src/utils/cellUtils.ts`

Currently duplicated identically in:
- `client/src/hooks/useFog.ts:23`
- `client/src/hooks/useTokens.ts:43`

```typescript
import type { CellCoord } from '@gygax/shared'

export function cellsEqual(a: CellCoord, b: CellCoord): boolean {
  if (a.col !== undefined && a.row !== undefined && b.col !== undefined && b.row !== undefined) {
    return a.col === b.col && a.row === b.row
  }
  if (a.q !== undefined && a.r !== undefined && b.q !== undefined && b.r !== undefined) {
    return a.q === b.q && a.r === b.r
  }
  return false
}
```

Update `useFog.ts` and `useTokens.ts` to import from `../utils/cellUtils`.

### 6.2 Remove empty `client/src/stores/` directory

The directory exists but contains no files. Remove it.

---

## Files to Create

| File | Description |
|------|-------------|
| `shared/src/constants.ts` | Centralized validation constants |
| `client/src/lib/api.ts` | API_URL and WS_URL configuration |
| `client/src/utils/cellUtils.ts` | `cellsEqual` utility |
| `server/src/utils/auth.ts` | `requireVerifiedUser`, `requireAdventureOwnership` |
| `server/src/utils/formatters.ts` | Session response formatters |

## Files to Modify

| File | Changes |
|------|---------|
| `shared/src/index.ts` | Re-export constants |
| `server/src/services/tokenService.ts` | Import `TOKEN_COLORS` from shared |
| `client/src/components/MapCanvas.tsx` | Import `TOKEN_COLORS` from shared |
| 10+ server route files | Import auth helpers and constants |
| 10+ client component files | Import constants from shared |
| 21 client files | Import `API_URL` from lib/api |
| 4 server files | Import formatters |
| 2 client hook files | Import `cellsEqual` from utils |

## Files to Delete

| File | Reason |
|------|--------|
| `client/src/stores/` (directory) | Empty, unused |

## Implementation Order

| Phase | Description | Files touched | Risk |
|-------|-------------|---------------|------|
| 1 | Shared validation constants | ~20 | Low — purely mechanical replacement |
| 2 | TOKEN_COLORS consolidation | 3 | Low — import change only |
| 3 | Client API_URL | ~22 | Low — import change only |
| 4 | Server auth utilities | ~13 | Medium — standardizing error codes |
| 5 | Server formatters | ~5 | Low — moving functions, no logic change |
| 6 | Client utility dedup + cleanup | ~4 | Low — simple extraction |

Each phase is independently deployable. Run `npm run typecheck` and `npm run lint` after each phase.

## Acceptance Criteria

- [ ] No validation constant (`MAX_NAME_LENGTH`, `MAX_DESCRIPTION_LENGTH`, `ALLOWED_MIME_TYPES`, `VALID_CLASSES`, `VALID_ALIGNMENTS`, etc.) is defined in more than one location
- [ ] `TOKEN_COLORS` is defined only in `shared/src/types.ts`
- [ ] `API_URL` is defined only in `client/src/lib/api.ts`
- [ ] `requireVerifiedUser` is defined only in `server/src/utils/auth.ts`
- [ ] `requireAdventureOwnership` is defined only in `server/src/utils/auth.ts` with consistent 404 behavior
- [ ] Session format functions are defined only in `server/src/utils/formatters.ts`
- [ ] `cellsEqual` is defined only in `client/src/utils/cellUtils.ts`
- [ ] `client/src/stores/` directory is removed
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] All existing functionality works identically (no behavior changes)
