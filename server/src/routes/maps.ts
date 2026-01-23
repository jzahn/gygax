import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import type {
  Map,
  MapListResponse,
  MapResponse,
  CreateMapRequest,
  UpdateMapRequest,
  GridType,
} from '@gygax/shared'

const MAX_NAME_LENGTH = 100
const MAX_DESCRIPTION_LENGTH = 1000
const MIN_DIMENSION = 5
const MAX_DIMENSION = 100
const DEFAULT_DIMENSION = 30
const DEFAULT_CELL_SIZE = 40

function formatMap(map: {
  id: string
  name: string
  description: string | null
  gridType: string
  width: number
  height: number
  cellSize: number
  campaignId: string
  createdAt: Date
  updatedAt: Date
}): Map {
  return {
    id: map.id,
    name: map.name,
    description: map.description,
    gridType: map.gridType as GridType,
    width: map.width,
    height: map.height,
    cellSize: map.cellSize,
    campaignId: map.campaignId,
    createdAt: map.createdAt.toISOString(),
    updatedAt: map.updatedAt.toISOString(),
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

async function requireCampaignOwnership(
  fastify: FastifyInstance,
  campaignId: string,
  userId: string,
  reply: FastifyReply
): Promise<boolean> {
  const campaign = await fastify.prisma.campaign.findUnique({
    where: { id: campaignId },
    select: { id: true, ownerId: true },
  })

  if (!campaign) {
    reply.status(404).send({
      error: 'Not Found',
      message: 'Campaign not found',
    })
    return false
  }

  if (campaign.ownerId !== userId) {
    reply.status(403).send({
      error: 'Forbidden',
      message: 'Not authorized to access this campaign',
    })
    return false
  }

  return true
}

export async function mapRoutes(fastify: FastifyInstance) {
  // GET /api/campaigns/:campaignId/maps - List maps in a campaign
  fastify.get<{ Params: { campaignId: string } }>(
    '/api/campaigns/:campaignId/maps',
    async (request: FastifyRequest<{ Params: { campaignId: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { campaignId } = request.params

      const hasAccess = await requireCampaignOwnership(fastify, campaignId, user.id, reply)
      if (!hasAccess) return

      const maps = await fastify.prisma.map.findMany({
        where: { campaignId },
        orderBy: { updatedAt: 'desc' },
      })

      const response: MapListResponse = {
        maps: maps.map(formatMap),
      }

      return reply.status(200).send(response)
    }
  )

  // POST /api/campaigns/:campaignId/maps - Create a new map
  fastify.post<{ Params: { campaignId: string }; Body: CreateMapRequest }>(
    '/api/campaigns/:campaignId/maps',
    async (
      request: FastifyRequest<{ Params: { campaignId: string }; Body: CreateMapRequest }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { campaignId } = request.params
      const { name, description, gridType, width, height } = request.body

      const hasAccess = await requireCampaignOwnership(fastify, campaignId, user.id, reply)
      if (!hasAccess) return

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
      let validGridType: 'SQUARE' | 'HEX' = 'SQUARE'
      if (gridType !== undefined) {
        if (gridType !== 'SQUARE' && gridType !== 'HEX') {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Grid type must be SQUARE or HEX',
          })
        }
        validGridType = gridType
      }

      // Validate width
      let validWidth = DEFAULT_DIMENSION
      if (width !== undefined) {
        if (typeof width !== 'number' || !Number.isInteger(width)) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Width must be an integer',
          })
        }
        if (width < MIN_DIMENSION || width > MAX_DIMENSION) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Width must be between ${MIN_DIMENSION} and ${MAX_DIMENSION}`,
          })
        }
        validWidth = width
      }

      // Validate height
      let validHeight = DEFAULT_DIMENSION
      if (height !== undefined) {
        if (typeof height !== 'number' || !Number.isInteger(height)) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Height must be an integer',
          })
        }
        if (height < MIN_DIMENSION || height > MAX_DIMENSION) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Height must be between ${MIN_DIMENSION} and ${MAX_DIMENSION}`,
          })
        }
        validHeight = height
      }

      const map = await fastify.prisma.map.create({
        data: {
          name: trimmedName,
          description: trimmedDescription,
          gridType: validGridType,
          width: validWidth,
          height: validHeight,
          cellSize: DEFAULT_CELL_SIZE,
          campaignId,
        },
      })

      const response: MapResponse = {
        map: formatMap(map),
      }

      return reply.status(201).send(response)
    }
  )

  // GET /api/maps/:id - Get a single map
  fastify.get<{ Params: { id: string } }>(
    '/api/maps/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const map = await fastify.prisma.map.findUnique({
        where: { id },
        include: { campaign: { select: { ownerId: true } } },
      })

      if (!map) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Map not found',
        })
      }

      if (map.campaign.ownerId !== user.id) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Not authorized to access this map',
        })
      }

      const response: MapResponse = {
        map: formatMap(map),
      }

      return reply.status(200).send(response)
    }
  )

  // PATCH /api/maps/:id - Update a map
  fastify.patch<{ Params: { id: string }; Body: UpdateMapRequest }>(
    '/api/maps/:id',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateMapRequest }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params
      const { name, description, width, height } = request.body

      const map = await fastify.prisma.map.findUnique({
        where: { id },
        include: { campaign: { select: { ownerId: true } } },
      })

      if (!map) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Map not found',
        })
      }

      if (map.campaign.ownerId !== user.id) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Not authorized to modify this map',
        })
      }

      const updateData: { name?: string; description?: string | null; width?: number; height?: number } = {}

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

      // Validate and set width if provided
      if (width !== undefined) {
        if (typeof width !== 'number' || !Number.isInteger(width)) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Width must be an integer',
          })
        }
        if (width < MIN_DIMENSION || width > MAX_DIMENSION) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Width must be between ${MIN_DIMENSION} and ${MAX_DIMENSION}`,
          })
        }
        updateData.width = width
      }

      // Validate and set height if provided
      if (height !== undefined) {
        if (typeof height !== 'number' || !Number.isInteger(height)) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Height must be an integer',
          })
        }
        if (height < MIN_DIMENSION || height > MAX_DIMENSION) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Height must be between ${MIN_DIMENSION} and ${MAX_DIMENSION}`,
          })
        }
        updateData.height = height
      }

      const updatedMap = await fastify.prisma.map.update({
        where: { id },
        data: updateData,
      })

      const response: MapResponse = {
        map: formatMap(updatedMap),
      }

      return reply.status(200).send(response)
    }
  )

  // DELETE /api/maps/:id - Delete a map
  fastify.delete<{ Params: { id: string } }>(
    '/api/maps/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const map = await fastify.prisma.map.findUnique({
        where: { id },
        include: { campaign: { select: { ownerId: true } } },
      })

      if (!map) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Map not found',
        })
      }

      if (map.campaign.ownerId !== user.id) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Not authorized to delete this map',
        })
      }

      await fastify.prisma.map.delete({
        where: { id },
      })

      return reply.status(200).send({ success: true })
    }
  )
}
