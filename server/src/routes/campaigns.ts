import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import crypto from 'crypto'
import type {
  Campaign,
  CampaignListResponse,
  CampaignResponse,
  CreateCampaignRequest,
  UpdateCampaignRequest,
} from '@gygax/shared'
import { uploadFile, deleteFile, deleteFolder, extractKeyFromUrl } from '../services/storage.js'

const MAX_NAME_LENGTH = 100
const MAX_DESCRIPTION_LENGTH = 1000
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function formatCampaign(campaign: {
  id: string
  name: string
  description: string | null
  coverImageUrl: string | null
  createdAt: Date
  updatedAt: Date
}): Campaign {
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    coverImageUrl: campaign.coverImageUrl,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
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

export async function campaignRoutes(fastify: FastifyInstance) {
  // GET /api/campaigns - List user's campaigns
  fastify.get('/api/campaigns', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await requireVerifiedUser(fastify, request, reply)
    if (!user) return

    const campaigns = await fastify.prisma.campaign.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: 'desc' },
    })

    const response: CampaignListResponse = {
      campaigns: campaigns.map(formatCampaign),
    }

    return reply.status(200).send(response)
  })

  // POST /api/campaigns - Create campaign
  fastify.post<{ Body: CreateCampaignRequest }>(
    '/api/campaigns',
    async (request: FastifyRequest<{ Body: CreateCampaignRequest }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { name, description } = request.body

      // Validate name
      if (!name || typeof name !== 'string') {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Name is required',
        })
      }

      const trimmedName = name.trim()
      if (trimmedName.length === 0) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Name is required',
        })
      }

      if (trimmedName.length > MAX_NAME_LENGTH) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Name must be ${MAX_NAME_LENGTH} characters or less`,
        })
      }

      // Validate description
      let trimmedDescription: string | null = null
      if (description !== undefined && description !== null) {
        if (typeof description !== 'string') {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Description must be a string',
          })
        }
        trimmedDescription = description.trim()
        if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`,
          })
        }
        if (trimmedDescription.length === 0) {
          trimmedDescription = null
        }
      }

      const campaign = await fastify.prisma.campaign.create({
        data: {
          name: trimmedName,
          description: trimmedDescription,
          ownerId: user.id,
        },
      })

      const response: CampaignResponse = {
        campaign: formatCampaign(campaign),
      }

      return reply.status(201).send(response)
    }
  )

  // GET /api/campaigns/:id - Get single campaign
  fastify.get<{ Params: { id: string } }>(
    '/api/campaigns/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const campaign = await fastify.prisma.campaign.findUnique({
        where: { id },
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
          message: 'Not authorized to access this campaign',
        })
      }

      const response: CampaignResponse = {
        campaign: formatCampaign(campaign),
      }

      return reply.status(200).send(response)
    }
  )

  // PATCH /api/campaigns/:id - Update campaign
  fastify.patch<{ Params: { id: string }; Body: UpdateCampaignRequest }>(
    '/api/campaigns/:id',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateCampaignRequest }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params
      const { name, description } = request.body

      const campaign = await fastify.prisma.campaign.findUnique({
        where: { id },
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
          message: 'Not authorized to modify this campaign',
        })
      }

      const updateData: { name?: string; description?: string | null } = {}

      // Validate and set name if provided
      if (name !== undefined) {
        if (typeof name !== 'string') {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Name must be a string',
          })
        }
        const trimmedName = name.trim()
        if (trimmedName.length === 0) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Name cannot be empty',
          })
        }
        if (trimmedName.length > MAX_NAME_LENGTH) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Name must be ${MAX_NAME_LENGTH} characters or less`,
          })
        }
        updateData.name = trimmedName
      }

      // Validate and set description if provided
      if (description !== undefined) {
        if (description === null) {
          updateData.description = null
        } else if (typeof description !== 'string') {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Description must be a string or null',
          })
        } else {
          const trimmedDescription = description.trim()
          if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH) {
            return reply.status(400).send({
              error: 'Bad Request',
              message: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`,
            })
          }
          updateData.description = trimmedDescription.length === 0 ? null : trimmedDescription
        }
      }

      const updatedCampaign = await fastify.prisma.campaign.update({
        where: { id },
        data: updateData,
      })

      const response: CampaignResponse = {
        campaign: formatCampaign(updatedCampaign),
      }

      return reply.status(200).send(response)
    }
  )

  // DELETE /api/campaigns/:id - Delete campaign
  fastify.delete<{ Params: { id: string } }>(
    '/api/campaigns/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const campaign = await fastify.prisma.campaign.findUnique({
        where: { id },
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
          message: 'Not authorized to delete this campaign',
        })
      }

      // Delete associated files from storage
      try {
        await deleteFolder(`campaigns/${id}`)
      } catch {
        // Log but don't fail if file deletion fails
        fastify.log.error(`Failed to delete files for campaign ${id}`)
      }

      await fastify.prisma.campaign.delete({
        where: { id },
      })

      return reply.status(200).send({ success: true })
    }
  )

  // POST /api/campaigns/:id/cover - Upload cover image
  fastify.post<{ Params: { id: string } }>(
    '/api/campaigns/:id/cover',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const campaign = await fastify.prisma.campaign.findUnique({
        where: { id },
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
          message: 'Not authorized to modify this campaign',
        })
      }

      // Get the uploaded file
      const data = await request.file()

      if (!data) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'No file provided',
        })
      }

      // Validate mime type
      if (!ALLOWED_MIME_TYPES.includes(data.mimetype)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid file type. Allowed types: JPEG, PNG, WebP',
        })
      }

      // Read file into buffer
      const chunks: Buffer[] = []

      for await (const chunk of data.file) {
        chunks.push(chunk)
      }

      // Check if file was truncated due to size limit
      if (data.file.truncated) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'File too large. Maximum size is 5MB',
        })
      }

      const buffer = Buffer.concat(chunks)

      // Generate unique filename
      const ext = data.mimetype.split('/')[1] === 'jpeg' ? 'jpg' : data.mimetype.split('/')[1]
      const filename = `${crypto.randomUUID()}.${ext}`
      const key = `campaigns/${id}/${filename}`

      // Delete existing cover image if present
      if (campaign.coverImageUrl) {
        const existingKey = extractKeyFromUrl(campaign.coverImageUrl)
        if (existingKey) {
          try {
            await deleteFile(existingKey)
          } catch {
            // Log but don't fail
            fastify.log.error(`Failed to delete existing cover image: ${existingKey}`)
          }
        }
      }

      // Upload new image
      const imageUrl = await uploadFile(key, buffer, data.mimetype)

      // Update campaign
      const updatedCampaign = await fastify.prisma.campaign.update({
        where: { id },
        data: { coverImageUrl: imageUrl },
      })

      const response: CampaignResponse = {
        campaign: formatCampaign(updatedCampaign),
      }

      return reply.status(200).send(response)
    }
  )

  // DELETE /api/campaigns/:id/cover - Remove cover image
  fastify.delete<{ Params: { id: string } }>(
    '/api/campaigns/:id/cover',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const campaign = await fastify.prisma.campaign.findUnique({
        where: { id },
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
          message: 'Not authorized to modify this campaign',
        })
      }

      // Delete existing cover image if present
      if (campaign.coverImageUrl) {
        const existingKey = extractKeyFromUrl(campaign.coverImageUrl)
        if (existingKey) {
          try {
            await deleteFile(existingKey)
          } catch {
            // Log but don't fail
            fastify.log.error(`Failed to delete cover image: ${existingKey}`)
          }
        }
      }

      // Update campaign
      const updatedCampaign = await fastify.prisma.campaign.update({
        where: { id },
        data: { coverImageUrl: null },
      })

      const response: CampaignResponse = {
        campaign: formatCampaign(updatedCampaign),
      }

      return reply.status(200).send(response)
    }
  )
}
