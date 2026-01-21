import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { hash, verify } from '@node-rs/argon2'
import crypto from 'crypto'
import * as jose from 'jose'
import type {
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  LogoutResponse,
  User,
  VerifyEmailRequest,
  ForgotPasswordRequest,
  ResetPasswordRequest,
  MessageResponse,
} from '@gygax/shared'
import { sendEmail } from '../services/email.js'
import { verifyEmailSubject, verifyEmailHtml } from '../templates/verify-email.js'
import { resetPasswordSubject, resetPasswordHtml } from '../templates/reset-password.js'

// Argon2id parameters (OWASP recommended)
const ARGON2_OPTIONS = {
  memoryCost: 19456, // 19 MiB
  timeCost: 2,
  parallelism: 1,
}

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function formatUser(user: {
  id: string
  email: string
  name: string
  avatarUrl: string | null
  emailVerified: boolean
  createdAt: Date
}): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    emailVerified: user.emailVerified,
    createdAt: user.createdAt.toISOString(),
  }
}

// Create JWT verification token
async function createVerificationToken(
  userId: string,
  email: string,
  secret: Uint8Array
): Promise<string> {
  return await new jose.SignJWT({
    sub: userId,
    email,
    purpose: 'verify-email',
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('24h')
    .sign(secret)
}

// Create password reset token and hash
function createPasswordResetToken(): { token: string; hash: string } {
  const token = crypto.randomBytes(32).toString('hex')
  const hash = crypto.createHash('sha256').update(token).digest('hex')
  return { token, hash }
}

export async function authRoutes(fastify: FastifyInstance) {
  // Get JWT secret for verification tokens
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  const secret = new TextEncoder().encode(jwtSecret)
  const appUrl = process.env.APP_URL || 'http://localhost:5173'

  // POST /api/auth/register
  fastify.post<{ Body: RegisterRequest }>(
    '/api/auth/register',
    async (request: FastifyRequest<{ Body: RegisterRequest }>, reply: FastifyReply) => {
      const { email, password, name } = request.body

      // Validate input
      if (!email || !password || !name) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Email, password, and name are required',
        })
      }

      if (!EMAIL_REGEX.test(email)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid email format',
        })
      }

      if (password.length < 8) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Password must be at least 8 characters',
        })
      }

      if (name.trim().length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Name is required',
        })
      }

      // Normalize email to lowercase
      const normalizedEmail = email.toLowerCase().trim()

      // Check if email already exists
      const existingUser = await fastify.prisma.user.findUnique({
        where: { email: normalizedEmail },
      })

      if (existingUser) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'Email already registered',
        })
      }

      // Hash password
      const passwordHash = await hash(password, ARGON2_OPTIONS)

      // Create user
      const user = await fastify.prisma.user.create({
        data: {
          email: normalizedEmail,
          passwordHash,
          name: name.trim(),
          emailVerified: false,
        },
      })

      // Send verification email (don't fail registration if email fails)
      try {
        const verificationToken = await createVerificationToken(user.id, user.email, secret)
        const verifyUrl = `${appUrl}/verify-email?token=${encodeURIComponent(verificationToken)}`
        await sendEmail({
          to: user.email,
          subject: verifyEmailSubject(),
          html: verifyEmailHtml({ name: user.name, verifyUrl }),
        })
      } catch (emailError) {
        fastify.log.error(emailError, 'Failed to send verification email')
      }

      // Create and set auth token
      const authToken = await fastify.createAuthToken(user.id, user.email)
      fastify.setAuthCookie(reply, authToken)

      const response: AuthResponse = {
        user: formatUser(user),
      }

      return reply.status(201).send(response)
    }
  )

  // POST /api/auth/login
  fastify.post<{ Body: LoginRequest }>(
    '/api/auth/login',
    async (request: FastifyRequest<{ Body: LoginRequest }>, reply: FastifyReply) => {
      const { email, password } = request.body

      // Validate input
      if (!email || !password) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Email and password are required',
        })
      }

      // Normalize email to lowercase
      const normalizedEmail = email.toLowerCase().trim()

      // Find user
      const user = await fastify.prisma.user.findUnique({
        where: { email: normalizedEmail },
      })

      // Generic error message to prevent email enumeration
      const invalidCredentialsError = {
        error: 'Unauthorized',
        message: 'Invalid email or password',
      }

      if (!user) {
        return reply.status(401).send(invalidCredentialsError)
      }

      // Verify password
      const validPassword = await verify(user.passwordHash, password)
      if (!validPassword) {
        return reply.status(401).send(invalidCredentialsError)
      }

      // Create and set auth token
      const token = await fastify.createAuthToken(user.id, user.email)
      fastify.setAuthCookie(reply, token)

      const response: AuthResponse = {
        user: formatUser(user),
      }

      return reply.status(200).send(response)
    }
  )

  // POST /api/auth/logout
  fastify.post(
    '/api/auth/logout',
    async (_request: FastifyRequest, reply: FastifyReply) => {
      fastify.clearAuthCookie(reply)

      const response: LogoutResponse = {
        success: true,
      }

      return reply.status(200).send(response)
    }
  )

  // GET /api/auth/me
  fastify.get(
    '/api/auth/me',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Not authenticated',
        })
      }

      const user = await fastify.prisma.user.findUnique({
        where: { id: request.user.id },
      })

      if (!user) {
        // User was deleted but token still valid
        fastify.clearAuthCookie(reply)
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Not authenticated',
        })
      }

      const response: AuthResponse = {
        user: formatUser(user),
      }

      return reply.status(200).send(response)
    }
  )

  // POST /api/auth/verify-email
  fastify.post<{ Body: VerifyEmailRequest }>(
    '/api/auth/verify-email',
    async (request: FastifyRequest<{ Body: VerifyEmailRequest }>, reply: FastifyReply) => {
      const { token } = request.body

      if (!token) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Token is required',
        })
      }

      try {
        const { payload } = await jose.jwtVerify(token, secret)

        if (payload.purpose !== 'verify-email' || !payload.sub) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Invalid or expired verification token',
          })
        }

        // Update user's emailVerified status
        await fastify.prisma.user.update({
          where: { id: payload.sub },
          data: { emailVerified: true },
        })

        const response: MessageResponse = {
          success: true,
          message: 'Email verified successfully',
        }

        return reply.status(200).send(response)
      } catch {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid or expired verification token',
        })
      }
    }
  )

  // POST /api/auth/resend-verification
  fastify.post(
    '/api/auth/resend-verification',
    async (request: FastifyRequest, reply: FastifyReply) => {
      if (!request.user) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Not authenticated',
        })
      }

      const user = await fastify.prisma.user.findUnique({
        where: { id: request.user.id },
      })

      if (!user) {
        return reply.status(401).send({
          error: 'Unauthorized',
          message: 'Not authenticated',
        })
      }

      if (user.emailVerified) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Email is already verified',
        })
      }

      // Send verification email
      try {
        const verificationToken = await createVerificationToken(user.id, user.email, secret)
        const verifyUrl = `${appUrl}/verify-email?token=${encodeURIComponent(verificationToken)}`
        await sendEmail({
          to: user.email,
          subject: verifyEmailSubject(),
          html: verifyEmailHtml({ name: user.name, verifyUrl }),
        })
      } catch (emailError) {
        fastify.log.error(emailError, 'Failed to send verification email')
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to send verification email',
        })
      }

      const response: MessageResponse = {
        success: true,
        message: 'Verification email sent',
      }

      return reply.status(200).send(response)
    }
  )

  // POST /api/auth/forgot-password
  fastify.post<{ Body: ForgotPasswordRequest }>(
    '/api/auth/forgot-password',
    async (request: FastifyRequest<{ Body: ForgotPasswordRequest }>, reply: FastifyReply) => {
      const { email } = request.body

      if (!email) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Email is required',
        })
      }

      // Always return same response to prevent email enumeration
      const successResponse: MessageResponse = {
        success: true,
        message: 'If an account exists, a reset email has been sent',
      }

      const normalizedEmail = email.toLowerCase().trim()
      const user = await fastify.prisma.user.findUnique({
        where: { email: normalizedEmail },
      })

      if (!user) {
        return reply.status(200).send(successResponse)
      }

      // Invalidate any existing password reset tokens for this user
      await fastify.prisma.passwordReset.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      })

      // Create new password reset token
      const { token: resetToken, hash: tokenHash } = createPasswordResetToken()
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour

      await fastify.prisma.passwordReset.create({
        data: {
          token: tokenHash,
          expiresAt,
          userId: user.id,
        },
      })

      // Send password reset email
      try {
        const resetUrl = `${appUrl}/reset-password?token=${encodeURIComponent(resetToken)}`
        await sendEmail({
          to: user.email,
          subject: resetPasswordSubject(),
          html: resetPasswordHtml({ name: user.name, resetUrl }),
        })
      } catch (emailError) {
        fastify.log.error(emailError, 'Failed to send password reset email')
      }

      return reply.status(200).send(successResponse)
    }
  )

  // POST /api/auth/reset-password
  fastify.post<{ Body: ResetPasswordRequest }>(
    '/api/auth/reset-password',
    async (request: FastifyRequest<{ Body: ResetPasswordRequest }>, reply: FastifyReply) => {
      const { token, password } = request.body

      if (!token || !password) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Token and password are required',
        })
      }

      if (password.length < 8) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Password must be at least 8 characters',
        })
      }

      // Hash the provided token to compare with stored hash
      const tokenHash = crypto.createHash('sha256').update(token).digest('hex')

      // Find valid password reset token
      const passwordReset = await fastify.prisma.passwordReset.findFirst({
        where: {
          token: tokenHash,
          usedAt: null,
          expiresAt: {
            gt: new Date(),
          },
        },
        include: {
          user: true,
        },
      })

      if (!passwordReset) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid or expired reset token',
        })
      }

      // Mark token as used BEFORE updating password (prevent race conditions)
      await fastify.prisma.passwordReset.update({
        where: { id: passwordReset.id },
        data: { usedAt: new Date() },
      })

      // Hash new password and update user
      const passwordHash = await hash(password, ARGON2_OPTIONS)
      await fastify.prisma.user.update({
        where: { id: passwordReset.userId },
        data: { passwordHash },
      })

      const response: MessageResponse = {
        success: true,
        message: 'Password reset successfully',
      }

      return reply.status(200).send(response)
    }
  )
}
