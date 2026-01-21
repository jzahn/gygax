# Spec 003: Email Infrastructure & Verification

## Goal

Implement email infrastructure with a self-hosted SMTP container, enabling email verification on registration and password reset functionality.

## Scope

### In Scope

- Mailpit SMTP container for development (catches all emails, web UI)
- Nodemailer integration for sending emails
- Email verification on registration
- Resend verification email functionality
- Forgot password flow (request → email → reset form)
- HTML email templates with B/X aesthetic
- Production-ready SMTP configuration (env-based)

### Out of Scope

- Transactional email analytics
- Email preferences/unsubscribe
- Marketing emails
- Multiple email providers/failover
- Email queuing (future spec if needed)

## Dependencies

**New Server Dependencies:**
| Package | Version | Purpose |
|---------|---------|---------|
| nodemailer | ^6.9.0 | SMTP email sending |

**New Docker Service:**
| Service | Image | Purpose |
|---------|-------|---------|
| mailpit | axllent/mailpit | Development SMTP server with web UI |

**Environment Variables:**
| Variable | Description | Dev Default |
|----------|-------------|-------------|
| SMTP_HOST | SMTP server hostname | mailpit |
| SMTP_PORT | SMTP server port | 1025 |
| SMTP_USER | SMTP username (optional) | (empty) |
| SMTP_PASS | SMTP password (optional) | (empty) |
| SMTP_FROM | Default from address | noreply@gygax.local |
| SMTP_SECURE | Use TLS | false |
| APP_URL | Base URL for email links | http://localhost:5173 |

## Detailed Requirements

### 1. Database Schema Changes

**Update User Model:**

```prisma
model User {
  id            String   @id @default(cuid())
  email         String   @unique
  passwordHash  String
  name          String
  avatarUrl     String?
  emailVerified Boolean  @default(false)
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  passwordResets PasswordReset[]

  @@map("users")
}
```

**New PasswordReset Model:**

```prisma
model PasswordReset {
  id        String   @id @default(cuid())
  token     String   @unique
  expiresAt DateTime
  usedAt    DateTime?
  createdAt DateTime @default(now())

  userId    String
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@map("password_resets")
}
```

**Migration:** `003_email_verification` adds `emailVerified` to users and creates `password_resets` table.

### 2. Docker Configuration

**Add Mailpit to docker-compose.yml:**

```yaml
mailpit:
  image: axllent/mailpit:latest
  ports:
    - '8025:8025'  # Web UI
    - '1025:1025'  # SMTP
  environment:
    MP_SMTP_AUTH_ACCEPT_ANY: 1
    MP_SMTP_AUTH_ALLOW_INSECURE: 1
```

**Update server service environment:**

```yaml
server:
  environment:
    # ... existing vars
    SMTP_HOST: mailpit
    SMTP_PORT: 1025
    SMTP_FROM: noreply@gygax.local
    SMTP_SECURE: false
    APP_URL: http://localhost:5173
```

### 3. API Endpoints

#### POST /api/auth/register (Modified)

After registration:
- Set `emailVerified: false`
- Generate verification token (signed JWT, 24h expiry)
- Send verification email
- Response unchanged (user is logged in but unverified)

#### POST /api/auth/verify-email

Verify email address with token.

**Request:**
```json
{
  "token": "eyJhbG..."
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Email verified successfully"
}
```

**Errors:**
- 400: Invalid or expired token

#### POST /api/auth/resend-verification

Resend verification email to current user.

**Response (200):**
```json
{
  "success": true,
  "message": "Verification email sent"
}
```

**Errors:**
- 401: Not authenticated
- 400: Email already verified

#### POST /api/auth/forgot-password

Request password reset email.

**Request:**
```json
{
  "email": "user@example.com"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "If an account exists, a reset email has been sent"
}
```

Note: Always returns success to prevent email enumeration.

#### POST /api/auth/reset-password

Reset password with token.

**Request:**
```json
{
  "token": "cuid-token-here",
  "password": "newpassword123"
}
```

**Response (200):**
```json
{
  "success": true,
  "message": "Password reset successfully"
}
```

**Errors:**
- 400: Invalid or expired token, or password too short

### 4. Token Implementation

#### Email Verification Token

Use signed JWT for verification tokens:
- Payload: `{ sub: userId, email: userEmail, purpose: 'verify-email' }`
- Expiry: 24 hours
- Signed with JWT_SECRET

```typescript
const token = await new jose.SignJWT({
  sub: userId,
  email,
  purpose: 'verify-email'
})
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime('24h')
  .sign(secret)
```

