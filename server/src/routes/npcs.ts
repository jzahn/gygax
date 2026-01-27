import type { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify'
import crypto from 'crypto'
import type {
  NPC,
  NPCListItem,
  Alignment,
  NPCListResponse,
  NPCResponse,
  CreateNPCRequest,
  UpdateNPCRequest,
} from '@gygax/shared'
import { uploadFile, deleteFile, extractKeyFromUrl } from '../services/storage.js'

const MAX_NAME_LENGTH = 100
const MAX_DESCRIPTION_LENGTH = 2000
const MAX_NOTES_LENGTH = 5000
const MAX_EQUIPMENT_LENGTH = 2000
const MAX_SPELLS_LENGTH = 2000
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp']

const VALID_CLASSES = [
  'Fighter',
  'Magic-User',
  'Cleric',
  'Thief',
  'Elf',
  'Dwarf',
  'Halfling',
]

const VALID_ALIGNMENTS: Alignment[] = ['Lawful', 'Neutral', 'Chaotic']

function formatNPC(npc: {
  id: string
  name: string
  description: string | null
  class: string | null
  level: number
  alignment: string | null
  title: string | null
  strength: number | null
  intelligence: number | null
  wisdom: number | null
  dexterity: number | null
  constitution: number | null
  charisma: number | null
  hitPointsMax: number | null
  hitPointsCurrent: number | null
  armorClass: number | null
  saveDeathRay: number | null
  saveWands: number | null
  saveParalysis: number | null
  saveBreath: number | null
  saveSpells: number | null
  experiencePoints: number | null
  goldPieces: number | null
  equipment: string | null
  spells: string | null
  notes: string | null
  avatarUrl: string | null
  adventureId: string
  createdAt: Date
  updatedAt: Date
}): NPC {
  return {
    id: npc.id,
    name: npc.name,
    description: npc.description,
    class: npc.class,
    level: npc.level,
    alignment: npc.alignment as Alignment | null,
    title: npc.title,
    strength: npc.strength,
    intelligence: npc.intelligence,
    wisdom: npc.wisdom,
    dexterity: npc.dexterity,
    constitution: npc.constitution,
    charisma: npc.charisma,
    hitPointsMax: npc.hitPointsMax,
    hitPointsCurrent: npc.hitPointsCurrent,
    armorClass: npc.armorClass,
    saveDeathRay: npc.saveDeathRay,
    saveWands: npc.saveWands,
    saveParalysis: npc.saveParalysis,
    saveBreath: npc.saveBreath,
    saveSpells: npc.saveSpells,
    experiencePoints: npc.experiencePoints,
    goldPieces: npc.goldPieces,
    equipment: npc.equipment,
    spells: npc.spells,
    notes: npc.notes,
    avatarUrl: npc.avatarUrl,
    adventureId: npc.adventureId,
    createdAt: npc.createdAt.toISOString(),
    updatedAt: npc.updatedAt.toISOString(),
  }
}

function formatNPCListItem(npc: {
  id: string
  name: string
  description: string | null
  class: string | null
  level: number
  avatarUrl: string | null
  adventureId: string
  createdAt: Date
  updatedAt: Date
}): NPCListItem {
  return {
    id: npc.id,
    name: npc.name,
    description: npc.description,
    class: npc.class,
    level: npc.level,
    avatarUrl: npc.avatarUrl,
    adventureId: npc.adventureId,
    createdAt: npc.createdAt.toISOString(),
    updatedAt: npc.updatedAt.toISOString(),
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

  if (!adventure) {
    reply.status(404).send({
      error: 'Not Found',
      message: 'Adventure not found',
    })
    return false
  }

  if (adventure.ownerId !== userId) {
    reply.status(404).send({
      error: 'Not Found',
      message: 'Adventure not found',
    })
    return false
  }

  return true
}

function isValidAbilityScore(score: number): boolean {
  return Number.isInteger(score) && score >= 3 && score <= 18
}

export async function npcRoutes(fastify: FastifyInstance) {
  // GET /api/adventures/:adventureId/npcs - List NPCs in an adventure
  fastify.get<{ Params: { adventureId: string } }>(
    '/api/adventures/:adventureId/npcs',
    async (request: FastifyRequest<{ Params: { adventureId: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { adventureId } = request.params

      const hasAccess = await requireAdventureOwnership(fastify, adventureId, user.id, reply)
      if (!hasAccess) return

      const npcs = await fastify.prisma.nPC.findMany({
        where: { adventureId },
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          name: true,
          description: true,
          class: true,
          level: true,
          avatarUrl: true,
          adventureId: true,
          createdAt: true,
          updatedAt: true,
        },
      })

      const response: NPCListResponse = {
        npcs: npcs.map(formatNPCListItem),
      }

      return reply.status(200).send(response)
    }
  )

  // POST /api/adventures/:adventureId/npcs - Create a new NPC
  fastify.post<{ Params: { adventureId: string }; Body: CreateNPCRequest }>(
    '/api/adventures/:adventureId/npcs',
    async (
      request: FastifyRequest<{ Params: { adventureId: string }; Body: CreateNPCRequest }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { adventureId } = request.params

      const hasAccess = await requireAdventureOwnership(fastify, adventureId, user.id, reply)
      if (!hasAccess) return

      const { name, description, class: npcClass, level, alignment, title } = request.body

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

      // Validate description if provided
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

      // Validate class if provided
      if (npcClass !== undefined && npcClass !== null) {
        if (!VALID_CLASSES.includes(npcClass)) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Class must be one of: ${VALID_CLASSES.join(', ')}`,
          })
        }
      }

      // Validate level if provided
      let validLevel = 1
      if (level !== undefined) {
        if (!Number.isInteger(level) || level < 1 || level > 14) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'Level must be an integer between 1 and 14',
          })
        }
        validLevel = level
      }

      // Validate alignment if provided
      if (alignment !== undefined && alignment !== null) {
        if (!VALID_ALIGNMENTS.includes(alignment)) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Alignment must be one of: ${VALID_ALIGNMENTS.join(', ')}`,
          })
        }
      }

      // Validate ability scores if provided
      const abilityFields = ['strength', 'intelligence', 'wisdom', 'dexterity', 'constitution', 'charisma'] as const
      const abilityData: Record<string, number | null> = {}
      for (const field of abilityFields) {
        const value = request.body[field]
        if (value !== undefined) {
          if (!isValidAbilityScore(value)) {
            return reply.status(400).send({
              error: 'Bad Request',
              message: `${field} must be an integer between 3 and 18`,
            })
          }
          abilityData[field] = value
        }
      }

      // Validate combat stats if provided
      const { hitPointsMax, hitPointsCurrent, armorClass } = request.body
      const combatData: Record<string, number | null> = {}

      if (hitPointsMax !== undefined) {
        if (!Number.isInteger(hitPointsMax) || hitPointsMax < 0) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'hitPointsMax must be a non-negative integer',
          })
        }
        combatData.hitPointsMax = hitPointsMax
      }

      if (hitPointsCurrent !== undefined) {
        if (!Number.isInteger(hitPointsCurrent)) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'hitPointsCurrent must be an integer',
          })
        }
        combatData.hitPointsCurrent = hitPointsCurrent
      }

      if (armorClass !== undefined) {
        if (!Number.isInteger(armorClass)) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'armorClass must be an integer',
          })
        }
        combatData.armorClass = armorClass
      }

      // Validate saving throws if provided
      const saveFields = ['saveDeathRay', 'saveWands', 'saveParalysis', 'saveBreath', 'saveSpells'] as const
      const saveData: Record<string, number | null> = {}
      for (const field of saveFields) {
        const value = request.body[field]
        if (value !== undefined) {
          if (!Number.isInteger(value) || value < 1) {
            return reply.status(400).send({
              error: 'Bad Request',
              message: `${field} must be a positive integer`,
            })
          }
          saveData[field] = value
        }
      }

      // Validate resources if provided
      const { experiencePoints, goldPieces } = request.body
      const resourceData: Record<string, number | null> = {}

      if (experiencePoints !== undefined) {
        if (!Number.isInteger(experiencePoints) || experiencePoints < 0) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'experiencePoints must be a non-negative integer',
          })
        }
        resourceData.experiencePoints = experiencePoints
      }

      if (goldPieces !== undefined) {
        if (!Number.isInteger(goldPieces) || goldPieces < 0) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'goldPieces must be a non-negative integer',
          })
        }
        resourceData.goldPieces = goldPieces
      }

      // Validate text fields if provided
      const { equipment, spells, notes } = request.body
      const textData: Record<string, string | null> = {}

      if (equipment !== undefined) {
        if (equipment !== null && equipment.length > MAX_EQUIPMENT_LENGTH) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Equipment must be ${MAX_EQUIPMENT_LENGTH} characters or less`,
          })
        }
        textData.equipment = equipment || null
      }

      if (spells !== undefined) {
        if (spells !== null && spells.length > MAX_SPELLS_LENGTH) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Spells must be ${MAX_SPELLS_LENGTH} characters or less`,
          })
        }
        textData.spells = spells || null
      }

      if (notes !== undefined) {
        if (notes !== null && notes.length > MAX_NOTES_LENGTH) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Notes must be ${MAX_NOTES_LENGTH} characters or less`,
          })
        }
        textData.notes = notes || null
      }

      const npc = await fastify.prisma.nPC.create({
        data: {
          name: trimmedName,
          description: trimmedDescription,
          class: npcClass || null,
          level: validLevel,
          alignment: alignment || null,
          title: title || null,
          adventureId,
          ...abilityData,
          ...combatData,
          ...saveData,
          ...resourceData,
          ...textData,
        },
      })

      const response: NPCResponse = {
        npc: formatNPC(npc),
      }

      return reply.status(201).send(response)
    }
  )

  // GET /api/npcs/:id - Get a single NPC
  fastify.get<{ Params: { id: string } }>(
    '/api/npcs/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const npc = await fastify.prisma.nPC.findUnique({
        where: { id },
        include: { adventure: { select: { ownerId: true } } },
      })

      if (!npc) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'NPC not found',
        })
      }

      if (npc.adventure.ownerId !== user.id) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'NPC not found',
        })
      }

      const response: NPCResponse = {
        npc: formatNPC(npc),
      }

      return reply.status(200).send(response)
    }
  )

  // PATCH /api/npcs/:id - Update an NPC
  fastify.patch<{ Params: { id: string }; Body: UpdateNPCRequest }>(
    '/api/npcs/:id',
    async (
      request: FastifyRequest<{ Params: { id: string }; Body: UpdateNPCRequest }>,
      reply: FastifyReply
    ) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const npc = await fastify.prisma.nPC.findUnique({
        where: { id },
        include: { adventure: { select: { ownerId: true } } },
      })

      if (!npc) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'NPC not found',
        })
      }

      if (npc.adventure.ownerId !== user.id) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'NPC not found',
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

      // Class
      if (request.body.class !== undefined) {
        if (request.body.class === null) {
          updateData.class = null
        } else if (!VALID_CLASSES.includes(request.body.class)) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Class must be one of: ${VALID_CLASSES.join(', ')}`,
          })
        } else {
          updateData.class = request.body.class
        }
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
        if (request.body.alignment === null) {
          updateData.alignment = null
        } else if (!VALID_ALIGNMENTS.includes(request.body.alignment)) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: `Alignment must be one of: ${VALID_ALIGNMENTS.join(', ')}`,
          })
        } else {
          updateData.alignment = request.body.alignment
        }
      }

      // Title
      if (request.body.title !== undefined) {
        updateData.title = request.body.title
      }

      // Ability scores
      const abilityFields = ['strength', 'intelligence', 'wisdom', 'dexterity', 'constitution', 'charisma'] as const
      for (const field of abilityFields) {
        if (request.body[field] !== undefined) {
          if (request.body[field] === null) {
            updateData[field] = null
          } else if (!isValidAbilityScore(request.body[field]!)) {
            return reply.status(400).send({
              error: 'Bad Request',
              message: `${field} must be an integer between 3 and 18`,
            })
          } else {
            updateData[field] = request.body[field]
          }
        }
      }

      // Combat stats
      if (request.body.hitPointsMax !== undefined) {
        if (request.body.hitPointsMax === null) {
          updateData.hitPointsMax = null
        } else if (!Number.isInteger(request.body.hitPointsMax) || request.body.hitPointsMax < 0) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'hitPointsMax must be a non-negative integer',
          })
        } else {
          updateData.hitPointsMax = request.body.hitPointsMax
        }
      }

      if (request.body.hitPointsCurrent !== undefined) {
        if (request.body.hitPointsCurrent === null) {
          updateData.hitPointsCurrent = null
        } else if (!Number.isInteger(request.body.hitPointsCurrent)) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'hitPointsCurrent must be an integer',
          })
        } else {
          updateData.hitPointsCurrent = request.body.hitPointsCurrent
        }
      }

      if (request.body.armorClass !== undefined) {
        if (request.body.armorClass === null) {
          updateData.armorClass = null
        } else if (!Number.isInteger(request.body.armorClass)) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'armorClass must be an integer',
          })
        } else {
          updateData.armorClass = request.body.armorClass
        }
      }

      // Saving throws
      const saveFields = ['saveDeathRay', 'saveWands', 'saveParalysis', 'saveBreath', 'saveSpells'] as const
      for (const field of saveFields) {
        if (request.body[field] !== undefined) {
          if (request.body[field] === null) {
            updateData[field] = null
          } else if (!Number.isInteger(request.body[field]) || request.body[field]! < 1) {
            return reply.status(400).send({
              error: 'Bad Request',
              message: `${field} must be a positive integer`,
            })
          } else {
            updateData[field] = request.body[field]
          }
        }
      }

      // Resources
      if (request.body.experiencePoints !== undefined) {
        if (request.body.experiencePoints === null) {
          updateData.experiencePoints = null
        } else if (!Number.isInteger(request.body.experiencePoints) || request.body.experiencePoints < 0) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'experiencePoints must be a non-negative integer',
          })
        } else {
          updateData.experiencePoints = request.body.experiencePoints
        }
      }

      if (request.body.goldPieces !== undefined) {
        if (request.body.goldPieces === null) {
          updateData.goldPieces = null
        } else if (!Number.isInteger(request.body.goldPieces) || request.body.goldPieces < 0) {
          return reply.status(400).send({
            error: 'Bad Request',
            message: 'goldPieces must be a non-negative integer',
          })
        } else {
          updateData.goldPieces = request.body.goldPieces
        }
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

      const updatedNpc = await fastify.prisma.nPC.update({
        where: { id },
        data: updateData,
      })

      const response: NPCResponse = {
        npc: formatNPC(updatedNpc),
      }

      return reply.status(200).send(response)
    }
  )

  // DELETE /api/npcs/:id - Delete an NPC
  fastify.delete<{ Params: { id: string } }>(
    '/api/npcs/:id',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const npc = await fastify.prisma.nPC.findUnique({
        where: { id },
        include: { adventure: { select: { ownerId: true } } },
      })

      if (!npc) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'NPC not found',
        })
      }

      if (npc.adventure.ownerId !== user.id) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'NPC not found',
        })
      }

      // Delete avatar from storage if exists
      if (npc.avatarUrl) {
        try {
          const key = extractKeyFromUrl(npc.avatarUrl)
          if (key) {
            await deleteFile(key)
          }
        } catch {
          // Continue even if avatar deletion fails
        }
      }

      await fastify.prisma.nPC.delete({
        where: { id },
      })

      return reply.status(200).send({ success: true })
    }
  )

  // POST /api/npcs/:id/avatar - Upload avatar
  fastify.post<{ Params: { id: string } }>(
    '/api/npcs/:id/avatar',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const npc = await fastify.prisma.nPC.findUnique({
        where: { id },
        include: { adventure: { select: { ownerId: true } } },
      })

      if (!npc) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'NPC not found',
        })
      }

      if (npc.adventure.ownerId !== user.id) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'NPC not found',
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
      if (npc.avatarUrl) {
        try {
          const oldKey = extractKeyFromUrl(npc.avatarUrl)
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
      const key = `npcs/${id}/avatar-${crypto.randomBytes(8).toString('hex')}.${ext}`

      const avatarUrl = await uploadFile(key, buffer, data.mimetype)

      const updatedNpc = await fastify.prisma.nPC.update({
        where: { id },
        data: { avatarUrl },
      })

      const response: NPCResponse = {
        npc: formatNPC(updatedNpc),
      }

      return reply.status(200).send(response)
    }
  )

  // DELETE /api/npcs/:id/avatar - Remove avatar
  fastify.delete<{ Params: { id: string } }>(
    '/api/npcs/:id/avatar',
    async (request: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
      const user = await requireVerifiedUser(fastify, request, reply)
      if (!user) return

      const { id } = request.params

      const npc = await fastify.prisma.nPC.findUnique({
        where: { id },
        include: { adventure: { select: { ownerId: true } } },
      })

      if (!npc) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'NPC not found',
        })
      }

      if (npc.adventure.ownerId !== user.id) {
        return reply.status(404).send({
          error: 'Not Found',
          message: 'NPC not found',
        })
      }

      if (!npc.avatarUrl) {
        return reply.status(400).send({
          error: 'Bad Request',
          message: 'NPC does not have an avatar',
        })
      }

      // Delete from storage
      try {
        const key = extractKeyFromUrl(npc.avatarUrl)
        if (key) {
          await deleteFile(key)
        }
      } catch {
        // Continue even if deletion fails
      }

      const updatedNpc = await fastify.prisma.nPC.update({
        where: { id },
        data: { avatarUrl: null },
      })

      const response: NPCResponse = {
        npc: formatNPC(updatedNpc),
      }

      return reply.status(200).send(response)
    }
  )
}
