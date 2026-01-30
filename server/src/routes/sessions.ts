import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import crypto from 'crypto'
import type {
  SessionStatus,
  SessionAccessType,
  SessionWithDetails,
  SessionListItem,
  SessionParticipantWithDetails,
  SessionInviteWithDetails,
  CreateSessionRequest,
  SessionResponse,
  SessionListResponse,
  JoinSessionRequest,
  SessionParticipantResponse,
  UpdateSessionRequest,
  WSTokenResponse,
  CharacterClass,
} from '@gygax/shared'
import { broadcastSessionUpdate, broadcastParticipantJoined, broadcastParticipantLeft } from '../websocket/handlers.js'
import { broadcastSessionEvent, broadcastSessionEnded, fetchSessionForBroadcast } from './sessionBrowseSSE.js'

const MAX_PLAYERS = 8

// Valid status transitions
const VALID_TRANSITIONS: Record<SessionStatus, SessionStatus[]> = {
  FORMING: ['ACTIVE', 'ENDED'],
  ACTIVE: ['PAUSED', 'FORMING', 'ENDED'],
  PAUSED: ['ACTIVE', 'FORMING', 'ENDED'],
  ENDED: [],
}

// WS token storage (in-memory, short-lived)
const wsTokens = new Map<string, { userId: string; sessionId: string; expiresAt: Date }>()

// Clean up expired tokens periodically
setInterval(() => {
  const now = new Date()
  for (const [token, data] of wsTokens) {
    if (data.expiresAt < now) {
      wsTokens.delete(token)
    }
  }
}, 60000) // Every minute

export function validateWsToken(token: string): { userId: string; sessionId: string } | null {
  const data = wsTokens.get(token)
  if (!data) return null
  if (data.expiresAt < new Date()) {
    wsTokens.delete(token)
    return null
  }
  // Single use - delete after validation
  wsTokens.delete(token)
  return { userId: data.userId, sessionId: data.sessionId }
}

function formatSessionParticipant(participant: {
  id: string
  sessionId: string
  userId: string
  characterId: string
  joinedAt: Date
  leftAt: Date | null
  user: { id: string; name: string; avatarUrl: string | null }
  character: {
    id: string
    name: string
    class: string
    level: number
    hitPointsCurrent: number
    hitPointsMax: number
    armorClass: number
    avatarUrl: string | null
  }
}): SessionParticipantWithDetails {
  return {
    id: participant.id,
    sessionId: participant.sessionId,
    userId: participant.userId,
    characterId: participant.characterId,
    joinedAt: participant.joinedAt.toISOString(),
    leftAt: participant.leftAt?.toISOString() ?? null,
    user: {
      id: participant.user.id,
      name: participant.user.name,
      avatarUrl: participant.user.avatarUrl,
    },
    character: {
      id: participant.character.id,
      name: participant.character.name,
      class: participant.character.class as CharacterClass,
      level: participant.character.level,
      hitPointsCurrent: participant.character.hitPointsCurrent,
      hitPointsMax: participant.character.hitPointsMax,
      armorClass: participant.character.armorClass,
      avatarUrl: participant.character.avatarUrl,
    },
  }
}

function formatSessionInvite(invite: {
  id: string
  sessionId: string
  userId: string | null
  email: string | null
  createdAt: Date
  acceptedAt: Date | null
  declinedAt: Date | null
  user: { id: string; name: string; email: string } | null
}): SessionInviteWithDetails {
  return {
    id: invite.id,
    sessionId: invite.sessionId,
    userId: invite.userId,
    email: invite.email,
    createdAt: invite.createdAt.toISOString(),
    acceptedAt: invite.acceptedAt?.toISOString() ?? null,
    declinedAt: invite.declinedAt?.toISOString() ?? null,
    user: invite.user
      ? {
          id: invite.user.id,
          name: invite.user.name,
          email: invite.user.email,
        }
      : null,
  }
}