#### Password Reset Token

Use database-stored tokens for password reset (allows invalidation):
- Generate: `crypto.randomBytes(32).toString('hex')`
- Store hashed in database: `crypto.createHash('sha256').update(token).digest('hex')`
- Expiry: 1 hour
- Single use (mark `usedAt` after use)
- Send unhashed token in email, compare hashed on verification

### 5. Email Service

**Email Service (server/src/services/email.ts):**

```typescript
import nodemailer from 'nodemailer'

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '1025'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: process.env.SMTP_USER ? {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  } : undefined,
})

export async function sendEmail(options: {
  to: string
  subject: string
  html: string
}) {
  await transporter.sendMail({
    from: process.env.SMTP_FROM,
    ...options,
  })
}
```

### 6. Email Templates

**Design Philosophy:**

Email templates should match the B/X aesthetic:
- Parchment background color (#F5F0E1)
- IM Fell English for headings (via web font or fallback to Georgia)
- Spectral for body text (fallback to Georgia)
- Ink color (#1a1a1a) for text
- Minimal design, no heavy graphics
- Border treatment reminiscent of old rulebook pages

**Verification Email:**

Subject: "Verify Your Guild Membership"

```
GYGAX
─────────────────────────

Hail, {name}!

Your request to join the guild has been received.
To complete your registration, you must verify
your scrying address.

[VERIFY MY ADDRESS]

This seal expires in 24 hours.

If you did not request this, you may safely
disregard this missive.

─────────────────────────
The Guild Registry
```

**Password Reset Email:**

Subject: "Reset Your Secret Word"

```
GYGAX
─────────────────────────

Hail, {name}!

A request has been made to reset your secret word.
If this was you, click below to choose a new one:

[RESET SECRET WORD]

This seal expires in 1 hour.

If you did not request this, your account remains
secure. No action is needed.

─────────────────────────
The Guild Registry
```

### 7. Client Implementation

#### VerifyEmailPage (client/src/pages/VerifyEmailPage.tsx)

Handles the `/verify-email?token=...` route:
- Shows loading state while verifying
- Success: "Your guild membership is confirmed" + redirect to home
- Error: "This seal has expired or is invalid" + link to resend

**Page Title:** "GUILD VERIFICATION"

#### UnverifiedPage (client/src/pages/UnverifiedPage.tsx)

Shown to logged-in users with `emailVerified: false`:
- Explains they need to verify
- Shows their email address
- "Resend Verification" button
- "Check {email} for the verification missive"

**Page Title:** "VERIFY YOUR MEMBERSHIP"

#### ForgotPasswordPage (client/src/pages/ForgotPasswordPage.tsx)

**Page Title:** "FORGOTTEN SECRET WORD"
**Subtitle:** "Fear not, adventurer. We shall send a recovery scroll."

Form:
- Email input
- "Send Recovery Scroll" button
- Success state: "If a guild member with that address exists, a recovery scroll has been dispatched."
- Link back to login

#### ResetPasswordPage (client/src/pages/ResetPasswordPage.tsx)

Handles the `/reset-password?token=...` route:

**Page Title:** "CHOOSE A NEW SECRET WORD"

Form:
- New password input
- Confirm password input
- "Seal New Password" button
- Success: Redirect to login with success message
- Error: "This recovery scroll has expired" + link to request new one

#### ProtectedRoute Updates

Modify ProtectedRoute to check `emailVerified`:
- If authenticated but not verified → redirect to `/verify-pending`
- If not authenticated → redirect to `/login`

#### Route Updates

```tsx
<Route path="/verify-email" element={<VerifyEmailPage />} />
<Route path="/verify-pending" element={<UnverifiedPage />} />
<Route path="/forgot-password" element={<ForgotPasswordPage />} />
<Route path="/reset-password" element={<ResetPasswordPage />} />
```

#### LoginPage Updates

Add "Forgot your secret word?" link below the form.

### 8. Project Structure Updates

**New Files:**
```
server/src/services/email.ts           # Email sending service
server/src/templates/                  # Email templates directory
server/src/templates/verify-email.ts   # Verification email template
server/src/templates/reset-password.ts # Password reset email template
server/src/routes/auth.ts              # Modified - new endpoints
client/src/pages/VerifyEmailPage.tsx
client/src/pages/UnverifiedPage.tsx
client/src/pages/ForgotPasswordPage.tsx
client/src/pages/ResetPasswordPage.tsx
```

**Modified Files:**
```
prisma/schema.prisma                   # Add emailVerified, PasswordReset
docker-compose.yml                     # Add mailpit service
.env.example                           # Add SMTP vars
server/src/routes/auth.ts              # New endpoints
client/src/components/ProtectedRoute.tsx # Check emailVerified
client/src/pages/LoginPage.tsx         # Add forgot password link
client/src/App.tsx                     # Add new routes
shared/src/types.ts                    # Add new types
```

### 9. Type Definitions

```typescript
// Add to shared/src/types.ts

export interface User {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  emailVerified: boolean  // Added
  createdAt: string
}

export interface VerifyEmailRequest {
  token: string
}

export interface ForgotPasswordRequest {
  email: string
}

export interface ResetPasswordRequest {
  token: string
  password: string
}

export interface MessageResponse {
  success: boolean
  message: string
}
```

## Security Considerations

### Password Reset Security

1. **Token Storage**: Store only hashed tokens in database
2. **Timing Attacks**: Use constant-time comparison for token verification
3. **Single Use**: Mark tokens as used immediately, before password update
4. **Short Expiry**: 1 hour expiry limits exposure window
5. **No Email Enumeration**: Same response whether email exists or not
6. **Invalidate Sessions**: Optionally invalidate other sessions on password reset

### Email Verification Security

1. **JWT Signed**: Tokens are signed, can't be forged
2. **Purpose Claim**: Prevents token reuse for other purposes
3. **24h Expiry**: Reasonable window without being too long

## Acceptance Criteria

### Email Infrastructure
- [ ] Mailpit container runs and catches emails
- [ ] Mailpit web UI accessible at http://localhost:8025
- [ ] Server can send emails via Nodemailer
- [ ] Email templates render with B/X aesthetic

### Email Verification
- [ ] New users have `emailVerified: false`
- [ ] Verification email sent on registration
- [ ] Clicking verification link sets `emailVerified: true`
- [ ] Expired tokens show appropriate error
- [ ] Can resend verification email
- [ ] Unverified users redirected to verification pending page
- [ ] Verified users can access protected routes

### Password Reset
- [ ] Forgot password sends reset email (if account exists)
- [ ] Forgot password returns same response for non-existent emails
- [ ] Reset token expires after 1 hour
- [ ] Reset token is single-use
- [ ] Can set new password with valid token
- [ ] Invalid/expired token shows appropriate error
- [ ] After reset, user can login with new password

### UI/UX
- [ ] All new pages match B/X aesthetic
- [ ] Forgot password link on login page
- [ ] Clear feedback messages throughout flows
- [ ] Mobile responsive

## Verification Steps

### 1. Email Infrastructure Test

```bash
# Start services
npm run dev

# Open Mailpit UI
open http://localhost:8025

# Register a new user and check Mailpit for verification email
```

### 2. Email Verification Flow

1. Register new user
2. Check Mailpit for verification email
3. Verify user is redirected to /verify-pending
4. Click verification link in email
5. Verify redirect to home page
6. Verify can access protected routes

### 3. Password Reset Flow

1. Click "Forgot password" on login page
2. Enter email, submit
3. Check Mailpit for reset email
4. Click reset link
5. Enter new password
6. Verify redirect to login
7. Login with new password

### 4. Security Verification

```bash
# Verify token is hashed in database
docker compose exec db psql -U gygax -d gygax -c "SELECT token FROM password_resets;"
# Should show hashed value, not the token from the email

# Verify same response for non-existent email
curl -X POST http://localhost:3000/api/auth/forgot-password \
  -H "Content-Type: application/json" \
  -d '{"email":"nonexistent@example.com"}'
# Should return success message
```

## Production Considerations

For production deployment:

1. **SMTP Configuration**: Set real SMTP credentials via environment variables
2. **APP_URL**: Set to production domain
3. **SMTP_SECURE**: Set to `true` for TLS
4. **Rate Limiting**: Add rate limiting to email endpoints (future spec)
5. **Email Deliverability**: Consider SPF/DKIM/DMARC for custom domain

Example production environment:
```bash
SMTP_HOST=smtp.yourdomain.com
SMTP_PORT=587
SMTP_USER=noreply@yourdomain.com
SMTP_PASS=your-smtp-password
SMTP_FROM=Gygax <noreply@yourdomain.com>
SMTP_SECURE=true
APP_URL=https://gygax.yourdomain.com
```

## References

- [Spec 002: Authentication](/specs/002-auth.md)
- [Nodemailer Documentation](https://nodemailer.com/)
- [Mailpit](https://github.com/axllent/mailpit)
- [OWASP Forgot Password Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
