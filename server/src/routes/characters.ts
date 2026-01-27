import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import crypto from 'crypto'
import type {
  Character,
  CharacterClass,
  Alignment,
  CharacterListResponse,
  CharacterResponse,
  CreateCharacterRequest,
  UpdateCharacterRequest,
} from '@gygax/shared'
import { uploadFile, deleteFile, extractKeyFromUrl } from '../services/storage.js'

const MAX_NAME_LENGTH = 100
const MAX_NOTES_LENGTH = 5000
const MAX_EQUIPMENT_LENGTH = 2000
const MAX_SPELLS_LENGTH = 2000
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const VALID_CLASSES: CharacterClass[] = [
  'Fighter',
  'Magic-User',
  'Cleric',
  'Thief',
  'Elf',
  'Dwarf',
  'Halfling',
]

const VALID_ALIGNMENTS: Alignment[] = ['Lawful', 'Neutral', 'Chaotic']

function formatCharacter(character: {
  id: string
  name: string
  class: string
  level: number
  alignment: string | null
  title: string | null
  strength: number
  intelligence: number
  wisdom: number
  dexterity: number
  constitution: number
  charisma: number
  hitPointsMax: number
  hitPointsCurrent: number
  armorClass: number
  saveDeathRay: number
  saveWands: number
  saveParalysis: number
  saveBreath: number
  saveSpells: number
  experiencePoints: number
  goldPieces: number
  equipment: string | null
  spells: string | null
  notes: string | null
  avatarUrl: string | null
  createdAt: Date
  updatedAt: Date
}): Character {
  return {
    id: character.id,
    name: character.name,
    class: character.class as CharacterClass,
    level: character.level,
    alignment: character.alignment as Alignment | null,
    title: character.title,
    strength: character.strength,
    intelligence: character.intelligence,
    wisdom: character.wisdom,
    dexterity: character.dexterity,
    constitution: character.constitution,
    charisma: character.charisma,
    hitPointsMax: character.hitPointsMax,
    hitPointsCurrent: character.hitPointsCurrent,
    armorClass: character.armorClass,
    saveDeathRay: character.saveDeathRay,
    saveWands: character.saveWands,
    saveParalysis: character.saveParalysis,
    saveBreath: character.saveBreath,
    saveSpells: character.saveSpells,
    experiencePoints: character.experiencePoints,
    goldPieces: character.goldPieces,
    equipment: character.equipment,
    spells: character.spells,
    notes: character.notes,
    avatarUrl: character.avatarUrl,
    createdAt: character.createdAt.toISOString(),
    updatedAt: character.updatedAt.toISOString(),
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

function isValidAbilityScore(score: number): boolean {
  return Number.isInteger(score) && score >= 3 && score <= 18
}

export async function characterRoutes(fastify: FastifyInstance) {
  // GET /api/characters - List user's characters
  fastify.get('/api/characters', async (request: FastifyRequest, reply: FastifyReply) => {
    const user = await requireVerifiedUser(fastify, request, reply)
    if (!user) return

    const characters = await fastify.prisma.character.findMany({
      where: { ownerId: user.id },
      orderBy: { updatedAt: 'desc' },
    })

    const response: CharacterListResponse = {
      characters: characters.map(formatCharacter),
    }

    return reply.status(200).send(response)
  })

  // POST /api/characters - Create character
  fastify.post<{ Body: CreateCharacterRequest }>(
    '/api/characters',
    async (request: FastifyRequest<{ Body: CreateCharacterRequest }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { name, class: charClass, strength, intelligence, wisdom, dexterity, constitution, charisma } = request.body

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

      // Validate class
      if (!charClass || !VALID_CLASSES.includes(charClass)) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: `Class must be one of: ${VALID_CLASSES.join(', ')}`,
        })
      }

      // Validate ability scores if provided
      const abilityScores = { strength, intelligence, wisdom, dexterity, constitution, charisma }
      for (const [key, value] of Object.entries(abilityScores)) {
        if (value !== undefined) {
          if (!isValidAbilityScore(value)) {
            return reply.status(400).send({
              error: 'Bad Request',
              message: `${key} must be an integer between 3 and 18`,
            })
          }
        }
      }

      const character = await fastify.prisma.character.create({
        data: {
          name: trimmedName,
          class: charClass,
          strength: strength ?? 10,
          intelligence: intelligence ?? 10,
          wisdom: wisdom ?? 10,
          dexterity: dexterity ?? 10,
          constitution: constitution ?? 10,
          charisma: charisma ?? 10,
          ownerId: user.id,
        },
      })

      const response: CharacterResponse = {
        character: formatCharacter(character),
      }

      return reply.status(201).send(response)
    }
  )

  // GET /api/characters/:id - Get single character
  fastify.get<{ Params: { id: string } }>(
    '/api/characters/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const character = await fastify.prisma.character.findUnique({
        where: { id },
      })

      if (!character) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Character not found',
        })
      }

      if (character.ownerId !== user.id) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Not authorized to view this character',
        })
      }

      const response: CharacterResponse = {
        character: formatCharacter(character),
      }

      return reply.status(200).send(response)
    }
  )

  // PATCH /api/characters/:id - Update character
  fastify.patch<{ Params: { id: string }; Body: UpdateCharacterRequest }>(
    '/api/characters/:id',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateCharacterRequest }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const character = await fastify.prisma.character.findUnique({
        where: { id },
      })

      if (!character) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Character not found',
        })
      }

      if (character.ownerId !== user.id) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Not authorized to update this character',
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

      // Class
      if (request.body.class !== undefined) {
        if (!VALID_CLASSES.includes(request.body.class)) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Class must be one of: ${VALID_CLASSES.join(', ')}`,
          })
        }
        updateData.class = request.body.class
      }

      // Level
      if (request.body.level !== undefined) {
        if (!Number.isInteger(request.body.level) || request.body.level < 1 || request.body.level > 14) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Level must be an integer between 1 and 14',
          })
        }
        updateData.level = request.body.level
      }

      // Alignment
      if (request.body.alignment !== undefined) {
        if (request.body.alignment !== null && !VALID_ALIGNMENTS.includes(request.body.alignment)) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Alignment must be one of: ${VALID_ALIGNMENTS.join(', ')}`,
          })
        }
        updateData.alignment = request.body.alignment
      }

      // Title
      if (request.body.title !== undefined) {
        updateData.title = request.body.title
      }

      // Ability scores
      const abilityFields = ['strength', 'intelligence', 'wisdom', 'dexterity', 'constitution', 'charisma'] as const
      for (const field of abilityFields) {
        if (request.body[field] !== undefined) {
          if (!isValidAbilityScore(request.body[field]!)) {
            return reply.status(400).send({
              error: 'Bad Request',
              message: `${field} must be an integer between 3 and 18`,
            })
          }
          updateData[field] = request.body[field]
        }
      }

      // Combat stats
      if (request.body.hitPointsMax !== undefined) {
        if (!Number.isInteger(request.body.hitPointsMax) || request.body.hitPointsMax < 0) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'hitPointsMax must be a non-negative integer',
          })
        }
        updateData.hitPointsMax = request.body.hitPointsMax
      }

      if (request.body.hitPointsCurrent !== undefined) {
        if (!Number.isInteger(request.body.hitPointsCurrent)) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'hitPointsCurrent must be an integer',
          })
        }
        updateData.hitPointsCurrent = request.body.hitPointsCurrent
      }

      if (request.body.armorClass !== undefined) {
        if (!Number.isInteger(request.body.armorClass)) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'armorClass must be an integer',
          })
        }
        updateData.armorClass = request.body.armorClass
      }

      // Saving throws
      const saveFields = ['saveDeathRay', 'saveWands', 'saveParalysis', 'saveBreath', 'saveSpells'] as const
      for (const field of saveFields) {
        if (request.body[field] !== undefined) {
          if (!Number.isInteger(request.body[field]) || request.body[field]! < 1) {
            return reply.status(400).send({
              error: 'Bad Request',
              message: `${field} must be a positive integer`,
            })
          }
          updateData[field] = request.body[field]
        }
      }

      // Resources
      if (request.body.experiencePoints !== undefined) {
        if (!Number.isInteger(request.body.experiencePoints) || request.body.experiencePoints < 0) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'experiencePoints must be a non-negative integer',
          })
        }
        updateData.experiencePoints = request.body.experiencePoints
      }

      if (request.body.goldPieces !== undefined) {
        if (!Number.isInteger(request.body.goldPieces) || request.body.goldPieces < 0) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'goldPieces must be a non-negative integer',
          })
        }
        updateData.goldPieces = request.body.goldPieces
      }

      // Freeform text fields
      if (request.body.equipment !== undefined) {
        if (request.body.equipment !== null && request.body.equipment.length > MAX_EQUIPMENT_LENGTH) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Equipment must be ${MAX_EQUIPMENT_LENGTH} characters or less`,
          })
        }
        updateData.equipment = request.body.equipment
      }

      if (request.body.spells !== undefined) {
        if (request.body.spells !== null && request.body.spells.length > MAX_SPELLS_LENGTH) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Spells must be ${MAX_SPELLS_LENGTH} characters or less`,
          })
        }
        updateData.spells = request.body.spells
      }

      if (request.body.notes !== undefined) {
        if (request.body.notes !== null && request.body.notes.length > MAX_NOTES_LENGTH) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Notes must be ${MAX_NOTES_LENGTH} characters or less`,
          })
        }
        updateData.notes = request.body.notes
      }

      const updatedCharacter = await fastify.prisma.character.update({
        where: { id },
        data: updateData,
      })

      const response: CharacterResponse = {
        character: formatCharacter(updatedCharacter),
      }

      return reply.status(200).send(response)
    }
  )

  // DELETE /api/characters/:id - Delete character
  fastify.delete<{ Params: { id: string } }>(
    '/api/characters/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const character = await fastify.prisma.character.findUnique({
        where: { id },
      })

      if (!character) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Character not found',
        })
      }

      if (character.ownerId !== user.id) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Not authorized to delete this character',
        })
      }

      // Delete avatar from storage if exists
      if (character.avatarUrl) {
        try {
          const key = extractKeyFromUrl(character.avatarUrl)
          if (key) {
            await deleteFile(key)
          }
        } catch {
          // Continue even if avatar deletion fails
        }
      }

      await fastify.prisma.character.delete({
        where: { id },
      })

      return reply.status(200).send({ success: true })
    }
  )

  // POST /api/characters/:id/avatar - Upload avatar
  fastify.post<{ Params: { id: string } }>(
    '/api/characters/:id/avatar',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const character = await fastify.prisma.character.findUnique({
        where: { id },
      })

      if (!character) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Character not found',
        })
      }

      if (character.ownerId !== user.id) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Not authorized to update this character',
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

      // Delete old avatar if exists
      if (character.avatarUrl) {
        try {
          const oldKey = extractKeyFromUrl(character.avatarUrl)
          if (oldKey) {
            await deleteFile(oldKey)
          }
        } catch {
          // Continue even if deletion fails
        }
      }

      // Upload new avatar
      const buffer = await data.toBuffer()
      const ext = data.mimetype.split('/')[1]
      const key = `characters/${id}/avatar-${crypto.randomBytes(8).toString('hex')}.${ext}`

      const avatarUrl = await uploadFile(key, buffer, data.mimetype)

      const updatedCharacter = await fastify.prisma.character.update({
        where: { id },
        data: { avatarUrl },
      })

      const response: CharacterResponse = {
        character: formatCharacter(updatedCharacter),
      }

      return reply.status(200).send(response)
    }
  )

  // DELETE /api/characters/:id/avatar - Remove avatar
  fastify.delete<{ Params: { id: string } }>(
    '/api/characters/:id/avatar',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const character = await fastify.prisma.character.findUnique({
        where: { id },
      })

      if (!character) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'Character not found',
        })
      }

      if (character.ownerId !== user.id) {
        return reply.status(403).send({
          error: 'Forbidden',
          message: 'Not authorized to update this character',
        })
      }

      if (!character.avatarUrl) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'Character does not have an avatar',
        })
      }

      // Delete from storage
      try {
        const key = extractKeyFromUrl(character.avatarUrl)
        if (key) {
          await deleteFile(key)
        }
      } catch {
        // Continue even if deletion fails
      }

      const updatedCharacter = await fastify.prisma.character.update({
        where: { id },
        data: { avatarUrl: null },
      })

      const response: CharacterResponse = {
        character: formatCharacter(updatedCharacter),
      }

      return reply.status(200).send(response)
    }
  )
}
