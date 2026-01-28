import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import crypto from 'crypto'
import type {
  Campaign,
  CampaignListResponse,
  CampaignResponse,
  CampaignWithAdventuresResponse,
  CreateCampaignRequest,
  UpdateCampaignRequest,
  Adventure,
  AdventureResponse,
  CreateAdventureRequest,
  CreateWorldMapRequest,
  Map as MapType,
  MapResponse,
  GridType,
} from '@gygax/shared'
import { uploadFile, deleteFile, extractKeyFromUrl } from '../services/storage.js'

const MAX_NAME_LENGTH = 100
const MAX_DESCRIPTION_LENGTH = 1000
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function formatCampaign(campaign: {
  id: string
  name: string
  description: string | null
  bannerImageUrl: string | null
  bannerHotspotX: number | null
  bannerHotspotY: number | null
  createdAt: Date
  updatedAt: Date
}): Campaign {
  return {
    id: campaign.id,
    name: campaign.name,
    description: campaign.description,
    bannerImageUrl: campaign.bannerImageUrl,
    bannerHotspotX: campaign.bannerHotspotX,
    bannerHotspotY: campaign.bannerHotspotY,
    createdAt: campaign.createdAt.toISOString(),
    updatedAt: campaign.updatedAt.toISOString(),
  }
}

function formatMap(map: {
  id: string
  name: string
  description: string | null
  gridType: string
  width: number
  height: number
  cellSize: number
  content: unknown
  adventureId: string | null
  campaignId: string | null
  createdAt: Date
  updatedAt: Date
}): MapType {
  return {
    id: map.id,
    name: map.name,
    description: map.description,
    gridType: map.gridType as GridType,
    width: map.width,
    height: map.height,
    cellSize: map.cellSize,
    content: map.content as MapType['content'],
    adventureId: map.adventureId,
    campaignId: map.campaignId,
    createdAt: map.createdAt.toISOString(),
    updatedAt: map.updatedAt.toISOString(),
  }
}

