import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import type {
  Map,
  MapListResponse,
  MapResponse,
  CreateMapRequest,
  UpdateMapRequest,
  GridType,
  MapContent,
  TerrainType,
  PathType,
  TextSize,
} from '@gygax/shared'

const MAX_NAME_LENGTH = 100
const MAX_DESCRIPTION_LENGTH = 1000
const MIN_DIMENSION = 5
const MAX_DIMENSION = 100
const DEFAULT_DIMENSION = 30
const DEFAULT_CELL_SIZE = 40

const VALID_TERRAIN_TYPES: TerrainType[] = [
  'clear',
  'grasslands',
  'forest',
  'jungle',
  'hills',
  'mountains',
  'desert',
  'swamp',
  'water',
  'volcano',
  'barren',
  'castle',
  'ruins',
  'capitol',
  'city',
  'town',
  'caves',
]

const VALID_PATH_TYPES: PathType[] = ['road', 'river', 'stream', 'border', 'trail']
const VALID_TEXT_SIZES: TextSize[] = ['small', 'medium', 'large', 'xlarge']
const MAX_LABEL_LENGTH = 200

function formatMap(map: {
  id: string
  name: string
  description: string | null
  gridType: string
  width: number
  height: number
  cellSize: number
  content: unknown
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
    content: map.content as MapContent | null,
    campaignId: map.campaignId,
    createdAt: map.createdAt.toISOString(),
    updatedAt: map.updatedAt.toISOString(),
  }
}

