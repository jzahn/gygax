# Spec 002: Authentication

## Goal

Implement email/password authentication with JWT tokens stored in httpOnly cookies, providing secure user registration, login, logout, and session management.

## Scope

### In Scope

- User registration with email/password
- User login/logout
- JWT session tokens in httpOnly cookies
- Password hashing with Argon2id (OWASP recommended)
- Protected route component for future use
- Auth context and hook for React components
- Auth UI styled with Neobrutalism components (B/X aesthetic)
- Initial design system setup (Tailwind config, theme, base components)

### Out of Scope

- Magic link authentication
- Password reset flow
- Email verification
- OAuth/social login providers
- Rate limiting (future spec)
- Remember me / extended sessions
- Multi-device session management

## Dependencies

**New Server Dependencies:**
| Package | Version | Purpose |
|---------|---------|---------|
| @fastify/cookie | ^11.0.0 | Cookie parsing and setting |
| @node-rs/argon2 | ^2.0.0 | Password hashing (Argon2id) |
| jose | ^6.0.0 | JWT creation and verification |

**New Client Dependencies (via shadcn init):**
| Package | Version | Purpose |
|---------|---------|---------|
| class-variance-authority | ^0.7.0 | Component variant management |
| clsx | ^2.1.0 | Conditional class names |
| tailwind-merge | ^2.2.0 | Merge Tailwind classes |
| @radix-ui/react-label | ^2.0.0 | Accessible label primitive |
| @radix-ui/react-slot | ^1.0.0 | Slot composition |

Note: These are installed automatically when running `npx shadcn@latest init` and adding components.

**Google Fonts (loaded via CDN):**
| Font | Weights | Purpose |
|------|---------|---------|
| IM Fell English | 400, 400i | Display/headers (letterpress irregularity) |
| Spectral | 400, 400i, 500, 600 | Body text, labels (old-style book feel) |
| Special Elite | 400 | Input fields (typewriter aesthetic) |
| Cinzel | 700 | Decorative numerals |

**Environment Variables:**
| Variable | Description | Example |
|----------|-------------|---------|
| JWT_SECRET | Secret for signing JWTs (min 32 chars) | `your-super-secret-key-min-32-chars` |

## Detailed Requirements

### 1. Database Schema

**User Model (prisma/schema.prisma):**

```prisma
model User {
  id           String   @id @default(cuid())
  email        String   @unique
  passwordHash String
  name         String
  avatarUrl    String?
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt

  @@map("users")
}
```

**Migration:** `002_users` creates the users table with unique email constraint.

### 2. API Endpoints

#### POST /api/auth/register

Create a new user account.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "John Doe"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "name": "John Doe",
    "avatarUrl": null,
    "createdAt": "2024-01-20T12:00:00.000Z"
  }
}
```

Sets `auth_token` httpOnly cookie.

**Errors:**
- 400: Invalid input (missing fields, invalid email, password too short)
- 409: Email already registered

#### POST /api/auth/login

Authenticate an existing user.

**Request:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "name": "John Doe",
    "avatarUrl": null,
    "createdAt": "2024-01-20T12:00:00.000Z"
  }
}
```

Sets `auth_token` httpOnly cookie.

**Errors:**
- 400: Invalid input (missing fields)
- 401: Invalid email or password (same message for both to prevent enumeration)

#### POST /api/auth/logout

Clear the authentication cookie.

**Response (200):**
```json
{
  "success": true
}
```

Clears `auth_token` cookie.

#### GET /api/auth/me

Get the currently authenticated user.

**Response (200):**
```json
{
  "user": {
    "id": "clx...",
    "email": "user@example.com",
    "name": "John Doe",
    "avatarUrl": null,
    "createdAt": "2024-01-20T12:00:00.000Z"
  }
}
```

**Errors:**
- 401: Not authenticated (missing or invalid token)

### 3. Security Implementation

#### Password Hashing

Use Argon2id with OWASP-recommended parameters:
- Memory: 19 MiB (19456 KiB)
- Iterations: 2
- Parallelism: 1

```typescript
import { hash, verify } from '@node-rs/argon2'

// Hash password
const passwordHash = await hash(password, {
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
})

// Verify password
const valid = await verify(passwordHash, password)
```

#### JWT Tokens

- Algorithm: HS256
- Expiry: 7 days
- Payload: `{ sub: userId, email: userEmail }`

