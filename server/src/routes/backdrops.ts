import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import crypto from 'crypto'
import type {
  Backdrop,
  BackdropListResponse,
  BackdropResponse,
  UpdateBackdropRequest,
} from '@gygax/shared'
import { uploadFile, deleteFile, deleteFolder, extractKeyFromUrl } from '../services/storage.js'

const MAX_NAME_LENGTH = 100
const MAX_TITLE_LENGTH = 200
const MAX_DESCRIPTION_LENGTH = 2000
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

function formatBackdrop(backdrop: {
  id: string
  name: string
  title: string | null
  titleX: number
  titleY: number
  description: string | null
  imageUrl: string
  focusX: number
  focusY: number
  adventureId: string
  createdAt: Date
  updatedAt: Date
}): Backdrop {
  return {
    id: backdrop.id,
    name: backdrop.name,
    title: backdrop.title,
    titleX: backdrop.titleX,
    titleY: backdrop.titleY,
    description: backdrop.description,
    imageUrl: backdrop.imageUrl,
    focusX: backdrop.focusX,
    focusY: backdrop.focusY,
    adventureId: backdrop.adventureId,
    createdAt: backdrop.createdAt.toISOString(),
    updatedAt: backdrop.updatedAt.toISOString(),
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

async function requireAdventureOwnership(
  fastify: FastifyInstance,
  adventureId: string,
  userId: string,
  reply: FastifyReply
): Promise<boolean> {
  const adventure = await fastify.prisma.adventure.findUnique({
    where: { id: adventureId },
    select: { id: true, ownerId: true },
  })

  if (!adventure || adventure.ownerId !== userId) {
    reply.status(404).send({
      error: 'Not Found',
      message: 'Adventure not found',
    })
    return false
  }

  return true
}

function parseIntField(value: unknown, defaultVal: number): number {
  if (value === undefined || value === null || value === '') return defaultVal
  const parsed = parseInt(String(value), 10)
  return isNaN(parsed) ? defaultVal : parsed
}

export async function backdropRoutes(fastify: FastifyInstance) {
  // GET /api/adventures/:adventureId/backdrops
  fastify.get<{ Params: { adventureId: string } }>(
    '/api/adventures/:adventureId/backdrops',
    async (request: FastifyRequest<{ Params: { adventureId: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { adventureId } = request.params

      const hasAccess = await requireAdventureOwnership(fastify, adventureId, user.id, reply)
      if (!hasAccess) return

      const backdrops = await fastify.prisma.backdrop.findMany({
        where: { adventureId },
        orderBy: { updatedAt: 'desc' },
      })

      const response: BackdropListResponse = {
        backdrops: backdrops.map(formatBackdrop),
      }

      return reply.status(200).send(response)
    }
  )

  // POST /api/adventures/:adventureId/backdrops (multipart)
  fastify.post<{ Params: { adventureId: string } }>(
    '/api/adventures/:adventureId/backdrops',
    async (request: FastifyRequest<{ Params: { adventureId: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { adventureId } = request.params

      const hasAccess = await requireAdventureOwnership(fastify, adventureId, user.id, reply)
      if (!hasAccess) return

      // Parse multipart
      const parts = request.parts()
      let imageBuffer: Buffer | null = null
      let imageMimetype: string | null = null
      const fields: Record<string, string> = {}

      for await (const part of parts) {
        if (part.type === 'file') {
          if (part.fieldname === 'image') {
            if (!ALLOWED_MIME_TYPES.includes(part.mimetype)) {
              return reply.status(400).send({
                error: 'Bad Request',
                message: 'Invalid file type. Allowed types: JPEG, PNG, WebP',
              })
            }
            imageBuffer = await part.toBuffer()
            imageMimetype = part.mimetype
          }
        } else {
          fields[part.fieldname] = part.value as string
        }
      }

      if (!imageBuffer || !imageMimetype) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Image is required',
        })
      }

      // Validate name
      const name = fields.name?.trim()
      if (!name) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Name is required',
        })
      }
      if (name.length > MAX_NAME_LENGTH) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Name must be ${MAX_NAME_LENGTH} characters or less`,
        })
      }

      // Validate title if provided
      const title = fields.title?.trim() || null
      if (title && title.length > MAX_TITLE_LENGTH) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Title must be ${MAX_TITLE_LENGTH} characters or less`,
        })
      }

      // Validate description if provided
      const description = fields.description?.trim() || null
      if (description && description.length > MAX_DESCRIPTION_LENGTH) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`,
        })
      }

      // Parse coordinate fields
      const focusX = Math.max(0, Math.min(100, parseIntField(fields.focusX, 50)))
      const focusY = Math.max(0, Math.min(100, parseIntField(fields.focusY, 50)))
      const titleX = Math.max(0, Math.min(100, parseIntField(fields.titleX, 50)))
      const titleY = Math.max(0, Math.min(100, parseIntField(fields.titleY, 50)))

      // Create backdrop record first to get ID
      const backdrop = await fastify.prisma.backdrop.create({
        data: {
          name,
          title,
          titleX,
          titleY,
          description,
          imageUrl: '', // Placeholder, will update after upload
          focusX,
          focusY,
          adventureId,
        },
      })

      // Upload image
      const ext = imageMimetype.split('/')[1]
      const key = `backdrops/${backdrop.id}/${crypto.randomBytes(8).toString('hex')}.${ext}`
      const imageUrl = await uploadFile(key, imageBuffer, imageMimetype)

      // Update with actual URL
      const updatedBackdrop = await fastify.prisma.backdrop.update({
        where: { id: backdrop.id },
        data: { imageUrl },
      })

      const response: BackdropResponse = {
        backdrop: formatBackdrop(updatedBackdrop),
      }

      return reply.status(201).send(response)
    }
  )

  // GET /api/adventures/:adventureId/backdrops/:id
  fastify.get<{ Params: { adventureId: string; id: string } }>(
    '/api/adventures/:adventureId/backdrops/:id',
    async (
      request: FastifyRequest<{ Params: { adventureId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { adventureId, id } = request.params

      const hasAccess = await requireAdventureOwnership(fastify, adventureId, user.id, reply)
      if (!hasAccess) return

      const backdrop = await fastify.prisma.backdrop.findUnique({
        where: { id },
      })

      if (!backdrop || backdrop.adventureId !== adventureId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Backdrop not found',
        })
      }

      const response: BackdropResponse = {
        backdrop: formatBackdrop(backdrop),
      }

      return reply.status(200).send(response)
    }
  )

  // PATCH /api/adventures/:adventureId/backdrops/:id
  fastify.patch<{ Params: { adventureId: string; id: string }; Body: UpdateBackdropRequest }>(
    '/api/adventures/:adventureId/backdrops/:id',
    async (
      request: FastifyRequest<{ Params: { adventureId: string; id: string }; Body: UpdateBackdropRequest }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { adventureId, id } = request.params

      const hasAccess = await requireAdventureOwnership(fastify, adventureId, user.id, reply)
      if (!hasAccess) return

      const backdrop = await fastify.prisma.backdrop.findUnique({
        where: { id },
      })

      if (!backdrop || backdrop.adventureId !== adventureId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Backdrop not found',
        })
      }

      const updateData: Record<string, unknown> = {}

      // Name
      if (request.body.name !== undefined) {
        const trimmedName = request.body.name.trim()
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

      // Title
      if (request.body.title !== undefined) {
        if (request.body.title === null) {
          updateData.title = null
        } else {
          const trimmed = request.body.title.trim()
          if (trimmed.length > MAX_TITLE_LENGTH) {
            return reply.status(400).send({
              error: 'Bad Request',
              message: `Title must be ${MAX_TITLE_LENGTH} characters or less`,
            })
          }
          updateData.title = trimmed.length === 0 ? null : trimmed
        }
      }

      // TitleX/TitleY
      if (request.body.titleX !== undefined) {
        updateData.titleX = Math.max(0, Math.min(100, request.body.titleX))
      }
      if (request.body.titleY !== undefined) {
        updateData.titleY = Math.max(0, Math.min(100, request.body.titleY))
      }

      // Description
      if (request.body.description !== undefined) {
        if (request.body.description === null) {
          updateData.description = null
        } else {
          const trimmed = request.body.description.trim()
          if (trimmed.length > MAX_DESCRIPTION_LENGTH) {
            return reply.status(400).send({
              error: 'Bad Request',
              message: `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`,
            })
          }
          updateData.description = trimmed.length === 0 ? null : trimmed
        }
      }

      // FocusX/FocusY
      if (request.body.focusX !== undefined) {
        updateData.focusX = Math.max(0, Math.min(100, request.body.focusX))
      }
      if (request.body.focusY !== undefined) {
        updateData.focusY = Math.max(0, Math.min(100, request.body.focusY))
      }

      const updatedBackdrop = await fastify.prisma.backdrop.update({
        where: { id },
        data: updateData,
      })

      const response: BackdropResponse = {
        backdrop: formatBackdrop(updatedBackdrop),
      }

      return reply.status(200).send(response)
    }
  )

  // DELETE /api/adventures/:adventureId/backdrops/:id
  fastify.delete<{ Params: { adventureId: string; id: string } }>(
    '/api/adventures/:adventureId/backdrops/:id',
    async (
      request: FastifyRequest<{ Params: { adventureId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { adventureId, id } = request.params

      const hasAccess = await requireAdventureOwnership(fastify, adventureId, user.id, reply)
      if (!hasAccess) return

      const backdrop = await fastify.prisma.backdrop.findUnique({
        where: { id },
      })

      if (!backdrop || backdrop.adventureId !== adventureId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Backdrop not found',
        })
      }

      // Delete all images from S3
      try {
        await deleteFolder(`backdrops/${id}`)
      } catch {
        // Continue even if S3 deletion fails
      }

      await fastify.prisma.backdrop.delete({
        where: { id },
      })

      return reply.status(200).send({ success: true })
    }
  )

  // POST /api/adventures/:adventureId/backdrops/:id/image - Replace image
  fastify.post<{ Params: { adventureId: string; id: string } }>(
    '/api/adventures/:adventureId/backdrops/:id/image',
    async (
      request: FastifyRequest<{ Params: { adventureId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { adventureId, id } = request.params

      const hasAccess = await requireAdventureOwnership(fastify, adventureId, user.id, reply)
      if (!hasAccess) return

      const backdrop = await fastify.prisma.backdrop.findUnique({
        where: { id },
      })

      if (!backdrop || backdrop.adventureId !== adventureId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Backdrop not found',
        })
      }

      const data = await request.file()

      if (!data) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'No file uploaded',
        })
      }

      if (!ALLOWED_MIME_TYPES.includes(data.mimetype)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Invalid file type. Allowed types: JPEG, PNG, WebP',
        })
      }

      // Delete old image
      if (backdrop.imageUrl) {
        try {
          const oldKey = extractKeyFromUrl(backdrop.imageUrl)
          if (oldKey) {
            await deleteFile(oldKey)
          }
        } catch {
          // Continue even if deletion fails
        }
      }

      // Upload new image
      const buffer = await data.toBuffer()
      const ext = data.mimetype.split('/')[1]
      const key = `backdrops/${id}/${crypto.randomBytes(8).toString('hex')}.${ext}`
      const imageUrl = await uploadFile(key, buffer, data.mimetype)

      const updatedBackdrop = await fastify.prisma.backdrop.update({
        where: { id },
        data: { imageUrl },
      })

      const response: BackdropResponse = {
        backdrop: formatBackdrop(updatedBackdrop),
      }

      return reply.status(200).send(response)
    }
  )
}
