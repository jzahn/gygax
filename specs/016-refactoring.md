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
- Extract generic `DeleteConfirmDialog` (7 identical dialogs → 1)
- Deduplicate `formatRelativeTime` (4 locations → 1)
- Consolidate `CLASS_ICONS` and `CHARACTER_CLASSES` constants
- Extract `AuthBranding` component (copy-pasted across 4 auth pages)
- Extract reusable `PageLoadingSpinner` and `PageErrorState` components
- Create `Select` UI component to replace raw `<select>` elements
- Replace raw `<textarea>` with existing `Textarea` UI component
- Fix `MapCard` to use shared `DropdownMenu` instead of custom dropdown
- Clean up shared type duplication (`WSConnectedUser`/`WSUserConnected`, dead types, `DiceExpression` duplication)
- Extract adventure cover / campaign banner save logic to reusable utilities
- Deduplicate `requireCampaignOwnership` across server routes

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
7. **Generic components use composition** — `DeleteConfirmDialog` takes entity-specific text as props rather than using generics. `PageLoadingSpinner` / `PageErrorState` are thin wrappers around the repeated markup.
8. **B/X domain constants colocate with shared types** — `CLASS_ICONS` and `CHARACTER_CLASSES` go in `shared/src/constants.ts` alongside other domain constants since both client and server reference the class list.

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

// --- B/X display constants ---

export const CLASS_ICONS: Record<string, string> = {
  Fighter: '⚔',
  'Magic-User': '🔮',
  Cleric: '✝',
  Thief: '🗡',
  Elf: '🏹',
  Dwarf: '⛏',
  Halfling: '🍀',
}
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
| `client/src/components/CreateCharacterModal.tsx` | `MAX_NAME_LENGTH`, `CHARACTER_CLASSES` |
| `client/src/components/CreateNPCModal.tsx` | `MAX_NAME_LENGTH`, `MAX_DESCRIPTION_LENGTH`, `NPC_CLASSES` |
| `client/src/components/CreateBackdropModal.tsx` | `MAX_NAME_LENGTH`, `MAX_DESCRIPTION_LENGTH` |
| `client/src/components/EditBackdropModal.tsx` | `MAX_NAME_LENGTH`, `MAX_DESCRIPTION_LENGTH` |
| `client/src/components/CreateNoteModal.tsx` | `MAX_NAME_LENGTH`, `MAX_CONTENT_LENGTH` |
| `client/src/components/ImageUpload.tsx` | `MAX_FILE_SIZE` |
| `client/src/components/BannerUpload.tsx` | `MAX_FILE_SIZE` |
| `client/src/components/CharacterSheet.tsx` | `CHARACTER_CLASSES` |
| `client/src/components/CharacterCard.tsx` | `CLASS_ICONS` |
| `client/src/components/NPCCard.tsx` | `CLASS_ICONS` |

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

### 4.3 Extract `requireCampaignOwnership`

Same pattern as adventure ownership — duplicated across `campaigns.ts` and `campaignMembers.ts`. Centralize into `server/src/utils/auth.ts` with the same 404 convention.

### 4.4 Update all route files

Remove local definitions, import from `../utils/auth`:

| File | Functions to remove |
|------|-------------------|
| `server/src/routes/adventures.ts` | `requireVerifiedUser` |
| `server/src/routes/backdrops.ts` | `requireVerifiedUser`, `requireAdventureOwnership` |
| `server/src/routes/campaignMembers.ts` | `requireVerifiedUser`, `requireCampaignOwnership` |
| `server/src/routes/campaigns.ts` | `requireVerifiedUser`, `requireCampaignOwnership` |
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

### 6.2 Extract `formatRelativeTime` to `client/src/utils/dateUtils.ts`

Currently duplicated identically in 3 files, with a 4th variant:

| File | Function | Notes |
|------|----------|-------|
| `client/src/components/AdventureCard.tsx:18` | `formatRelativeTime` | Day granularity |
| `client/src/components/CampaignCard.tsx:18` | `formatRelativeTime` | Day granularity (identical) |
| `client/src/components/CharacterCard.tsx:17` | `formatRelativeTime` | Day granularity (identical) |
| `client/src/components/NoteCard.tsx:17` | `relativeTime` | Seconds/minutes/hours granularity |

Create `client/src/utils/dateUtils.ts` with a single unified `formatRelativeTime` that handles both fine-grained (seconds/minutes/hours) and coarse-grained (days/weeks/months) time deltas. Remove all local definitions.

### 6.3 Remove empty `client/src/stores/` directory

The directory exists but contains no files. Remove it.

---

## Phase 7: Generic Delete Confirmation Dialog

### Current state (7 identical dialogs)

Seven files contain the exact same component structure, differing only in entity name and description text:

| File | Entity |
|------|--------|
| `client/src/components/DeleteAdventureDialog.tsx` | Adventure |
| `client/src/components/DeleteCampaignDialog.tsx` | Campaign |
| `client/src/components/DeleteCharacterDialog.tsx` | Character |
| `client/src/components/DeleteNPCDialog.tsx` | NPC |
| `client/src/components/DeleteBackdropDialog.tsx` | Backdrop |
| `client/src/components/DeleteNoteDialog.tsx` | Note |
| `client/src/components/DeleteMapDialog.tsx` | Map |

All share the identical `handleConfirm` pattern, dialog structure, button layout, and classNames.

### Action

Create `client/src/components/DeleteConfirmDialog.tsx`:

```typescript
interface DeleteConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  entityName: string       // e.g., "Goblin Cave"
  entityType: string       // e.g., "adventure"
  description?: string     // Optional extra warning text
}
```

Replace all 7 dialog files with imports of the generic component. Each call site passes the entity-specific text as props. Delete the 7 individual files.

---

## Phase 8: Auth Page Branding Component

### Current state (copy-pasted 7+ times across 4 pages)

The same ~12-line branding block (logo image, animated "Gygax" heading, animated rule line) is copy-pasted verbatim across all auth pages. `ForgotPasswordPage.tsx` contains it twice, `ResetPasswordPage.tsx` contains it three times (one per view state).

| File | Occurrences |
|------|-------------|
| `client/src/pages/LoginPage.tsx` | 1 |
| `client/src/pages/RegisterPage.tsx` | 1 |
| `client/src/pages/ForgotPasswordPage.tsx` | 2 |
| `client/src/pages/ResetPasswordPage.tsx` | 3 |

### Action

Create `client/src/components/AuthBranding.tsx`:

```tsx
export function AuthBranding() {
  return (
    <div className="mb-3 md:mb-6 flex flex-col items-center text-center">
      <div className="animate-logo-emerge mb-2 md:mb-4">
        <img src="/logo/logo.jpg" ... />
      </div>
      <h1 className="animate-brand-reveal font-display text-2xl md:text-4xl uppercase text-ink"
        style={{ letterSpacing: '0.35em' }}>Gygax</h1>
      <div className="animate-rule-expand mt-1 md:mt-2 h-px w-32 md:w-48 bg-gradient-to-r from-transparent via-ink to-transparent" />
    </div>
  )
}
```

Replace all 7 inline blocks with `<AuthBranding />`.

---

## Phase 9: Page-Level Loading & Error Components

### Current state (8+ pages)

The same loading spinner and error state markup are repeated across every detail page with only the entity name varying.

**Loading pattern** (8+ pages):
```tsx
<div className="flex min-h-screen items-center justify-center paper-texture">
  <span className="animate-quill-scratch text-4xl">&#9998;</span>
  <span className="ml-4 font-body text-ink-soft">Loading adventure...</span>
</div>
```

