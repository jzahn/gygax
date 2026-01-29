import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import type {
  SessionInviteWithDetails,
  SessionInvitesResponse,
  SessionInviteResponse,
  CreateSessionInviteRequest,
} from '@gygax/shared'

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

export async function sessionInviteRoutes(fastify: FastifyInstance) {
  // GET /api/sessions/:sessionId/invites - List session invites
  fastify.get<{ Params: { sessionId: string } }>(
    '/api/sessions/:sessionId/invites',
    async (request: FastifyRequest<{ Params: { sessionId: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { sessionId } = request.params

      const session = await fastify.prisma.session.findUnique({
        where: { id: sessionId },
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
          message: 'Only the DM can view session invites',
        })
      }

      const invites = await fastify.prisma.sessionInvite.findMany({
        where: { sessionId },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: 'asc' },
      })

      const response: SessionInvitesResponse = {
        invites: invites.map(formatSessionInvite),
      }

      return reply.status(200).send(response)
    }
  )

  // POST /api/sessions/:sessionId/invites - Create invite
  fastify.post<{ Params: { sessionId: string }; Body: CreateSessionInviteRequest }>(
    '/api/sessions/:sessionId/invites',
    async (
      request: FastifyRequest<{ Params: { sessionId: string }; Body: CreateSessionInviteRequest }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { sessionId } = request.params
      const { email, userId } = request.body || {}

      if (!email && !userId) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Either email or userId is required',
        })
      }

      const session = await fastify.prisma.session.findUnique({
        where: { id: sessionId },
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
          message: 'Only the DM can invite players',
        })
      }

      if (session.accessType !== 'INVITE') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Can only create invites for INVITE-type sessions',
        })
      }

      // If userId provided, verify user exists
      let targetUser: { id: string; name: string; email: string } | null = null
      let inviteEmail: string | null = null

      if (userId) {
        targetUser = await fastify.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, email: true },
        })

        if (!targetUser) {
          return reply.status(404).send({
            error: 'Not Found',
            message: 'User not found',
          })
        }

        // Cannot invite the DM
        if (targetUser.id === session.dmId) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Cannot invite yourself to your own session',
          })
        }

        // Check if already invited by userId
        const existingInvite = await fastify.prisma.sessionInvite.findUnique({
          where: {
            sessionId_userId: {
              sessionId,
              userId: targetUser.id,
            },
          },
        })

        if (existingInvite) {
          return reply.status(409).send({
            error: 'Conflict',
            message: 'User is already invited to this session',
          })
        }
      } else if (email) {
        // Check if user exists with this email
        targetUser = await fastify.prisma.user.findUnique({
          where: { email },
          select: { id: true, name: true, email: true },
        })

        if (targetUser) {
          // Cannot invite the DM
          if (targetUser.id === session.dmId) {
            return reply.status(400).send({
              error: 'Bad Request',
              message: 'Cannot invite yourself to your own session',
            })
          }

          // Check if already invited by userId
          const existingInvite = await fastify.prisma.sessionInvite.findUnique({
            where: {
              sessionId_userId: {
                sessionId,
                userId: targetUser.id,
              },
            },
          })

          if (existingInvite) {
            return reply.status(409).send({
              error: 'Conflict',
              message: 'User is already invited to this session',
            })
          }
        } else {
          // User doesn't exist, invite by email
          inviteEmail = email

          // Check if already invited by email
          const existingInvite = await fastify.prisma.sessionInvite.findUnique({
            where: {
              sessionId_email: {
                sessionId,
                email: inviteEmail,
              },
            },
          })

          if (existingInvite) {
            return reply.status(409).send({
              error: 'Conflict',
              message: 'This email is already invited to this session',
            })
          }
        }
      }

      // Create invite
      const invite = await fastify.prisma.sessionInvite.create({
        data: {
          sessionId,
          userId: targetUser?.id ?? null,
          email: inviteEmail,
        },
        include: {
          user: { select: { id: true, name: true, email: true } },
        },
      })

      const response: SessionInviteResponse = {
        invite: formatSessionInvite(invite),
      }

      return reply.status(201).send(response)
    }
  )

  // DELETE /api/sessions/:sessionId/invites/:inviteId - Remove invite
  fastify.delete<{ Params: { sessionId: string; inviteId: string } }>(
    '/api/sessions/:sessionId/invites/:inviteId',
    async (
      request: FastifyRequest<{ Params: { sessionId: string; inviteId: string } }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { sessionId, inviteId } = request.params

      const session = await fastify.prisma.session.findUnique({
        where: { id: sessionId },
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
          message: 'Only the DM can remove invites',
        })
      }

      const invite = await fastify.prisma.sessionInvite.findUnique({
        where: { id: inviteId },
      })

      if (!invite || invite.sessionId !== sessionId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Invite not found',
        })
      }

      await fastify.prisma.sessionInvite.delete({
        where: { id: inviteId },
      })

      return reply.status(200).send({ success: true })
    }
  )
}