```typescript
import * as jose from 'jose'

const secret = new TextEncoder().encode(process.env.JWT_SECRET)

// Create token
const token = await new jose.SignJWT({ sub: userId, email })
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('7d')
  .sign(secret)

// Verify token
const { payload } = await jose.jwtVerify(token, secret)
```

#### Cookie Configuration

```typescript
{
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
}
```

### 4. Server Implementation

#### Auth Plugin (server/src/plugins/auth.ts)

Fastify plugin that:
1. Reads `auth_token` cookie on requests
2. Verifies JWT and extracts user ID
3. Decorates `request.user` with user data (or null if not authenticated)

```typescript
declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; email: string } | null
  }
}
```

#### Auth Routes (server/src/routes/auth.ts)

Implements all four endpoints with proper validation and error handling.

**Validation Rules:**
- Email: Must be valid email format, normalized to lowercase
- Password: Minimum 8 characters
- Name: Required, non-empty string

### 5. Client Implementation

#### AuthContext (client/src/contexts/AuthContext.tsx)

React context providing:
- `user`: Current user or null
- `loading`: Boolean for initial auth check
- `login(email, password)`: Login function
- `register(email, password, name)`: Registration function
- `logout()`: Logout function

On mount, calls `/api/auth/me` to check for existing session.

#### useAuth Hook (client/src/hooks/useAuth.ts)

Convenience hook wrapping the context:

```typescript
const { user, loading, login, register, logout } = useAuth()
```

#### LoginPage (client/src/pages/LoginPage.tsx)

**Page Title:** "RETURN TO THE REALM" (IM Fell English, ALL CAPS, letter-spaced)
**Subtitle:** "Present your credentials, adventurer" (Spectral italic)

**Layout:**
- Centered card with paper texture background
- Double-border treatment (decorative + structural)
- Vignette effect on page background
- Staggered ink-reveal animation on mount

**Form Elements:**
- Email input (Special Elite font when typing)
- Password input (Special Elite font when typing)
- "ENTER" button (primary variant, brutal shadow)
- Link: "New to these lands? Register your name →"

**States:**
- Loading: button shows quill animation + "Verifying credentials..."
- Error: medieval proclamation style ("⚔ The credentials you provided are not recognized")
- Focus: candleGlow border and glow ring on inputs

**Behavior:**
- Redirects to home on success
- Mobile-first layout (single column, full-width inputs with padding)

#### RegisterPage (client/src/pages/RegisterPage.tsx)

**Page Title:** "ADVENTURER'S REGISTRY" (IM Fell English, ALL CAPS, letter-spaced)
**Subtitle:** "Inscribe your name in the guild ledger" (Spectral italic)

**Layout:**
- Centered card with paper texture background
- Double-border treatment (decorative + structural)
- Vignette effect on page background
- Staggered ink-reveal animation on mount

**Form Elements:**
- Name input ("Your true name, adventurer")
- Email input ("Scrying address")
- Password input ("Secret word")
- Confirm password input ("Confirm your oath")
- "TAKE THE OATH" button (primary variant, brutal shadow)
- Link: "Already sworn? Return to your quest →"

**Validation:**
- Password minimum length (8 chars) — inline feedback
- Password confirmation match — inline feedback
- Validation messages styled as medieval hints

**States:**
- Loading: button shows quill animation + "Signing the ledger..."
- Error: medieval proclamation style
- Focus: candleGlow border and glow ring on inputs

**Behavior:**
- Redirects to home on success
- Mobile-first layout (single column, full-width inputs with padding)

#### ProtectedRoute (client/src/components/ProtectedRoute.tsx)

Route wrapper that:
- Shows loading state during auth check
- Redirects to login if not authenticated
- Renders children if authenticated

### 6. Design System Setup

#### Design Philosophy

The auth pages are the first impression of Gygax. They must immediately transport users to 1981—the feeling of cracking open a Moldvay Basic rulebook for the first time. This is not "retro-inspired modern design." This is a deliberate recreation of the tactile, imperfect, utilitarian aesthetics of early TSR products.

**Tone:** Scholarly dungeon-keeper. Like a wizard's grimoire crossed with a typewritten military form. Serious but with hidden warmth.

**The One Thing:** When users see the login page, they should feel like they're about to sign a contract with a medieval guild—formal, slightly intimidating, undeniably *real*.

#### Typography