function validateMapContent(
  content: unknown,
  mapWidth: number,
  mapHeight: number,
  cellSize: number = 40
): { valid: true } | { valid: false; message: string } {
  if (content === null || content === undefined) {
    return { valid: true }
  }

  if (typeof content !== 'object') {
    return { valid: false, message: 'Content must be an object' }
  }

  const c = content as Record<string, unknown>

  // Accept version 1 or 2 for backwards compatibility
  if (c.version !== 1 && c.version !== 2) {
    return { valid: false, message: 'Content version must be 1 or 2' }
  }

  if (!Array.isArray(c.terrain)) {
    return { valid: false, message: 'Content terrain must be an array' }
  }

  for (const stamp of c.terrain) {
    if (typeof stamp !== 'object' || stamp === null) {
      return { valid: false, message: 'Each terrain stamp must be an object' }
    }

    const s = stamp as Record<string, unknown>

    if (typeof s.hex !== 'object' || s.hex === null) {
      return { valid: false, message: 'Terrain stamp must have a hex coordinate' }
    }

    const hex = s.hex as Record<string, unknown>

    if (typeof hex.col !== 'number' || !Number.isInteger(hex.col)) {
      return { valid: false, message: 'Hex col must be an integer' }
    }

    if (typeof hex.row !== 'number' || !Number.isInteger(hex.row)) {
      return { valid: false, message: 'Hex row must be an integer' }
    }

    if (hex.col < 0 || hex.col >= mapWidth) {
      return { valid: false, message: `Hex col must be between 0 and ${mapWidth - 1}` }
    }

    if (hex.row < 0 || hex.row >= mapHeight) {
      return { valid: false, message: `Hex row must be between 0 and ${mapHeight - 1}` }
    }

    if (typeof s.terrain !== 'string' || !VALID_TERRAIN_TYPES.includes(s.terrain as TerrainType)) {
      return { valid: false, message: `Invalid terrain type: ${s.terrain}` }
    }

    // Validate variant (0, 1, or 2)
    if (s.variant !== undefined) {
      if (typeof s.variant !== 'number' || !Number.isInteger(s.variant)) {
        return { valid: false, message: 'Variant must be an integer' }
      }
      if (s.variant < 0 || s.variant > 2) {
        return { valid: false, message: 'Variant must be 0, 1, or 2' }
      }
    }
  }

  // Validate paths if present
  if (c.paths !== undefined) {
    if (!Array.isArray(c.paths)) {
      return { valid: false, message: 'Content paths must be an array' }
    }

    // Calculate approximate canvas dimensions for bounds checking
    const hexSize = cellSize / 2
    const canvasWidth = mapWidth * hexSize * 1.5 + hexSize * 0.5
    const canvasHeight = mapHeight * hexSize * Math.sqrt(3) + hexSize * Math.sqrt(3) * 0.5

    for (const path of c.paths) {
      if (typeof path !== 'object' || path === null) {
        return { valid: false, message: 'Each path must be an object' }
      }

      const p = path as Record<string, unknown>

      if (typeof p.id !== 'string' || p.id.length === 0) {
        return { valid: false, message: 'Path must have a valid id' }
      }

      if (typeof p.type !== 'string' || !VALID_PATH_TYPES.includes(p.type as PathType)) {
        return { valid: false, message: `Invalid path type: ${p.type}` }
      }

      if (!Array.isArray(p.points) || p.points.length < 2) {
        return { valid: false, message: 'Path must have at least 2 points' }
      }

      for (const point of p.points) {
        if (typeof point !== 'object' || point === null) {
          return { valid: false, message: 'Each path point must be an object' }
        }

        const pt = point as Record<string, unknown>

        if (typeof pt.x !== 'number') {
          return { valid: false, message: 'Path point x must be a number' }
        }

        if (typeof pt.y !== 'number') {
          return { valid: false, message: 'Path point y must be a number' }
        }

        // Allow some margin beyond canvas for paths near edges
        const margin = cellSize
        if (pt.x < -margin || pt.x > canvasWidth + margin) {
          return { valid: false, message: 'Path point x is out of bounds' }
        }

        if (pt.y < -margin || pt.y > canvasHeight + margin) {
          return { valid: false, message: 'Path point y is out of bounds' }
        }
      }

      // Validate optional closed property
      if (p.closed !== undefined && typeof p.closed !== 'boolean') {
        return { valid: false, message: 'Path closed must be a boolean' }
      }
    }
  }

  // Validate labels if present
  if (c.labels !== undefined) {
    if (!Array.isArray(c.labels)) {
      return { valid: false, message: 'Content labels must be an array' }
    }

    // Calculate approximate canvas dimensions for bounds checking
    const hexSize = cellSize / 2
    const canvasWidth = mapWidth * hexSize * 1.5 + hexSize * 0.5
    const canvasHeight = mapHeight * hexSize * Math.sqrt(3) + hexSize * Math.sqrt(3) * 0.5

    for (const label of c.labels) {
      if (typeof label !== 'object' || label === null) {
        return { valid: false, message: 'Each label must be an object' }
      }

      const l = label as Record<string, unknown>

      if (typeof l.id !== 'string' || l.id.length === 0) {
        return { valid: false, message: 'Label must have a valid id' }
      }

      if (typeof l.text !== 'string') {
        return { valid: false, message: 'Label text must be a string' }
      }

      if (l.text.length === 0 || l.text.length > MAX_LABEL_LENGTH) {
        return { valid: false, message: `Label text must be 1-${MAX_LABEL_LENGTH} characters` }
      }

      if (typeof l.size !== 'string' || !VALID_TEXT_SIZES.includes(l.size as TextSize)) {
        return { valid: false, message: `Invalid label size: ${l.size}` }
      }

      if (typeof l.position !== 'object' || l.position === null) {
        return { valid: false, message: 'Label must have a position' }
      }

      const pos = l.position as Record<string, unknown>

      if (typeof pos.x !== 'number') {
        return { valid: false, message: 'Label position x must be a number' }
      }

      if (typeof pos.y !== 'number') {
        return { valid: false, message: 'Label position y must be a number' }
      }

      // Allow some margin beyond canvas for labels near edges
      const margin = 50
      if (pos.x < -margin || pos.x > canvasWidth + margin) {
        return { valid: false, message: 'Label position x is out of bounds' }
      }

      if (pos.y < -margin || pos.y > canvasHeight + margin) {
        return { valid: false, message: 'Label position y is out of bounds' }
      }
    }
  }

  return { valid: true }
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
      const { name, description, width, height, content } = request.body

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

      const updateData: {
        name?: string
        description?: string | null
        width?: number
        height?: number
        content?: MapContent
      } = {}

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

      // Validate and set content if provided
      if (content !== undefined) {
        // Use potentially updated dimensions, or fall back to existing
        const effectiveWidth = updateData.width ?? map.width
        const effectiveHeight = updateData.height ?? map.height

        const contentValidation = validateMapContent(content, effectiveWidth, effectiveHeight, map.cellSize)
        if (!contentValidation.valid) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: contentValidation.message,
          })
        }
        updateData.content = content as MapContent
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