function formatSessionWithDetails(session: {
  id: string
  status: string
  accessType: string
  adventureId: string
  dmId: string
  activeMapId: string | null
  activeBackdropId: string | null
  createdAt: Date
  updatedAt: Date
  startedAt: Date | null
  pausedAt: Date | null
  endedAt: Date | null
  adventure: { id: string; name: string }
  dm: { id: string; name: string; avatarUrl: string | null }
  participants: Array<{
    id: string
    sessionId: string
    userId: string
    characterId: string
    joinedAt: Date
    leftAt: Date | null
    user: { id: string; name: string; avatarUrl: string | null }
    character: {
      id: string
      name: string
      class: string
      level: number
      hitPointsCurrent: number
      hitPointsMax: number
      armorClass: number
      avatarUrl: string | null
    }
  }>
  invites: Array<{
    id: string
    sessionId: string
    userId: string | null
    email: string | null
    createdAt: Date
    acceptedAt: Date | null
    declinedAt: Date | null
    user: { id: string; name: string; email: string } | null
  }>
}): SessionWithDetails {
  return {
    id: session.id,
    status: session.status as SessionStatus,
    accessType: session.accessType as SessionAccessType,
    adventureId: session.adventureId,
    dmId: session.dmId,
    activeMapId: session.activeMapId,
    activeBackdropId: session.activeBackdropId,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    startedAt: session.startedAt?.toISOString() ?? null,
    pausedAt: session.pausedAt?.toISOString() ?? null,
    endedAt: session.endedAt?.toISOString() ?? null,
    adventure: {
      id: session.adventure.id,
      name: session.adventure.name,
    },
    dm: {
      id: session.dm.id,
      name: session.dm.name,
      avatarUrl: session.dm.avatarUrl,
    },
    participants: session.participants
      .filter((p) => p.leftAt === null)
      .map(formatSessionParticipant),
    invites: session.invites.map(formatSessionInvite),
  }
}

function formatSessionListItem(session: {
  id: string
  status: string
  accessType: string
  adventureId: string
  createdAt: Date
  adventure: { id: string; name: string }
  dm: { id: string; name: string; avatarUrl: string | null }
  _count: { participants: number }
}): SessionListItem {
  return {
    id: session.id,
    status: session.status as SessionStatus,
    accessType: session.accessType as SessionAccessType,
    adventureId: session.adventureId,
    createdAt: session.createdAt.toISOString(),
    adventure: {
      id: session.adventure.id,
      name: session.adventure.name,
    },
    dm: {
      id: session.dm.id,
      name: session.dm.name,
      avatarUrl: session.dm.avatarUrl,
    },
    participantCount: session._count.participants,
  }
}

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