**Display Font: "IM Fell English"**
- Google Fonts: `IM Fell English` (regular + italic)
- Used for: Page titles, form headers ("ADVENTURER'S REGISTRY", "RETURN TO THE REALM")
- Treatment: ALL CAPS, generous letter-spacing (0.15em), slight text-shadow for ink-bleed effect
- This font has the irregularity of letterpress printing—each character slightly imperfect

**Body/Label Font: "Spectral"**
- Google Fonts: `Spectral` (400, 500, 600)
- Used for: Labels, body text, helper text, error messages
- Treatment: Normal case, tight line-height (1.3), subtle ink color (#1a1a1a with 95% opacity)
- Spectral has old-style figures and the weight of printed text

**Input Font: "Special Elite"**
- Google Fonts: `Special Elite`
- Used for: All text inputs (email, password, name fields)
- Treatment: This typewriter font has ink splatter and key-strike irregularity
- Inputs should feel like typing on a 1970s IBM Selectric

**Dice/Numbers Font: "Cinzel"**
- Google Fonts: `Cinzel` (700)
- Used for: Decorative numerals, any displayed numbers
- Treatment: Bold weight only, for impact

```typescript
// tailwind.config.ts
{
  theme: {
    extend: {
      fontFamily: {
        display: ['"IM Fell English"', 'Georgia', 'serif'],
        body: ['Spectral', 'Georgia', 'serif'],
        input: ['"Special Elite"', 'Courier', 'monospace'],
        number: ['Cinzel', 'Georgia', 'serif'],
      },
    },
  },
}
```

#### Color System

The B/X palette is stark but not sterile. Think aged paper, iron gall ink, and candlelight.

```typescript
// tailwind.config.ts colors
{
  // Core palette
  parchment: {
    50: '#FFFEF7',   // Highlight/hover state
    100: '#FBF8F0',  // Card backgrounds
    200: '#F5F0E1',  // Page background
    300: '#E8E0CC',  // Subtle borders
  },
  ink: {
    DEFAULT: '#1a1a1a',  // Primary text, borders
    soft: '#2d2d2d',     // Secondary text
    faded: '#4a4a4a',    // Disabled states
    ghost: '#6a6a6a',    // Placeholder text
  },
  // Strategic accent colors (used SPARINGLY)
  bloodRed: '#8B0000',     // Errors, critical warnings
  candleGlow: '#D4A574',   // Focus rings, active states
  sealWax: '#722F37',      // Hover accents (like wax seal)
}
```

**Color Usage Rules:**
- 95% of the UI is ink-on-parchment
- `candleGlow` appears ONLY on focus states (keyboard navigation, input focus rings)
- `bloodRed` appears ONLY for errors
- `sealWax` appears on button hover as a subtle warmth

#### Shadows & Depth

Shadows should feel like objects casting shadows by candlelight—warm, slightly soft, directional.

```typescript
// tailwind.config.ts boxShadow
{
  brutal: '4px 4px 0px 0px #1a1a1a',           // Primary interactive elements
  'brutal-sm': '2px 2px 0px 0px #1a1a1a',     // Smaller elements
  'brutal-lg': '6px 6px 0px 0px #1a1a1a',     // Cards, modals
  'brutal-pressed': '2px 2px 0px 0px #1a1a1a', // Active/pressed state (moves down-right)
  'candle': '0 0 40px rgba(212, 165, 116, 0.15)', // Subtle ambient glow
  'ink-spread': '0 1px 2px rgba(26, 26, 26, 0.1)', // Text shadow for headers
}
```

#### Texture & Background

The page should feel like aged paper, not a flat digital surface.

**Paper Texture Implementation:**
```css
/* client/src/index.css */
:root {
  --noise-opacity: 0.03;
  --paper-grain: url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%' height='100%' filter='url(%23noise)'/%3E%3C/svg%3E");
}

.paper-texture {
  background-color: #F5F0E1;
  background-image: var(--paper-grain);
  background-blend-mode: multiply;
}

.paper-texture::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at center, transparent 0%, rgba(26, 26, 26, 0.04) 100%);
  pointer-events: none;
}
```

**Vignette Effect:**
Auth pages should have a subtle darkening at the edges—like looking at parchment by candlelight with the edges falling into shadow.

#### Motion & Animation

Animations should feel deliberate and mechanical, like the movement of ink on paper or the opening of an old book.

**Principles:**
- No bouncy/elastic easing—use `ease-out` or custom cubic-bezier for weighted feel
- Staggered reveals create hierarchy (title → subtitle → form → buttons)
- Hover states should feel like ink spreading, not modern transforms

**Page Load Animation (staggered reveal):**
```css
@keyframes inkReveal {
  from {
    opacity: 0;
    transform: translateY(8px);
    filter: blur(2px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
    filter: blur(0);
  }
}

.animate-ink-reveal {
  animation: inkReveal 0.5s ease-out forwards;
}

/* Stagger children */
.stagger-children > *:nth-child(1) { animation-delay: 0ms; }
.stagger-children > *:nth-child(2) { animation-delay: 80ms; }
.stagger-children > *:nth-child(3) { animation-delay: 160ms; }
.stagger-children > *:nth-child(4) { animation-delay: 240ms; }
.stagger-children > *:nth-child(5) { animation-delay: 320ms; }
```

**Button Hover Effect:**
```css
.btn-brutal {
  transition: transform 0.1s ease-out, box-shadow 0.1s ease-out;
}

.btn-brutal:hover {
  transform: translate(-2px, -2px);
  box-shadow: 6px 6px 0px 0px #1a1a1a;
}

.btn-brutal:active {
  transform: translate(2px, 2px);
  box-shadow: 2px 2px 0px 0px #1a1a1a;
}
```

**Input Focus Animation:**
```css
.input-brutal {
  transition: box-shadow 0.15s ease-out, border-color 0.15s ease-out;
}

.input-brutal:focus {
  border-color: #D4A574;
  box-shadow: 0 0 0 3px rgba(212, 165, 116, 0.25), 4px 4px 0px 0px #1a1a1a;
}
```

**Loading Spinner:**
Instead of a circular spinner, use a custom "quill scratching" or "dice rolling" animation:
```css
@keyframes quillScratch {
  0%, 100% { transform: rotate(-5deg) translateX(0); }
  25% { transform: rotate(5deg) translateX(2px); }
  50% { transform: rotate(-3deg) translateX(-1px); }
  75% { transform: rotate(4deg) translateX(1px); }
}
```

#### Spatial Composition

Auth pages should feel like formal documents—centered, structured, with generous margins.

**Layout Structure:**
```
┌──────────────────────────────────────────────────┐
│                                                  │
│     ╔══════════════════════════════════════╗     │
│     ║                                      ║     │
│     ║    ┌────────────────────────────┐    ║     │
│     ║    │     ADVENTURER'S GUILD     │    ║     │
│     ║    │        ═══════════         │    ║     │
│     ║    │                            │    ║     │
│     ║    │  Name: ________________    │    ║     │
│     ║    │  Email: _______________    │    ║     │
│     ║    │  Password: ____________    │    ║     │
│     ║    │                            │    ║     │
│     ║    │  ┌────────────────────┐    │    ║     │
│     ║    │  │  ENTER THE REALM   │    │    ║     │
│     ║    │  └────────────────────┘    │    ║     │
│     ║    └────────────────────────────┘    ║     │
│     ║                                      ║     │
│     ╚══════════════════════════════════════╝     │
│                                                  │
│              Already registered?                 │
│              Return to your quest →              │
│                                                  │
└──────────────────────────────────────────────────┘
```

**Key Spatial Rules:**
- Form card: `max-w-md` (448px) on desktop, full-width with padding on mobile
- Generous vertical padding in card: `py-10 px-8`
- Double border treatment: outer decorative border + inner form border
- Form fields: stack with `space-y-6` (24px gaps)—more breathing room than typical forms
- Labels positioned above inputs with small gap (`mb-1.5`)

#### Component Specifications

**Installation:**
```bash
npx shadcn@latest init
npx shadcn@latest add button input card label
```

After installation, heavily customize for B/X aesthetic:

**Button Component:**
```tsx
// Variants
- default: parchment bg, ink border, brutal shadow
- primary: ink bg, parchment text, brutal shadow (for primary actions)
- ghost: transparent bg, ink text, no shadow (for links)
- destructive: bloodRed text (for logout, delete)

// States
- hover: lifts up-left, shadow expands
- active: presses down-right, shadow shrinks
- disabled: faded ink color, dashed border, no shadow
- loading: quill scratch animation + "Signing the ledger..." text
```

**Input Component:**
```tsx
// Base styling
- 3px solid ink border
- parchment background
- Special Elite font for typed text
- Spectral font for placeholder (italic, ghost color)
- brutal-sm shadow

// States
- focus: candleGlow border, glow ring, shadow maintained
- error: bloodRed border, no glow
- disabled: parchment-300 background, faded text
```

**Card Component:**
```tsx
// Auth card treatment
- Double border: outer 1px decorative + inner 3px structural
- Paper texture background
- brutal-lg shadow
- Corner flourishes (optional CSS pseudo-elements)
```

**Label Component:**
```tsx
// Styling
- Spectral font, 500 weight
- ALL CAPS with letter-spacing for form labels
- Ink color, small font-size (text-sm)
```

#### Decorative Elements

**Horizontal Rules:**
```css
.divider-ornate {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.divider-ornate::before,
.divider-ornate::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, #1a1a1a, transparent);
}
```

**Corner Flourishes (optional):**
Using CSS pseudo-elements or inline SVG, add small decorative corners to the auth card—inspired by TSR book page borders.

#### Fonts Loading

```html
<!-- client/index.html -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=IM+Fell+English:ital@0;1&family=Special+Elite&family=Spectral:ital,wght@0,400;0,500;0,600;1,400&display=swap" rel="stylesheet">
```

#### Page-Specific Design

**Login Page ("Return to the Realm"):**
- Title: "RETURN TO THE REALM" in IM Fell English
- Subtitle: "Present your credentials, adventurer" in Spectral italic
- Fields: Email, Password
- Button: "ENTER" (primary variant)
- Link: "New to these lands? Register your name →"

**Register Page ("Adventurer's Registry"):**
- Title: "ADVENTURER'S REGISTRY" in IM Fell English
- Subtitle: "Inscribe your name in the guild ledger" in Spectral italic
- Fields: Name, Email, Password, Confirm Password
- Button: "TAKE THE OATH" (primary variant)
- Link: "Already sworn? Return to your quest →"

**Error Messages:**
- Styled as medieval proclamations: "⚔ The credentials you provided are not recognized"
- BloodRed text, Spectral font, small icon prefix

### 7. Project Structure Updates

**New Files:**
```
server/src/plugins/auth.ts      # JWT validation plugin
server/src/routes/auth.ts       # Auth endpoints
client/src/contexts/AuthContext.tsx
client/src/hooks/useAuth.ts
client/src/pages/LoginPage.tsx
client/src/pages/RegisterPage.tsx
client/src/pages/HomePage.tsx   # Renamed from pages/index.tsx content
client/src/components/ProtectedRoute.tsx
client/src/components/ui/button.tsx   # Generated by shadcn
client/src/components/ui/input.tsx    # Generated by shadcn
client/src/components/ui/card.tsx     # Generated by shadcn
client/src/components/ui/label.tsx    # Generated by shadcn
client/src/components/ui/divider.tsx  # Ornate horizontal rule component
client/src/lib/utils.ts               # Generated by shadcn (cn helper)
client/components.json                # shadcn configuration
```

**Modified Files:**
```
prisma/schema.prisma            # Add User model
shared/src/types.ts             # Add auth types
server/src/app.ts               # Register plugins and routes
server/package.json             # Add dependencies
client/src/App.tsx              # Add AuthProvider and routes
client/src/pages/index.tsx      # Re-export all pages
client/src/index.css            # Add fonts, base styles
client/tailwind.config.ts       # B/X theme customization
docker-compose.yml              # Add JWT_SECRET env var
.env.example                    # Add JWT_SECRET
```

### 8. Type Definitions (shared/src/types.ts)

```typescript
// Auth types
export interface User {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  createdAt: string
}

export interface AuthResponse {
  user: User
}

export interface RegisterRequest {
  email: string
  password: string
  name: string
}

export interface LoginRequest {
  email: string
  password: string
}

export interface LogoutResponse {
  success: boolean
}

export interface AuthError {
  error: string
  message: string
}
```

## Technical Approach

### Why Hand-rolled Auth?

1. **Simplicity**: No external auth service dependencies
2. **Control**: Full control over session management
3. **Learning**: Appropriate for a personal project
4. **Security**: Using proven libraries (Argon2, jose) for crypto

### Why httpOnly Cookies?

1. **XSS Protection**: JavaScript cannot access the token
2. **Automatic Handling**: Browser sends cookie automatically
3. **CSRF Protection**: sameSite=lax prevents cross-site requests

### Why Argon2id?

1. **OWASP Recommended**: Current best practice for password hashing
2. **Memory-hard**: Resistant to GPU/ASIC attacks
3. **Modern**: Successor to bcrypt/scrypt

## Acceptance Criteria

### Registration
- [ ] Can register with valid email/password/name
- [ ] Registration sets httpOnly cookie
- [ ] Cannot register with existing email (409 error)
- [ ] Cannot register with password < 8 chars (400 error)
- [ ] Cannot register with invalid email format (400 error)
- [ ] Email is normalized to lowercase

### Login
- [ ] Can login with correct credentials
- [ ] Login sets httpOnly cookie
- [ ] Cannot login with wrong password (401 error)
- [ ] Cannot login with non-existent email (401 error, same message)
- [ ] Error message doesn't reveal if email exists

### Logout
- [ ] Logout clears the cookie
- [ ] After logout, /me returns 401

### Session Management
- [ ] /me returns user when authenticated
- [ ] /me returns 401 when not authenticated
- [ ] Session persists across page refreshes
- [ ] Session expires after 7 days

### Client
- [ ] AuthContext provides user state
- [ ] Login form works and redirects
- [ ] Register form works and redirects
- [ ] Register form validates password confirmation matches
- [ ] Register form shows inline validation feedback
- [ ] Logout works and updates UI
- [ ] ProtectedRoute redirects when not authenticated

### Security
- [ ] Passwords are hashed with Argon2id
- [ ] Cookies are httpOnly
- [ ] Cookies are secure in production
- [ ] JWT contains only necessary claims

### Design System
- [ ] Tailwind configured with full B/X theme (parchment scale, ink scale, accent colors)
- [ ] All four fonts loaded: IM Fell English (display), Spectral (body), Special Elite (input), Cinzel (numbers)
- [ ] Paper texture background implemented with noise SVG
- [ ] Vignette effect applied to auth page backgrounds
- [ ] Brutal shadow utility classes available (brutal, brutal-sm, brutal-lg, brutal-pressed)
- [ ] Button component with lift/press hover animations
- [ ] Input component with Special Elite font, candleGlow focus ring
- [ ] Card component with double-border treatment and paper texture
- [ ] Staggered ink-reveal animation on page load
- [ ] Decorative horizontal rule component available

### Visual Design Quality
- [ ] Page titles use IM Fell English, ALL CAPS, letter-spaced
- [ ] Form has scholarly/medieval tone ("ADVENTURER'S REGISTRY", "RETURN TO THE REALM")
- [ ] Error messages styled as medieval proclamations with bloodRed color
- [ ] Loading states show custom animation (not generic spinner)
- [ ] Color is used sparingly—95% ink-on-parchment
- [ ] Focus states use candleGlow accent color
- [ ] Overall impression: "signing a contract with a medieval guild"

### Loading States
- [ ] Submit buttons show custom quill/pen animation during API requests
- [ ] Button text changes to medieval phrasing ("Signing the ledger...", "Verifying credentials...")
- [ ] Form inputs disabled during submission
- [ ] Double-submit prevented
- [ ] Loading state feels deliberate and thematic, not generic

### Responsive Design
- [ ] Auth pages render correctly on mobile (< 640px)
- [ ] Auth pages render correctly on tablet (768px - 1024px)
- [ ] Auth pages render correctly on desktop (> 1024px)
- [ ] Touch targets are minimum 44px on mobile
- [ ] Form card has appropriate max-width on large screens

## Verification Steps

### 1. Registration Test

```bash
# Register new user
curl -X POST http://localhost:3000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"Test User"}' \
  -c cookies.txt -v

# Verify cookie is set (check Set-Cookie header)
# Verify response contains user object
```

### 2. Login Test

```bash
# Login with credentials
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}' \
  -c cookies.txt -v

# Verify cookie is set
```

### 3. Get Current User Test

```bash
# Get current user (with cookie)
curl http://localhost:3000/api/auth/me \
  -b cookies.txt

# Should return user object

# Get current user (without cookie)
curl http://localhost:3000/api/auth/me

# Should return 401
```

### 4. Logout Test

```bash
# Logout
curl -X POST http://localhost:3000/api/auth/logout \
  -b cookies.txt -c cookies.txt

# Verify /me now returns 401
curl http://localhost:3000/api/auth/me \
  -b cookies.txt

# Should return 401
```

### 5. Client Flow Test

1. Open http://localhost:5173
2. Should see home page with "Not logged in" state
3. Click "Register your name" link → navigates to /register
4. Page title should read "ADVENTURER'S REGISTRY"
5. Fill form (Name, Email, Password, Confirm Password), submit
6. Watch staggered animation on form elements
7. Should redirect to home, showing logged in user
8. Click logout
9. Should show "Not logged in" state
10. Click "Return to your quest" link → navigates to /login
11. Page title should read "RETURN TO THE REALM"
12. Fill form, submit
13. Should redirect to home, showing logged in user

### 6. Security Verification

```bash
# Verify cookie is httpOnly (should NOT be accessible via JS)
# In browser console:
document.cookie  # Should not show auth_token

# Verify password is hashed (check database)
# In Prisma Studio, user's passwordHash should be Argon2 hash, not plaintext
```

### 7. Visual Design Verification

**First Impression Test:**
1. Open http://localhost:5173/login with fresh eyes
2. Ask: "Does this feel like 1981? Like a wizard's guild registry?"
3. The page should NOT look like a modern tech startup login

**Typography Verification:**
1. Verify page title uses IM Fell English (irregular letterpress feel)
2. Verify title is ALL CAPS with visible letter-spacing
3. Verify labels use Spectral font (old-style figures, book weight)
4. Type in input fields—text should appear in Special Elite (typewriter)
5. Verify subtle ink-bleed text-shadow on headings

**Color & Texture Verification:**
1. Background should have visible paper grain/noise texture (not flat)
2. Edges of page should have subtle vignette darkening
3. Primary colors should be parchment (#F5F0E1) and ink (#1a1a1a)
4. Only error messages should use bloodRed (#8B0000)
5. Only focus states should use candleGlow (#D4A574)

**Animation Verification:**
1. Refresh the page and watch the load animation:
   - Title should fade in first
   - Form elements should stagger in with 80ms delays
   - Animation should feel like ink appearing, not bouncing
2. Hover over buttons:
   - Button should lift up-left (translate -2px, -2px)
   - Shadow should expand
3. Click and hold button:
   - Button should press down-right
   - Shadow should shrink
4. Focus on input field:
   - Should show candleGlow border color
   - Should have soft glow ring around field

**Component Verification:**
1. Card should have double-border treatment (decorative + structural)
2. Inputs should have 3px solid borders
3. Buttons should have brutal shadow offset
4. Horizontal dividers should use ornate gradient fade

**Loading State Verification:**
1. Submit form with valid data
2. Button should show custom loading animation (not generic circle spinner)
3. Button text should change to "Signing the ledger..." or similar
4. All inputs should be disabled during submission
5. Entire experience should feel deliberate, not generic

**The Ultimate Test:**
Screenshot the login page and show it to someone unfamiliar with the project. Ask: "What era does this remind you of?" Target answer: "Old D&D books" or "1980s" or "Medieval"

### 8. Responsive Design Verification

1. Open browser DevTools and test at different widths:
   - **Mobile (375px):** Form should be full-width with padding
   - **Tablet (768px):** Form should be centered with reasonable max-width
   - **Desktop (1280px):** Form should be centered, not too wide
2. Verify touch targets are large enough on mobile (buttons, inputs)
3. Test on actual mobile device if possible

## References

- [PRD: Authentication](/prd.md#authentication)
- [PRD: Visual Design](/prd.md#visual-design)
- [Neobrutalism Components](https://www.neobrutalism.dev/)
- [OWASP Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
- [Argon2 RFC](https://datatracker.ietf.org/doc/html/rfc9106)
- [jose library](https://github.com/panva/jose)
- [@node-rs/argon2](https://github.com/napi-rs/node-rs/tree/main/packages/argon2)
- [@fastify/cookie](https://github.com/fastify/fastify-cookie)
- [Google Fonts: IM Fell English](https://fonts.google.com/specimen/IM+Fell+English) - Display font (letterpress irregularity)
- [Google Fonts: Spectral](https://fonts.google.com/specimen/Spectral) - Body font (old-style book typography)
- [Google Fonts: Special Elite](https://fonts.google.com/specimen/Special+Elite) - Input font (typewriter)
- [Google Fonts: Cinzel](https://fonts.google.com/specimen/Cinzel) - Number font (decorative numerals)