**Error pattern** (6+ pages):
```tsx
<div className="min-h-screen paper-texture">
  <div className="mx-auto max-w-2xl p-6 md:p-8">
    <div className="rounded border-3 border-blood-red bg-parchment-100 p-6 text-center">
      <p className="font-body text-blood-red">{error}</p>
      <Button variant="ghost" onClick={() => navigate('/')}>Return to Dashboard</Button>
    </div>
  </div>
</div>
```

### Action

Create `client/src/components/PageLoadingSpinner.tsx`:
```tsx
export function PageLoadingSpinner({ message = 'Loading...' }: { message?: string }) { ... }
```

Create `client/src/components/PageErrorState.tsx`:
```tsx
export function PageErrorState({ error, onBack }: { error: string; onBack?: () => void }) { ... }
```

Replace all inline instances in: `AdventurePage.tsx`, `CampaignPage.tsx`, `CharacterPage.tsx`, `NPCPage.tsx`, `SessionPage.tsx`, `MapEditorPage.tsx`, `SessionBrowsePage.tsx`, `AdventureModePage.tsx`.

---

## Phase 10: UI Component Consistency

### 10.1 Create `Select` UI component

Multiple components use raw `<select>` elements with manually duplicated (and inconsistent) Tailwind classes. No `Select` component exists in `components/ui/` despite `Input`, `Textarea`, `Label`, and `Button` all existing.

**Files using raw `<select>`:**
- `client/src/components/CreateCharacterModal.tsx`
- `client/src/components/CreateNPCModal.tsx`
- `client/src/components/CharacterSheet.tsx`

Create `client/src/components/ui/select.tsx` matching the design system's border-3/font-body/parchment styling. Replace all raw `<select>` elements.

### 10.2 Replace raw `<textarea>` with `Textarea` component

