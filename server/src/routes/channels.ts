import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import type {
  ChatChannelListResponse,
  ChatChannelResponse,
  CreateChatChannelRequest,
  ChatMessageListResponse,
} from '@gygax/shared'
import {
  getChannelsForUser,
  createChannel,
  getMessages,
  markChannelRead,
  isChannelParticipant,
  getChannelById,
  formatChannel,
} from '../services/chatService.js'
import { broadcastChannelCreated } from '../websocket/chatHandler.js'

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

export async function channelRoutes(fastify: FastifyInstance) {
  // GET /api/sessions/:id/channels - List channels for a session
  fastify.get<{ Params: { id: string } }>(
    '/api/sessions/:id/channels',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id: sessionId } = request.params

      // Verify session exists
      const session = await fastify.prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          participants: { where: { leftAt: null }, select: { userId: true } },
        },
      })

      if (!session) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Session not found',
        })
      }

      // Must be DM or participant
      const isDm = session.dmId === user.id
      const isParticipant = session.participants.some((p) => p.userId === user.id)

      if (!isDm && !isParticipant) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Not a participant of this session',
        })
      }

      const channels = await getChannelsForUser(fastify.prisma, sessionId, user.id)

      const response: ChatChannelListResponse = { channels }
      return reply.status(200).send(response)
    }
  )

  // POST /api/sessions/:id/channels - Create a new channel
  fastify.post<{ Params: { id: string }; Body: CreateChatChannelRequest }>(
    '/api/sessions/:id/channels',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: CreateChatChannelRequest }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id: sessionId } = request.params
      const { participantIds, name } = request.body || {}

      if (!participantIds || !Array.isArray(participantIds) || participantIds.length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'participantIds is required and must be a non-empty array',
        })
      }

      // Verify session exists and user is a participant
      const session = await fastify.prisma.session.findUnique({
        where: { id: sessionId },
        include: {
          participants: { where: { leftAt: null }, select: { userId: true } },
        },
      })

      if (!session) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Session not found',
        })
      }

      // Must be DM or participant
      const isDm = session.dmId === user.id
      const isParticipant = session.participants.some((p) => p.userId === user.id)

      if (!isDm && !isParticipant) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Not a participant of this session',
        })
      }

      // Verify all participant IDs are valid session members (DM or participants)
      const validUserIds = new Set([session.dmId, ...session.participants.map((p) => p.userId)])
      const invalidIds = participantIds.filter((id) => !validUserIds.has(id))

      if (invalidIds.length > 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Some participant IDs are not members of this session',
        })
      }

      // Cannot create a channel with only yourself
      const allParticipants = new Set([user.id, ...participantIds])
      if (allParticipants.size < 2) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Cannot create a channel with only yourself',
        })
      }

      const channel = await createChannel(
        fastify.prisma,
        sessionId,
        user.id,
        participantIds,
        name
      )

      // Get the full channel with participants
      const fullChannel = await fastify.prisma.chatChannel.findUnique({
        where: { id: channel.id },
        include: {
          participants: {
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
        },
      })

      if (!fullChannel) {
        return reply.status(500).send({
          error: 'Internal Server Error',
          message: 'Failed to create channel',
        })
      }

      const formattedChannel = await formatChannel(fastify.prisma, fullChannel, user.id)

      // Broadcast to all channel participants via WebSocket
      broadcastChannelCreated(sessionId, fullChannel.participants.map((p) => p.userId), formattedChannel)

      const response: ChatChannelResponse = { channel: formattedChannel }
      return reply.status(201).send(response)
    }
  )

  // GET /api/channels/:id/messages - Get messages for a channel
  fastify.get<{ Params: { id: string }; Querystring: { before?: string; limit?: string } }>(
    '/api/channels/:id/messages',
    async (
      request: FastifyRequest<{
        Params: { id: string }
        Querystring: { before?: string; limit?: string }
      }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id: channelId } = request.params
      const { before, limit } = request.query

      // Verify channel exists
      const channel = await getChannelById(fastify.prisma, channelId)

      if (!channel) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Channel not found',
        })
      }

      // Must be a participant
      const isParticipant = await isChannelParticipant(fastify.prisma, channelId, user.id)

      if (!isParticipant) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Not a participant of this channel',
        })
      }

      const result = await getMessages(fastify.prisma, channelId, {
        before,
        limit: limit ? parseInt(limit, 10) : undefined,
      })

      const response: ChatMessageListResponse = result
      return reply.status(200).send(response)
    }
  )

  // PATCH /api/channels/:id/read - Mark channel as read
  fastify.patch<{ Params: { id: string } }>(
    '/api/channels/:id/read',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id: channelId } = request.params

      // Verify channel exists
      const channel = await getChannelById(fastify.prisma, channelId)

      if (!channel) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Channel not found',
        })
      }

      // Must be a participant
      const isParticipant = await isChannelParticipant(fastify.prisma, channelId, user.id)

      if (!isParticipant) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Not a participant of this channel',
        })
      }

      await markChannelRead(fastify.prisma, channelId, user.id)

      return reply.status(204).send()
    }
  )
}
