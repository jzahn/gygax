import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import type { FogStateResponse, TokenListResponse } from '@gygax/shared'
import { getFogState } from '../services/fogService.js'
import { getTokensForMap } from '../services/tokenService.js'

async function requireVerifiedUser(
  fastify: FastifyInstance,
  request: FastifyRequest,
  reply: FastifyReply
): Promise<{ id: string; email: string; emailVerified: boolean } | null> {
  if (!request.user) {
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'Not authenticated',
    })
    return null
  }

  const user = await fastify.prisma.user.findUnique({
    where: { id: request.user.id },
    select: { id: true, email: true, emailVerified: true },
  })

  if (!user) {
    reply.status(401).send({
      error: 'Unauthorized',
      message: 'Not authenticated',
    })
    return null
  }

  if (!user.emailVerified) {
    reply.status(403).send({
      error: 'Forbidden',
      message: 'Email not verified',
    })
    return null
  }

  return user
}

export async function sessionMapsRoutes(fastify: FastifyInstance) {
  // GET /api/sessions/:sessionId/maps/:mapId/fog - Get fog state for a map
  fastify.get<{ Params: { sessionId: string; mapId: string } }>(
    '/api/sessions/:sessionId/maps/:mapId/fog',
    async (
      request: FastifyRequest<{ Params: { sessionId: string; mapId: string } }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { sessionId, mapId } = request.params

      // Check session exists and user has access
      const session = await fastify.prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          participants: { where: { userId: user.id, leftAt: null } },
        },
      })

      if (!session) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Session not found',
        })
      }

      // Must be DM or active participant
      const isParticipant = session.participants.length > 0
      if (session.dmId !== user.id && !isParticipant) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Not authorized to view session data',
        })
      }

      // Get fog state
      const fogState = await getFogState(fastify.prisma, sessionId, mapId)

      const response: FogStateResponse = {
        revealedCells: fogState.revealedCells,
      }

      return reply.status(200).send(response)
    }
  )

  // GET /api/sessions/:sessionId/maps/:mapId/tokens - Get tokens for a map
  fastify.get<{ Params: { sessionId: string; mapId: string } }>(
    '/api/sessions/:sessionId/maps/:mapId/tokens',
    async (
      request: FastifyRequest<{ Params: { sessionId: string; mapId: string } }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { sessionId, mapId } = request.params

      // Check session exists and user has access
      const session = await fastify.prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          participants: { where: { userId: user.id, leftAt: null } },
        },
      })

      if (!session) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Session not found',
        })
      }

      // Must be DM or active participant
      const isParticipant = session.participants.length > 0
      if (session.dmId !== user.id && !isParticipant) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Not authorized to view session data',
        })
      }

      // Get tokens
      const tokens = await getTokensForMap(fastify.prisma, sessionId, mapId)

      const response: TokenListResponse = {
        tokens,
      }

      return reply.status(200).send(response)
    }
  )
}
