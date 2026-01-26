import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import crypto from 'crypto'
import type {
  Adventure,
  AdventureListResponse,
  AdventureResponse,
  CreateAdventureRequest,
  UpdateAdventureRequest,
} from '@gygax/shared'
import { uploadFile, deleteFile, deleteFolder, extractKeyFromUrl } from '../services/storage.js'

const MAX_NAME_LENGTH = 100
const MAX_DESCRIPTION_LENGTH = 1000
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

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

export async function adventureRoutes(fastify: FastifyInstance) {
  // GET /api/adventures - List user's standalone adventures (not in a campaign)
  fastify.get('/api/adventures', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await requireVerifiedUser(fastify, request, reply)
    if (!user) return

    const adventures = await fastify.prisma.adventure.findMany({
      where: {
        ownerId: user.id,
        campaignId: null, // Only standalone adventures
      },
      orderBy: { updatedAt: 'desc' },
    })

    const response: AdventureListResponse = {
      adventures: adventures.map(formatAdventure),
    }

    return reply.status(200).send(response)
  })

  // POST /api/adventures - Create adventure
  fastify.post<{ Body: CreateAdventureRequest }>(
    '/api/adventures',
    async (request: FastifyRequest<{ Body: CreateAdventureRequest }>, reply: FastifyReply) => {
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

      const adventure = await fastify.prisma.adventure.create({
        data: {
          name: trimmedName,
          description: trimmedDescription,
          ownerId: user.id,
        },
      })

      const response: AdventureResponse = {
        adventure: formatAdventure(adventure),
      }

      return reply.status(201).send(response)
    }
  )

  // GET /api/adventures/:id - Get single adventure
  fastify.get<{ Params: { id: string } }>(
    '/api/adventures/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const adventure = await fastify.prisma.adventure.findUnique({
        where: { id },
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
          message: 'Not authorized to access this adventure',
        })
      }

      const response: AdventureResponse = {
        adventure: formatAdventure(adventure),
      }

      return reply.status(200).send(response)
    }
  )

  // PATCH /api/adventures/:id - Update adventure
  fastify.patch<{ Params: { id: string }; Body: UpdateAdventureRequest }>(
    '/api/adventures/:id',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateAdventureRequest }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params
      const { name, description, campaignId } = request.body

      const adventure = await fastify.prisma.adventure.findUnique({
        where: { id },
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
          message: 'Not authorized to modify this adventure',
        })
      }

      const updateData: { name?: string; description?: string | null; campaignId?: string | null } = {}

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

      // Validate and set campaignId if provided
      if (campaignId !== undefined) {
        if (campaignId === null) {
          // Remove from campaign (make standalone)
          updateData.campaignId = null
        } else if (typeof campaignId !== 'string') {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'campaignId must be a string or null',
          })
        } else {
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
              message: 'Not authorized to add adventures to this campaign',
            })
          }

          updateData.campaignId = campaignId
        }
      }

      const updatedAdventure = await fastify.prisma.adventure.update({
        where: { id },
        data: updateData,
      })

      const response: AdventureResponse = {
        adventure: formatAdventure(updatedAdventure),
      }

      return reply.status(200).send(response)
    }
  )

  // DELETE /api/adventures/:id - Delete adventure
  fastify.delete<{ Params: { id: string } }>(
    '/api/adventures/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const adventure = await fastify.prisma.adventure.findUnique({
        where: { id },
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
          message: 'Not authorized to delete this adventure',
        })
      }

      // Delete associated files from storage
      // Note: Keep using 'campaigns' path for backwards compatibility with existing files
      try {
        await deleteFolder(`campaigns/${id}`)
      } catch {
        // Log but don't fail if file deletion fails
        fastify.log.error(`Failed to delete files for adventure ${id}`)
      }

      await fastify.prisma.adventure.delete({
        where: { id },
      })

      return reply.status(200).send({ success: true })
    }
  )

  // POST /api/adventures/:id/cover - Upload cover image
  fastify.post<{ Params: { id: string } }>(
    '/api/adventures/:id/cover',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const adventure = await fastify.prisma.adventure.findUnique({
        where: { id },
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
          message: 'Not authorized to modify this adventure',
        })
      }

      // Parse multipart form data
      const parts = request.parts()
      let fileBuffer: Buffer | null = null
      let fileMimetype: string | null = null
      let fileTruncated = false
      let focusX: number | null = null
      let focusY: number | null = null

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
          if (part.fieldname === 'focusX' && typeof part.value === 'string') {
            const parsed = parseFloat(part.value)
            if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
              focusX = parsed
            }
          } else if (part.fieldname === 'focusY' && typeof part.value === 'string') {
            const parsed = parseFloat(part.value)
            if (!isNaN(parsed) && parsed >= 0 && parsed <= 100) {
              focusY = parsed
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
      // Note: Keep using 'campaigns' path for backwards compatibility with existing files
      const ext = fileMimetype.split('/')[1] === 'jpeg' ? 'jpg' : fileMimetype.split('/')[1]
      const filename = `${crypto.randomUUID()}.${ext}`
      const key = `campaigns/${id}/${filename}`

      // Delete existing cover image if present
      if (adventure.coverImageUrl) {
        const existingKey = extractKeyFromUrl(adventure.coverImageUrl)
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
      const imageUrl = await uploadFile(key, fileBuffer, fileMimetype)

      // Update adventure with image URL and focal point
      const updatedAdventure = await fastify.prisma.adventure.update({
        where: { id },
        data: {
          coverImageUrl: imageUrl,
          coverImageFocusX: focusX,
          coverImageFocusY: focusY,
        },
      })

      const response: AdventureResponse = {
        adventure: formatAdventure(updatedAdventure),
      }

      return reply.status(200).send(response)
    }
  )

  // DELETE /api/adventures/:id/cover - Remove cover image
  fastify.delete<{ Params: { id: string } }>(
    '/api/adventures/:id/cover',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const adventure = await fastify.prisma.adventure.findUnique({
        where: { id },
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
          message: 'Not authorized to modify this adventure',
        })
      }

      // Delete existing cover image if present
      if (adventure.coverImageUrl) {
        const existingKey = extractKeyFromUrl(adventure.coverImageUrl)
        if (existingKey) {
          try {
            await deleteFile(existingKey)
          } catch {
            // Log but don't fail
            fastify.log.error(`Failed to delete cover image: ${existingKey}`)
          }
        }
      }

      // Update adventure - clear image and focal point
      const updatedAdventure = await fastify.prisma.adventure.update({
        where: { id },
        data: {
          coverImageUrl: null,
          coverImageFocusX: null,
          coverImageFocusY: null,
        },
      })

      const response: AdventureResponse = {
        adventure: formatAdventure(updatedAdventure),
      }

      return reply.status(200).send(response)
    }
  )

  // PATCH /api/adventures/:id/cover/focus - Update cover image focal point
  fastify.patch<{ Params: { id: string }; Body: { focusX: number; focusY: number } }>(
    '/api/adventures/:id/cover/focus',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: { focusX: number; focusY: number } }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params
      const { focusX, focusY } = request.body

      // Validate focal point values
      if (
        typeof focusX !== 'number' ||
        typeof focusY !== 'number' ||
        focusX < 0 ||
        focusX > 100 ||
        focusY < 0 ||
        focusY > 100
      ) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Focal point values must be numbers between 0 and 100',
        })
      }

      const adventure = await fastify.prisma.adventure.findUnique({
        where: { id },
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
          message: 'Not authorized to modify this adventure',
        })
      }

      if (!adventure.coverImageUrl) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Adventure has no cover image',
        })
      }

      const updatedAdventure = await fastify.prisma.adventure.update({
        where: { id },
        data: {
          coverImageFocusX: focusX,
          coverImageFocusY: focusY,
        },
      })

      const response: AdventureResponse = {
        adventure: formatAdventure(updatedAdventure),
      }

      return reply.status(200).send(response)
    }
  )
}
