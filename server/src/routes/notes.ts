import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import type {
  Note,
  NoteListResponse,
  NoteResponse,
  CreateNoteRequest,
  UpdateNoteRequest,
} from '@gygax/shared'

const MAX_TITLE_LENGTH = 200
const MAX_CONTENT_LENGTH = 10000

function formatNote(note: {
  id: string
  title: string
  content: string | null
  adventureId: string
  createdAt: Date
  updatedAt: Date
}): Note {
  return {
    id: note.id,
    title: note.title,
    content: note.content,
    adventureId: note.adventureId,
    createdAt: note.createdAt.toISOString(),
    updatedAt: note.updatedAt.toISOString(),
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

export async function noteRoutes(fastify: FastifyInstance) {
  // GET /api/adventures/:adventureId/notes
  fastify.get<{ Params: { adventureId: string } }>(
    '/api/adventures/:adventureId/notes',
    async (request: FastifyRequest<{ Params: { adventureId: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { adventureId } = request.params

      const hasAccess = await requireAdventureOwnership(fastify, adventureId, user.id, reply)
      if (!hasAccess) return

      const notes = await fastify.prisma.note.findMany({
        where: { adventureId },
        orderBy: { updatedAt: 'desc' },
      })

      const response: NoteListResponse = {
        notes: notes.map(formatNote),
      }

      return reply.status(200).send(response)
    }
  )

  // POST /api/adventures/:adventureId/notes
  fastify.post<{ Params: { adventureId: string }; Body: CreateNoteRequest }>(
    '/api/adventures/:adventureId/notes',
    async (
      request: FastifyRequest<{ Params: { adventureId: string }; Body: CreateNoteRequest }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { adventureId } = request.params

      const hasAccess = await requireAdventureOwnership(fastify, adventureId, user.id, reply)
      if (!hasAccess) return

      const title = request.body.title?.trim()
      if (!title) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Title is required',
        })
      }
      if (title.length > MAX_TITLE_LENGTH) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Title must be ${MAX_TITLE_LENGTH} characters or less`,
        })
      }

      const content = request.body.content?.trim() || null
      if (content && content.length > MAX_CONTENT_LENGTH) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Content must be ${MAX_CONTENT_LENGTH} characters or less`,
        })
      }

      const note = await fastify.prisma.note.create({
        data: {
          title,
          content,
          adventureId,
        },
      })

      const response: NoteResponse = {
        note: formatNote(note),
      }

      return reply.status(201).send(response)
    }
  )

  // GET /api/adventures/:adventureId/notes/:id
  fastify.get<{ Params: { adventureId: string; id: string } }>(
    '/api/adventures/:adventureId/notes/:id',
    async (
      request: FastifyRequest<{ Params: { adventureId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { adventureId, id } = request.params

      const hasAccess = await requireAdventureOwnership(fastify, adventureId, user.id, reply)
      if (!hasAccess) return

      const note = await fastify.prisma.note.findUnique({
        where: { id },
      })

      if (!note || note.adventureId !== adventureId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Note not found',
        })
      }

      const response: NoteResponse = {
        note: formatNote(note),
      }

      return reply.status(200).send(response)
    }
  )

  // PATCH /api/adventures/:adventureId/notes/:id
  fastify.patch<{ Params: { adventureId: string; id: string }; Body: UpdateNoteRequest }>(
    '/api/adventures/:adventureId/notes/:id',
    async (
      request: FastifyRequest<{ Params: { adventureId: string; id: string }; Body: UpdateNoteRequest }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { adventureId, id } = request.params

      const hasAccess = await requireAdventureOwnership(fastify, adventureId, user.id, reply)
      if (!hasAccess) return

      const note = await fastify.prisma.note.findUnique({
        where: { id },
      })

      if (!note || note.adventureId !== adventureId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Note not found',
        })
      }

      const updateData: Record<string, unknown> = {}

      if (request.body.title !== undefined) {
        const trimmedTitle = request.body.title.trim()
        if (trimmedTitle.length === 0) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Title cannot be empty',
          })
        }
        if (trimmedTitle.length > MAX_TITLE_LENGTH) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Title must be ${MAX_TITLE_LENGTH} characters or less`,
          })
        }
        updateData.title = trimmedTitle
      }

      if (request.body.content !== undefined) {
        if (request.body.content === null) {
          updateData.content = null
        } else {
          const trimmed = request.body.content.trim()
          if (trimmed.length > MAX_CONTENT_LENGTH) {
            return reply.status(400).send({
              error: 'Bad Request',
              message: `Content must be ${MAX_CONTENT_LENGTH} characters or less`,
            })
          }
          updateData.content = trimmed.length === 0 ? null : trimmed
        }
      }

      const updatedNote = await fastify.prisma.note.update({
        where: { id },
        data: updateData,
      })

      const response: NoteResponse = {
        note: formatNote(updatedNote),
      }

      return reply.status(200).send(response)
    }
  )

  // DELETE /api/adventures/:adventureId/notes/:id
  fastify.delete<{ Params: { adventureId: string; id: string } }>(
    '/api/adventures/:adventureId/notes/:id',
    async (
      request: FastifyRequest<{ Params: { adventureId: string; id: string } }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { adventureId, id } = request.params

      const hasAccess = await requireAdventureOwnership(fastify, adventureId, user.id, reply)
      if (!hasAccess) return

      const note = await fastify.prisma.note.findUnique({
        where: { id },
      })

      if (!note || note.adventureId !== adventureId) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Note not found',
        })
      }

      await fastify.prisma.note.delete({
        where: { id },
      })

      return reply.status(200).send({ success: true })
    }
  )
}