export async function sessionRoutes(fastify: FastifyInstance) {
  // POST /api/adventures/:adventureId/sessions - Create a new session
  fastify.post<{ Params: { adventureId: string }; Body: CreateSessionRequest }>(
    '/api/adventures/:adventureId/sessions',
    async (
      request: FastifyRequest<{ Params: { adventureId: string }; Body: CreateSessionRequest }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { adventureId } = request.params
      const { accessType = 'OPEN' } = request.body || {}

      // Validate access type
      if (!['OPEN', 'CAMPAIGN', 'INVITE'].includes(accessType)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid access type. Must be OPEN, CAMPAIGN, or INVITE',
        })
      }

      // Verify adventure exists and user owns it
      const adventure = await fastify.prisma.adventure.findUnique({
        where: { id: adventureId },
      })

      if (!adventure) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Adventure not found',
        })
      }

      if (adventure.ownerId !== user.id) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Not authorized to create sessions for this adventure',
        })
      }

      // Check for existing forming/active/paused session
      const existingSession = await fastify.prisma.session.findFirst({
        where: {
          adventureId,
          status: { in: ['FORMING', 'ACTIVE', 'PAUSED'] },
        },
      })

      if (existingSession) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'Adventure already has an active session',
        })
      }

      // Create session
      const session = await fastify.prisma.session.create({
        data: {
          adventureId,
          dmId: user.id,
          accessType: accessType as 'OPEN' | 'CAMPAIGN' | 'INVITE',
        },
        include: {
          adventure: { select: { id: true, name: true } },
          dm: { select: { id: true, name: true, avatarUrl: true } },
          participants: {
            where: { leftAt: null },
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
              character: {
                select: {
                  id: true,
                  name: true,
                  class: true,
                  level: true,
                  hitPointsCurrent: true,
                  hitPointsMax: true,
                  armorClass: true,
                  avatarUrl: true,
                },
              },
            },
          },
          invites: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      })

      // Broadcast to SSE clients that a new session is available
      const sessionForBroadcast = await fetchSessionForBroadcast(fastify.prisma, session.id)
      if (sessionForBroadcast) {
        broadcastSessionEvent('session:created', sessionForBroadcast)
      }

      const response: SessionResponse = {
        session: formatSessionWithDetails(session),
      }

      return reply.status(201).send(response)
    }
  )

  // GET /api/sessions - List sessions
  fastify.get<{ Querystring: { adventureId?: string; status?: string; browse?: string } }>(
    '/api/sessions',
    async (
      request: FastifyRequest<{
        Querystring: { adventureId?: string; status?: string; browse?: string }
      }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { adventureId, status, browse } = request.query
      const isBrowse = browse === 'true'

      if (isBrowse) {
        // Player browse view - return joinable sessions based on access
        // Get user's campaign memberships
        const campaignMemberships = await fastify.prisma.campaignMember.findMany({
          where: { userId: user.id },
          select: { campaignId: true },
        })
        const memberCampaignIds = campaignMemberships.map((m) => m.campaignId)

        // Get user's session invites
        const invites = await fastify.prisma.sessionInvite.findMany({
          where: {
            OR: [{ userId: user.id }, { email: user.email }],
          },
          select: { sessionId: true },
        })
        const invitedSessionIds = invites.map((i) => i.sessionId)

        // Query for joinable sessions
        const sessions = await fastify.prisma.session.findMany({
          where: {
            // Not the DM
            dmId: { not: user.id },
            // Not already a participant (or has left)
            NOT: {
              participants: {
                some: {
                  userId: user.id,
                  leftAt: null,
                },
              },
            },
            OR: [
              // OPEN sessions: only FORMING
              { accessType: 'OPEN', status: 'FORMING' },
              // CAMPAIGN sessions: FORMING or ACTIVE, must be member
              {
                accessType: 'CAMPAIGN',
                status: { in: ['FORMING', 'ACTIVE'] },
                adventure: { campaignId: { in: memberCampaignIds } },
              },
              // INVITE sessions: FORMING or ACTIVE, must be invited
              {
                accessType: 'INVITE',
                status: { in: ['FORMING', 'ACTIVE'] },
                id: { in: invitedSessionIds },
              },
            ],
          },
          include: {
            adventure: { select: { id: true, name: true } },
            dm: { select: { id: true, name: true, avatarUrl: true } },
            _count: { select: { participants: { where: { leftAt: null } } } },
          },
          orderBy: { createdAt: 'desc' },
        })

        // Sort by access type priority: INVITE > CAMPAIGN > OPEN
        const accessOrder: Record<string, number> = { INVITE: 0, CAMPAIGN: 1, OPEN: 2 }
        sessions.sort((a, b) => accessOrder[a.accessType] - accessOrder[b.accessType])

        const response: SessionListResponse = {
          sessions: sessions.map(formatSessionListItem),
        }

        return reply.status(200).send(response)
      }

      // DM view - filter by adventureId
      if (adventureId) {
        // Verify ownership
        const adventure = await fastify.prisma.adventure.findUnique({
          where: { id: adventureId },
        })

        if (!adventure) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'Adventure not found',
          })
        }

        if (adventure.ownerId !== user.id) {
          return reply.status(403).send({
            error: 'Forbidden',
            message: 'Not authorized to view sessions for this adventure',
          })
        }

        const whereClause: { adventureId: string; status?: string } = { adventureId }
        if (status && ['FORMING', 'ACTIVE', 'PAUSED', 'ENDED'].includes(status)) {
          whereClause.status = status
        }

        const sessions = await fastify.prisma.session.findMany({
          where: whereClause,
          include: {
            adventure: { select: { id: true, name: true } },
            dm: { select: { id: true, name: true, avatarUrl: true } },
            _count: { select: { participants: { where: { leftAt: null } } } },
          },
          orderBy: { createdAt: 'desc' },
        })

        const response: SessionListResponse = {
          sessions: sessions.map(formatSessionListItem),
        }

        return reply.status(200).send(response)
      }

      // Default: return all sessions the user is DM of
      const sessions = await fastify.prisma.session.findMany({
        where: { dmId: user.id },
        include: {
          adventure: { select: { id: true, name: true } },
          dm: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { participants: { where: { leftAt: null } } } },
        },
        orderBy: { createdAt: 'desc' },
      })

      const response: SessionListResponse = {
        sessions: sessions.map(formatSessionListItem),
      }

      return reply.status(200).send(response)
    }
  )

  // GET /api/sessions/:id - Get single session
  fastify.get<{ Params: { id: string } }>(
    '/api/sessions/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const session = await fastify.prisma.session.findUnique({
        where: { id },
        include: {
          adventure: { select: { id: true, name: true } },
          dm: { select: { id: true, name: true, avatarUrl: true } },
          participants: {
            where: { leftAt: null },
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
              character: {
                select: {
                  id: true,
                  name: true,
                  class: true,
                  level: true,
                  hitPointsCurrent: true,
                  hitPointsMax: true,
                  armorClass: true,
                  avatarUrl: true,
                },
              },
            },
          },
          invites: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      })

      if (!session) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Session not found',
        })
      }

      // Check authorization: must be DM or participant
      const isParticipant = session.participants.some((p) => p.userId === user.id)
      if (session.dmId !== user.id && !isParticipant) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Not authorized to view this session',
        })
      }

      const response: SessionResponse = {
        session: formatSessionWithDetails(session),
      }

      return reply.status(200).send(response)
    }
  )

  // POST /api/sessions/:id/join - Join a session
  fastify.post<{ Params: { id: string }; Body: JoinSessionRequest }>(
    '/api/sessions/:id/join',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: JoinSessionRequest }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params
      const { characterId } = request.body || {}

      if (!characterId) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'characterId is required',
        })
      }

      const session = await fastify.prisma.session.findUnique({
        where: { id },
        include: {
          adventure: { select: { campaignId: true } },
          participants: { where: { leftAt: null } },
          invites: true,
        },
      })

      if (!session) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Session not found',
        })
      }

      // Cannot join own session as player
      if (session.dmId === user.id) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Cannot join your own session as a player',
        })
      }

      // Check session capacity (only count active participants)
      if (session.participants.length >= MAX_PLAYERS) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'Session is full',
        })
      }

      // Check joinable state based on access type
      const isFormingOrActive = ['FORMING', 'ACTIVE'].includes(session.status)
      const isForming = session.status === 'FORMING'

      if (!isFormingOrActive || session.status === 'PAUSED' || session.status === 'ENDED') {
        return reply.status(410).send({
          error: 'Gone',
          message: 'Session is not accepting new players',
        })
      }

      // Check access based on access type
      if (session.accessType === 'OPEN') {
        // OPEN: only FORMING
        if (!isForming) {
          return reply.status(410).send({
            error: 'Gone',
            message: 'Open sessions can only be joined during the forming phase',
          })
        }
      } else if (session.accessType === 'CAMPAIGN') {
        // CAMPAIGN: must be a member of the adventure's campaign
        if (!session.adventure.campaignId) {
          return reply.status(403).send({
            error: 'Forbidden',
            message: 'Session access denied',
          })
        }

        const membership = await fastify.prisma.campaignMember.findUnique({
          where: {
            campaignId_userId: {
              campaignId: session.adventure.campaignId,
              userId: user.id,
            },
          },
        })

        if (!membership) {
          return reply.status(403).send({
            error: 'Forbidden',
            message: 'Not a member of this campaign',
          })
        }
      } else if (session.accessType === 'INVITE') {
        // INVITE: must have an invite
        const invite = session.invites.find(
          (i) => i.userId === user.id || i.email === user.email
        )

        if (!invite) {
          return reply.status(403).send({
            error: 'Forbidden',
            message: 'Not invited to this session',
          })
        }
      }

      // Verify character exists and is owned by user
      const character = await fastify.prisma.character.findUnique({
        where: { id: characterId },
      })

      if (!character) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Character not found',
        })
      }

      if (character.ownerId !== user.id) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Character does not belong to you',
        })
      }

      // Check if user has an existing participant record (including those who left)
      const existingRecord = await fastify.prisma.sessionParticipant.findUnique({
        where: {
          sessionId_userId: {
            sessionId: id,
            userId: user.id,
          },
        },
      })

      let participant

      if (existingRecord) {
        if (!existingRecord.leftAt) {
          // Already an active participant
          return reply.status(409).send({
            error: 'Conflict',
            message: 'Already a participant in this session',
          })
        }

        // Reactivate by clearing leftAt and updating character/joinedAt
        participant = await fastify.prisma.sessionParticipant.update({
          where: { id: existingRecord.id },
          data: {
            characterId,
            joinedAt: new Date(),
            leftAt: null,
          },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
            character: {
              select: {
                id: true,
                name: true,
                class: true,
                level: true,
                hitPointsCurrent: true,
                hitPointsMax: true,
                armorClass: true,
                avatarUrl: true,
              },
            },
          },
        })
      } else {
        // Create new participant
        participant = await fastify.prisma.sessionParticipant.create({
          data: {
            sessionId: id,
            userId: user.id,
            characterId,
          },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
            character: {
              select: {
                id: true,
                name: true,
                class: true,
                level: true,
                hitPointsCurrent: true,
                hitPointsMax: true,
                armorClass: true,
                avatarUrl: true,
              },
            },
          },
        })
      }

      // Update invite acceptedAt if exists
      const invite = session.invites.find(
        (i) => i.userId === user.id || i.email === user.email
      )
      if (invite) {
        await fastify.prisma.sessionInvite.update({
          where: { id: invite.id },
          data: { acceptedAt: new Date() },
        })
      }

      // Broadcast participant joined to all connected WebSocket clients
      broadcastParticipantJoined(id, formatSessionParticipant(participant))

      // Broadcast to SSE clients for browse list participant count update
      const sessionForBroadcast = await fetchSessionForBroadcast(fastify.prisma, id)
      if (sessionForBroadcast) {
        broadcastSessionEvent('session:updated', sessionForBroadcast)
      }

      const response: SessionParticipantResponse = {
        participant: formatSessionParticipant(participant),
      }

      return reply.status(200).send(response)
    }
  )

  // POST /api/sessions/:id/leave - Leave a session
  fastify.post<{ Params: { id: string } }>(
    '/api/sessions/:id/leave',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const session = await fastify.prisma.session.findUnique({
        where: { id },
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

      const participant = session.participants[0]
      if (!participant) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Not a participant of this session',
        })
      }

      // Soft delete - set leftAt
      await fastify.prisma.sessionParticipant.update({
        where: { id: participant.id },
        data: { leftAt: new Date() },
      })

      // Broadcast participant left to all connected WebSocket clients
      broadcastParticipantLeft(id, user.id)

      // Broadcast to SSE clients for browse list participant count update
      const sessionForBroadcast = await fetchSessionForBroadcast(fastify.prisma, id)
      if (sessionForBroadcast) {
        broadcastSessionEvent('session:updated', sessionForBroadcast)
      }

      return reply.status(200).send({ success: true })
    }
  )

  // PATCH /api/sessions/:id - Update session status
  fastify.patch<{ Params: { id: string }; Body: UpdateSessionRequest }>(
    '/api/sessions/:id',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateSessionRequest }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params
      const { status } = request.body || {}

      const session = await fastify.prisma.session.findUnique({
        where: { id },
      })

      if (!session) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Session not found',
        })
      }

      if (session.dmId !== user.id) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Only the DM can update session status',
        })
      }

      if (!status) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'status is required',
        })
      }

      // Validate transition
      const currentStatus = session.status as SessionStatus
      const newStatus = status as SessionStatus
      const validTransitions = VALID_TRANSITIONS[currentStatus]

      if (!validTransitions.includes(newStatus)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Cannot transition from ${currentStatus} to ${newStatus}`,
        })
      }

      // Build update data
      const updateData: {
        status: string
        startedAt?: Date | null
        pausedAt?: Date | null
        endedAt?: Date | null
      } = { status: newStatus }

      if (currentStatus === 'FORMING' && newStatus === 'ACTIVE') {
        updateData.startedAt = new Date()
      } else if (newStatus === 'FORMING') {
        updateData.startedAt = null
        updateData.pausedAt = null
      } else if (currentStatus === 'ACTIVE' && newStatus === 'PAUSED') {
        updateData.pausedAt = new Date()
      } else if (currentStatus === 'PAUSED' && newStatus === 'ACTIVE') {
        updateData.pausedAt = null
      } else if (newStatus === 'ENDED') {
        updateData.endedAt = new Date()
      }

      const updatedSession = await fastify.prisma.session.update({
        where: { id },
        data: updateData,
        include: {
          adventure: { select: { id: true, name: true } },
          dm: { select: { id: true, name: true, avatarUrl: true } },
          participants: {
            where: { leftAt: null },
            include: {
              user: { select: { id: true, name: true, avatarUrl: true } },
              character: {
                select: {
                  id: true,
                  name: true,
                  class: true,
                  level: true,
                  hitPointsCurrent: true,
                  hitPointsMax: true,
                  armorClass: true,
                  avatarUrl: true,
                },
              },
            },
          },
          invites: {
            include: {
              user: { select: { id: true, name: true, email: true } },
            },
          },
        },
      })

      // Broadcast update to all connected WebSocket clients
      broadcastSessionUpdate(id, {
        status: updatedSession.status as SessionStatus,
        activeMapId: updatedSession.activeMapId,
        activeBackdropId: updatedSession.activeBackdropId,
        pausedAt: updatedSession.pausedAt?.toISOString() ?? null,
        endedAt: updatedSession.endedAt?.toISOString() ?? null,
      })

      // Broadcast to SSE clients for browse list updates
      if (newStatus === 'ENDED') {
        broadcastSessionEnded(id)
      } else {
        const sessionForBroadcast = await fetchSessionForBroadcast(fastify.prisma, id)
        if (sessionForBroadcast) {
          broadcastSessionEvent('session:updated', sessionForBroadcast)
        }
      }

      const response: SessionResponse = {
        session: formatSessionWithDetails(updatedSession),
      }

      return reply.status(200).send(response)
    }
  )

  // DELETE /api/sessions/:id - Delete an ended session
  fastify.delete<{ Params: { id: string } }>(
    '/api/sessions/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const session = await fastify.prisma.session.findUnique({
        where: { id },
      })

      if (!session) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Session not found',
        })
      }

      if (session.dmId !== user.id) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Only the DM can delete a session',
        })
      }

      if (session.status !== 'ENDED') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Only ended sessions can be deleted',
        })
      }

      await fastify.prisma.session.delete({
        where: { id },
      })

      return reply.status(200).send({ success: true })
    }
  )

  // POST /api/sessions/:id/ws-token - Get WebSocket auth token
  fastify.post<{ Params: { id: string } }>(
    '/api/sessions/:id/ws-token',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const session = await fastify.prisma.session.findUnique({
        where: { id },
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

      // Must be DM or participant
      const isParticipant = session.participants.length > 0
      if (session.dmId !== user.id && !isParticipant) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Not authorized to connect to this session',
        })
      }

      // Generate token
      const token = crypto.randomBytes(32).toString('base64url')
      const expiresAt = new Date(Date.now() + 30 * 1000) // 30 seconds

      wsTokens.set(token, {
        userId: user.id,
        sessionId: id,
        expiresAt,
      })

      const response: WSTokenResponse = { token }

      return reply.status(200).send(response)
    }
  )
}
