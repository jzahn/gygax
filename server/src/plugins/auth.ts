import fp from 'fastify-plugin'
import cookie from '@fastify/cookie'
import * as jose from 'jose'
import type { FastifyInstance, FastifyRequest } from 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    user: { id: string; email: string } | null
  }
}

const AUTH_COOKIE_NAME = 'auth_token'

export const authPlugin = fp(async (fastify: FastifyInstance) => {
  const jwtSecret = process.env.JWT_SECRET
  if (!jwtSecret) {
    throw new Error('JWT_SECRET environment variable is required')
  }
  if (jwtSecret.length < 32) {
    throw new Error('JWT_SECRET must be at least 32 characters')
  }

  const secret = new TextEncoder().encode(jwtSecret)

  // Register cookie plugin
  await fastify.register(cookie)

  // Decorate request with user
  fastify.decorateRequest('user', null)

  // Add hook to verify JWT on all requests
  fastify.addHook('onRequest', async (request: FastifyRequest) => {
    request.user = null

    const token = request.cookies[AUTH_COOKIE_NAME]
    if (!token) {
      return
    }

    try {
      const { payload } = await jose.jwtVerify(token, secret)
      if (payload.sub && typeof payload.email === 'string') {
        request.user = {
          id: payload.sub,
          email: payload.email,
        }
      }
    } catch {
      // Invalid token, user remains null
    }
  })

  // Helper to create JWT
  fastify.decorate('createAuthToken', async (userId: string, email: string) => {
    return await new jose.SignJWT({ sub: userId, email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(secret)
  })

  // Helper to set auth cookie
  fastify.decorate('setAuthCookie', (reply: FastifyReply, token: string) => {
    reply.setCookie(AUTH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days in seconds
    })
  })

  // Helper to clear auth cookie
  fastify.decorate('clearAuthCookie', (reply: FastifyReply) => {
    reply.clearCookie(AUTH_COOKIE_NAME, {
      path: '/',
    })
  })
})

// Type declarations for fastify instance decorations
declare module 'fastify' {
  interface FastifyInstance {
    createAuthToken: (userId: string, email: string) => Promise<string>
    setAuthCookie: (reply: FastifyReply, token: string) => void
    clearAuthCookie: (reply: FastifyReply) => void
  }
}

// Re-export for use in routes
import type { FastifyReply } from 'fastify'
