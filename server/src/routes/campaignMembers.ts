import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import type {
  CampaignMemberWithDetails,
  CampaignMembersResponse,
  CampaignMemberResponse,
  AddCampaignMemberRequest,
} from '@gygax/shared'

function formatCampaignMember(member: {
  id: string
  campaignId: string
  userId: string
  joinedAt: Date
  user: { id: string; name: string; email: string; avatarUrl: string | null }
}): CampaignMemberWithDetails {
  return {
    id: member.id,
    campaignId: member.campaignId,
    userId: member.userId,
    joinedAt: member.joinedAt.toISOString(),
    user: {
      id: member.user.id,
      name: member.user.name,
      email: member.user.email,
      avatarUrl: member.user.avatarUrl,
    },
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

export async function campaignMemberRoutes(fastify: FastifyInstance) {
  // GET /api/campaigns/:campaignId/members - List campaign members
  fastify.get<{ Params: { campaignId: string } }>(
    '/api/campaigns/:campaignId/members',
    async (request: FastifyRequest<{ Params: { campaignId: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { campaignId } = request.params

      const campaign = await fastify.prisma.campaign.findUnique({
        where: { id: campaignId },
      })

      if (!campaign) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Campaign not found',
        })
      }

      if (campaign.ownerId !== user.id) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Not authorized to view campaign members',
        })
      }

      const members = await fastify.prisma.campaignMember.findMany({
        where: { campaignId },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
        orderBy: { joinedAt: 'asc' },
      })

      const response: CampaignMembersResponse = {
        members: members.map(formatCampaignMember),
      }

      return reply.status(200).send(response)
    }
  )

  // POST /api/campaigns/:campaignId/members - Add member
  fastify.post<{ Params: { campaignId: string }; Body: AddCampaignMemberRequest }>(
    '/api/campaigns/:campaignId/members',
    async (
      request: FastifyRequest<{ Params: { campaignId: string }; Body: AddCampaignMemberRequest }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { campaignId } = request.params
      const { email, userId } = request.body || {}

      if (!email && !userId) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Either email or userId is required',
        })
      }

      const campaign = await fastify.prisma.campaign.findUnique({
        where: { id: campaignId },
      })

      if (!campaign) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Campaign not found',
        })
      }

      if (campaign.ownerId !== user.id) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Not authorized to add members to this campaign',
        })
      }

      // Find the user to add
      let targetUser: { id: string; name: string; email: string; avatarUrl: string | null } | null = null

      if (userId) {
        targetUser = await fastify.prisma.user.findUnique({
          where: { id: userId },
          select: { id: true, name: true, email: true, avatarUrl: true },
        })
      } else if (email) {
        targetUser = await fastify.prisma.user.findUnique({
          where: { email },
          select: { id: true, name: true, email: true, avatarUrl: true },
        })
      }

      if (!targetUser) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'User not found',
        })
      }

      // Cannot add campaign owner as member
      if (targetUser.id === campaign.ownerId) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Cannot add campaign owner as a member',
        })
      }

      // Check if already a member
      const existingMember = await fastify.prisma.campaignMember.findUnique({
        where: {
          campaignId_userId: {
            campaignId,
            userId: targetUser.id,
          },
        },
      })

      if (existingMember) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'User is already a member of this campaign',
        })
      }

      // Create membership
      const member = await fastify.prisma.campaignMember.create({
        data: {
          campaignId,
          userId: targetUser.id,
        },
        include: {
          user: { select: { id: true, name: true, email: true, avatarUrl: true } },
        },
      })

      const response: CampaignMemberResponse = {
        member: formatCampaignMember(member),
      }

      return reply.status(201).send(response)
    }
  )

  // DELETE /api/campaigns/:campaignId/members/:userId - Remove member
  fastify.delete<{ Params: { campaignId: string; userId: string } }>(
    '/api/campaigns/:campaignId/members/:userId',
    async (
      request: FastifyRequest<{ Params: { campaignId: string; userId: string } }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { campaignId, userId } = request.params

      const campaign = await fastify.prisma.campaign.findUnique({
        where: { id: campaignId },
      })

      if (!campaign) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Campaign not found',
        })
      }

      if (campaign.ownerId !== user.id) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Not authorized to remove members from this campaign',
        })
      }

      const member = await fastify.prisma.campaignMember.findUnique({
        where: {
          campaignId_userId: {
            campaignId,
            userId,
          },
        },
      })

      if (!member) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Member not found',
        })
      }

      await fastify.prisma.campaignMember.delete({
        where: { id: member.id },
      })

      return reply.status(200).send({ success: true })
    }
  )
}