function formatAdventure(adventure: {
  id: string
  name: string
  description: string | null
  coverImageUrl: string | null
  coverImageFocusX: number | null
  coverImageFocusY: number | null
  campaignId: string | null
  createdAt: Date
  updatedAt: Date
}): Adventure {
  return {
    id: adventure.id,
    name: adventure.name,
    description: adventure.description,
    coverImageUrl: adventure.coverImageUrl,
    coverImageFocusX: adventure.coverImageFocusX,
    coverImageFocusY: adventure.coverImageFocusY,
    campaignId: adventure.campaignId,
    createdAt: adventure.createdAt.toISOString(),
    updatedAt: adventure.updatedAt.toISOString(),
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
  // GET /api/campaigns - List user's campaigns with adventure counts
  fastify.get('/api/campaigns', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await requireVerifiedUser(fastify, request, reply)
    if (!user) return

    const campaigns = await fastify.prisma.campaign.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: {
          select: { adventures: true },
        },
      },
    })

    const response: CampaignListResponse = {
      campaigns: campaigns.map((c) => ({
        ...formatCampaign(c),
        adventureCount: c._count.adventures,
      })),
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

  // GET /api/campaigns/:id - Get single campaign with adventures
  fastify.get<{ Params: { id: string } }>(
    '/api/campaigns/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const campaign = await fastify.prisma.campaign.findUnique({
        where: { id },
        include: {
          adventures: {
            orderBy: { updatedAt: 'desc' },
          },
          worldMap: true,
        },
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

      const response: CampaignWithAdventuresResponse = {
        campaign: {
          ...formatCampaign(campaign),
          adventures: campaign.adventures.map(formatAdventure),
          worldMap: campaign.worldMap ? formatMap(campaign.worldMap) : null,
        },
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

  // DELETE /api/campaigns/:id - Delete campaign (adventures become standalone)
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

      // Delete associated banner from storage
      if (campaign.bannerImageUrl) {
        const existingKey = extractKeyFromUrl(campaign.bannerImageUrl)
        if (existingKey) {
          try {
            await deleteFile(existingKey)
          } catch {
            fastify.log.error(`Failed to delete banner for campaign ${id}`)
          }
        }
      }

      // Note: Adventures will become standalone (campaignId set to null) due to onDelete: SetNull
      await fastify.prisma.campaign.delete({
        where: { id },
      })

      return reply.status(200).send({ success: true })
    }
  )

  // POST /api/campaigns/:id/banner - Upload banner image with hotspot
  fastify.post<{ Params: { id: string } }>(
    '/api/campaigns/:id/banner',
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

      // Parse multipart form data
      const parts = request.parts()
      let fileBuffer: Buffer | null = null
      let fileMimetype: string | null = null
      let fileTruncated = false
      let hotspotX: number | null = null
      let hotspotY: number | null = null

      for await (const part of parts) {
        if (part.type === 'file') {
          if (part.fieldname === 'image') {
            fileMimetype = part.mimetype
            const chunks: Buffer[] = []
            for await (const chunk of part.file) {
              chunks.push(chunk)
            }
            fileTruncated = part.file.truncated
            fileBuffer = Buffer.concat(chunks)
          }
        } else if (part.type === 'field') {
          if (part.fieldname === 'hotspotX' && typeof part.value === 'string') {
            const parsed = parseFloat(part.value)
            if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
              hotspotX = parsed
            }
          } else if (part.fieldname === 'hotspotY' && typeof part.value === 'string') {
            const parsed = parseFloat(part.value)
            if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
              hotspotY = parsed
            }
          }
        }
      }

      if (!fileBuffer || !fileMimetype) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'No file provided',
        })
      }

      // Validate mime type
      if (!ALLOWED_MIME_TYPES.includes(fileMimetype)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid file type. Allowed types: JPEG, PNG, WebP',
        })
      }

      // Check if file was truncated due to size limit
      if (fileTruncated) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'File too large. Maximum size is 5MB',
        })
      }

      // Generate unique filename
      const ext = fileMimetype.split('/')[1] === 'jpeg' ? 'jpg' : fileMimetype.split('/')[1]
      const filename = `${crypto.randomUUID()}.${ext}`
      const key = `campaign-banners/${id}/${filename}`

      // Delete existing banner image if present
      if (campaign.bannerImageUrl) {
        const existingKey = extractKeyFromUrl(campaign.bannerImageUrl)
        if (existingKey) {
          try {
            await deleteFile(existingKey)
          } catch {
            fastify.log.error(`Failed to delete existing banner: ${existingKey}`)
          }
        }
      }

      // Upload new image
      const imageUrl = await uploadFile(key, fileBuffer, fileMimetype)

      // Update campaign with image URL and hotspot
      const updatedCampaign = await fastify.prisma.campaign.update({
        where: { id },
        data: {
          bannerImageUrl: imageUrl,
          bannerHotspotX: hotspotX ?? 50,
          bannerHotspotY: hotspotY ?? 50,
        },
      })

      const response: CampaignResponse = {
        campaign: formatCampaign(updatedCampaign),
      }

      return reply.status(200).send(response)
    }
  )

  // DELETE /api/campaigns/:id/banner - Remove banner image
  fastify.delete<{ Params: { id: string } }>(
    '/api/campaigns/:id/banner',
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

      // Delete existing banner image if present
      if (campaign.bannerImageUrl) {
        const existingKey = extractKeyFromUrl(campaign.bannerImageUrl)
        if (existingKey) {
          try {
            await deleteFile(existingKey)
          } catch {
            fastify.log.error(`Failed to delete banner: ${existingKey}`)
          }
        }
      }

      // Update campaign - clear image and hotspot
      const updatedCampaign = await fastify.prisma.campaign.update({
        where: { id },
        data: {
          bannerImageUrl: null,
          bannerHotspotX: 50,
          bannerHotspotY: 50,
        },
      })

      const response: CampaignResponse = {
        campaign: formatCampaign(updatedCampaign),
      }

      return reply.status(200).send(response)
    }
  )

  // PATCH /api/campaigns/:id/banner/hotspot - Update banner hotspot
  fastify.patch<{ Params: { id: string }; Body: { hotspotX: number; hotspotY: number } }>(
    '/api/campaigns/:id/banner/hotspot',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: { hotspotX: number; hotspotY: number } }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params
      const { hotspotX, hotspotY } = request.body

      // Validate hotspot values
      if (
        typeof hotspotX !== 'number' ||
        typeof hotspotY !== 'number' ||
        hotspotX < 0 ||
        hotspotX > 100 ||
        hotspotY < 0 ||
        hotspotY > 100
      ) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Hotspot values must be numbers between 0 and 100',
        })
      }

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

      if (!campaign.bannerImageUrl) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Campaign has no banner image',
        })
      }

      const updatedCampaign = await fastify.prisma.campaign.update({
        where: { id },
        data: {
          bannerHotspotX: hotspotX,
          bannerHotspotY: hotspotY,
        },
      })

      const response: CampaignResponse = {
        campaign: formatCampaign(updatedCampaign),
      }

      return reply.status(200).send(response)
    }
  )

  // POST /api/campaigns/:id/adventures - Create adventure in campaign
  fastify.post<{ Params: { id: string }; Body: CreateAdventureRequest }>(
    '/api/campaigns/:id/adventures',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: CreateAdventureRequest }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id: campaignId } = request.params
      const { name, description } = request.body

      // Verify campaign exists and user owns it
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
          message: 'Not authorized to modify this campaign',
        })
      }

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

      const adventure = await fastify.prisma.adventure.create({
        data: {
          name: trimmedName,
          description: trimmedDescription,
          ownerId: user.id,
          campaignId,
        },
      })

      const response: AdventureResponse = {
        adventure: formatAdventure(adventure),
      }

      return reply.status(201).send(response)
    }
  )

  // POST /api/campaigns/:id/world-map - Create world map for campaign
  fastify.post<{ Params: { id: string }; Body: CreateWorldMapRequest }>(
    '/api/campaigns/:id/world-map',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: CreateWorldMapRequest }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id: campaignId } = request.params
      const { name, description, gridType, width, height, content } = request.body

      const campaign = await fastify.prisma.campaign.findUnique({
        where: { id: campaignId },
        include: { worldMap: true },
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

      if (campaign.worldMap) {
        return reply.status(409).send({
          error: 'Conflict',
          message: 'Campaign already has a world map',
        })
      }

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

      // Validate gridType
      let validGridType: 'SQUARE' | 'HEX' = 'HEX'
      if (gridType !== undefined) {
        if (gridType !== 'SQUARE' && gridType !== 'HEX') {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Grid type must be SQUARE or HEX',
          })
        }
        validGridType = gridType
      }

      // Validate dimensions
      const validWidth = width !== undefined ? width : 40
      const validHeight = height !== undefined ? height : 30

      if (typeof validWidth !== 'number' || !Number.isInteger(validWidth) || validWidth < 5 || validWidth > 100) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Width must be an integer between 5 and 100',
        })
      }

      if (typeof validHeight !== 'number' || !Number.isInteger(validHeight) || validHeight < 5 || validHeight > 100) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Height must be an integer between 5 and 100',
        })
      }

      const map = await fastify.prisma.map.create({
        data: {
          name: trimmedName,
          description: trimmedDescription,
          gridType: validGridType,
          width: validWidth,
          height: validHeight,
          cellSize: 40,
          campaignId,
          content: content ?? undefined,
        },
      })

      const mapResponse: MapResponse = {
        map: formatMap(map),
      }

      return reply.status(201).send(mapResponse)
    }
  )

  // GET /api/campaigns/:id/world-map - Get campaign's world map
  fastify.get<{ Params: { id: string } }>(
    '/api/campaigns/:id/world-map',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const campaign = await fastify.prisma.campaign.findUnique({
        where: { id },
        include: { worldMap: true },
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

      const mapResponse: MapResponse | { map: null } = {
        map: campaign.worldMap ? formatMap(campaign.worldMap) : null,
      }

      return reply.status(200).send(mapResponse)
    }
  )

  // DELETE /api/campaigns/:id/world-map - Delete campaign's world map
  fastify.delete<{ Params: { id: string } }>(
    '/api/campaigns/:id/world-map',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const campaign = await fastify.prisma.campaign.findUnique({
        where: { id },
        include: { worldMap: true },
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

      if (!campaign.worldMap) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Campaign has no world map',
        })
      }

      await fastify.prisma.map.delete({
        where: { id: campaign.worldMap.id },
      })

      return reply.status(200).send({ success: true })
    }
  )
}