The `Textarea` UI component exists at `client/src/components/ui/textarea.tsx` but is not used consistently. Several modals use raw `<textarea>` with slightly different class strings (some use `border-2`, some `border-3`, some have `rounded`, some don't).

**Files to fix:**
- `client/src/components/CreateNPCModal.tsx`
- `client/src/components/CreateBackdropModal.tsx`
- `client/src/components/EditBackdropModal.tsx`
- `client/src/components/CreateNoteModal.tsx`
- `client/src/pages/NPCPage.tsx`

Replace all raw `<textarea>` elements with the `Textarea` UI component.

### 10.3 Fix `MapCard` dropdown

`client/src/components/MapCard.tsx` implements its own click-outside dropdown menu using `useState`, `useRef`, and `useEffect`, while all other card components use the shared `DropdownMenu` component from `./ui/dropdown-menu`.

Replace the custom dropdown in `MapCard.tsx` with the `DropdownMenu` component.

---

## Phase 11: Image Save Logic Deduplication

### Current state (duplicated across 3 pages)

The adventure cover image save handler — which branches on new File upload vs. explicit null removal vs. undefined/no-change with focal point check — is duplicated nearly identically in 3 pages:

| File | Function |
|------|----------|
| `client/src/pages/DashboardPage.tsx` | `handleEditAdventure` |
| `client/src/pages/AdventurePage.tsx` | `handleEditAdventure` |
| `client/src/pages/CampaignPage.tsx` | `handleEditAdventure` |

The same 3-branch pattern for campaign banner handling is also duplicated in:

| File | Function |
|------|----------|
| `client/src/pages/DashboardPage.tsx` | `handleEditCampaign` |
| `client/src/pages/CampaignPage.tsx` | `handleEditCampaign` |

### Action

Create `client/src/utils/entityImageSave.ts` with helpers:

```typescript
export async function saveEntityCoverImage(opts: {
  entityType: 'adventures' | 'campaigns'
  entityId: string
  imageFile: File | null | undefined
  focusX: number
  focusY: number
  existingImageUrl?: string | null
  existingFocusX?: number
  existingFocusY?: number
}): Promise<void> { ... }
```

Replace the duplicated multi-step fetch logic in all 5 handlers.

---

## Phase 12: Shared Type Cleanup

### 12.1 Remove duplicate `DiceExpression` / `DiceResult` from `types.ts`

`shared/src/types.ts` re-declares `DiceExpression` and `DiceResult` (lines ~1010-1021) which are already defined and exported from `shared/src/dice.ts`. Since both files are re-exported from `index.ts`, these duplicates are unnecessary and risk drift. Remove them from `types.ts`.

### 12.2 Unify `WSConnectedUser` and `WSUserConnected`

These two interfaces in `shared/src/types.ts` have exactly the same fields:

```typescript
WSConnectedUser  { userId, userName, avatarUrl, role, characterId?, characterName? }
WSUserConnected  { userId, userName, avatarUrl, role, characterId?, characterName? }
```

One is used for state snapshots, the other for the "user connected" event. Unify:

```typescript
export interface WSConnectedUser { ... }
export type WSUserConnected = WSConnectedUser
```

### 12.3 Remove unused types

The following types are defined in `shared/src/types.ts` but never imported anywhere in the codebase:

| Type | Line | Status |
|------|------|--------|
| `WSError` | ~892 | Never imported |
| `SendChatMessage` | ~1004 | Never imported |
| `WSChatHistory` | ~1054 | Never imported |

Remove them. If needed in the future they can be re-added.

### 12.4 DRY up `NPCExportFile.npc` inline field list

`NPCExportFile.npc` manually re-declares every NPC stat field (~30 lines) instead of deriving from the `NPC` type. Replace with:

```typescript
export interface NPCExportFile {
  version: 1
  exportedAt: string
  npc: Omit<NPC, 'id' | 'adventureId' | 'avatarUrl' | 'createdAt' | 'updatedAt'>
}
```

---

## Files to Create

| File | Description |
|------|-------------|
| `shared/src/constants.ts` | Centralized validation + B/X domain constants |
| `client/src/lib/api.ts` | API_URL and WS_URL configuration |
| `client/src/utils/cellUtils.ts` | `cellsEqual` utility |
| `client/src/utils/dateUtils.ts` | `formatRelativeTime` utility |
| `client/src/utils/entityImageSave.ts` | Adventure cover / campaign banner save logic |
| `client/src/components/DeleteConfirmDialog.tsx` | Generic delete confirmation dialog |
| `client/src/components/AuthBranding.tsx` | Shared auth page branding block |
| `client/src/components/PageLoadingSpinner.tsx` | Full-page loading spinner |
| `client/src/components/PageErrorState.tsx` | Full-page error state |
| `client/src/components/ui/select.tsx` | Select form component |
| `server/src/utils/auth.ts` | `requireVerifiedUser`, `requireAdventureOwnership`, `requireCampaignOwnership` |
| `server/src/utils/formatters.ts` | Session response formatters |

## Files to Modify

| File | Changes |
|------|---------|
| `shared/src/index.ts` | Re-export constants |
| `shared/src/types.ts` | Remove duplicate dice types, unify WS types, remove unused types, DRY NPCExportFile |
| `server/src/services/tokenService.ts` | Import `TOKEN_COLORS` from shared |
| `client/src/components/MapCanvas.tsx` | Import `TOKEN_COLORS` from shared |
| 10+ server route files | Import auth helpers and constants |
| 10+ client component files | Import constants from shared |
| 21 client files | Import `API_URL` from lib/api |
| 4 server files | Import formatters |
| 2 client hook files | Import `cellsEqual` from utils |
| 4 client card components | Import `formatRelativeTime` from utils |
| 4 auth pages | Use `AuthBranding` component |
| 8+ detail pages | Use `PageLoadingSpinner` / `PageErrorState` |
| 5 modal/page files | Replace raw `<textarea>` with `Textarea` |
| 3 component files | Replace raw `<select>` with `Select` |
| `client/src/components/MapCard.tsx` | Replace custom dropdown with `DropdownMenu` |
| 3 pages | Use `entityImageSave` helpers |

## Files to Delete

| File | Reason |
|------|--------|
| `client/src/stores/` (directory) | Empty, unused |
| `client/src/components/DeleteAdventureDialog.tsx` | Replaced by generic `DeleteConfirmDialog` |
| `client/src/components/DeleteCampaignDialog.tsx` | Replaced by generic `DeleteConfirmDialog` |
| `client/src/components/DeleteCharacterDialog.tsx` | Replaced by generic `DeleteConfirmDialog` |
| `client/src/components/DeleteNPCDialog.tsx` | Replaced by generic `DeleteConfirmDialog` |
| `client/src/components/DeleteBackdropDialog.tsx` | Replaced by generic `DeleteConfirmDialog` |
| `client/src/components/DeleteNoteDialog.tsx` | Replaced by generic `DeleteConfirmDialog` |
| `client/src/components/DeleteMapDialog.tsx` | Replaced by generic `DeleteConfirmDialog` |

## Implementation Order

| Phase | Description | Files touched | Risk |
|-------|-------------|---------------|------|
| 1 | Shared validation + B/X constants | ~23 | Low — purely mechanical replacement |
| 2 | TOKEN_COLORS consolidation | 3 | Low — import change only |
| 3 | Client API_URL | ~22 | Low — import change only |
| 4 | Server auth utilities | ~13 | Medium — standardizing error codes |
| 5 | Server formatters | ~5 | Low — moving functions, no logic change |
| 6 | Client utility dedup (cellsEqual, formatRelativeTime, stores cleanup) | ~8 | Low — simple extraction |
| 7 | Generic DeleteConfirmDialog | ~14 | Low — mechanical replacement, 7 files deleted |
| 8 | Auth branding component | ~5 | Low — extracting identical markup |
| 9 | Page loading/error components | ~10 | Low — extracting identical markup |
| 10 | UI component consistency (Select, Textarea, MapCard dropdown) | ~9 | Low — using existing design system |
| 11 | Image save logic dedup | ~4 | Medium — consolidating async logic |
| 12 | Shared type cleanup | ~2 | Low — removing dead/duplicate types |

Each phase is independently deployable. Run `npm run typecheck` and `npm run lint` after each phase.

## Acceptance Criteria

- [ ] No validation constant (`MAX_NAME_LENGTH`, `MAX_DESCRIPTION_LENGTH`, `ALLOWED_MIME_TYPES`, `VALID_CLASSES`, `VALID_ALIGNMENTS`, etc.) is defined in more than one location
- [ ] `CLASS_ICONS` and `CHARACTER_CLASSES` are defined only in `shared/src/constants.ts`
- [ ] `TOKEN_COLORS` is defined only in `shared/src/types.ts`
- [ ] `API_URL` is defined only in `client/src/lib/api.ts`
- [ ] `requireVerifiedUser` is defined only in `server/src/utils/auth.ts`
- [ ] `requireAdventureOwnership` and `requireCampaignOwnership` are defined only in `server/src/utils/auth.ts` with consistent 404 behavior
- [ ] Session format functions are defined only in `server/src/utils/formatters.ts`
- [ ] `cellsEqual` is defined only in `client/src/utils/cellUtils.ts`
- [ ] `formatRelativeTime` is defined only in `client/src/utils/dateUtils.ts`
- [ ] All 7 entity-specific delete dialogs are replaced by `DeleteConfirmDialog`
- [ ] Auth branding block appears only in `AuthBranding.tsx`
- [ ] No raw `<textarea>` or `<select>` elements outside of `components/ui/`
- [ ] `MapCard` uses the shared `DropdownMenu` component
- [ ] No duplicate type definitions in `shared/src/types.ts` (dice types, WS types)
- [ ] No unused type exports in `shared/src/types.ts`
- [ ] `client/src/stores/` directory is removed
- [ ] `npm run typecheck` passes
- [ ] `npm run lint` passes
- [ ] All existing functionality works identically (no behavior changes)
