import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import { hash, verify } from '@node-rs/argon2'
import type {
  RegisterRequest,
  LoginRequest,
  AuthResponse,
  LogoutResponse,
  User,
} from '@gygax/shared'

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
  createdAt: Date
}): User {
  return {
    id: user.id,
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  }
}

export async function authRoutes(fastify: FastifyInstance) {
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
        },
      })

      // Create and set auth token
      const token = await fastify.createAuthToken(user.id, user.email)
      fastify.setAuthCookie(reply, token)

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
}
