import type { PrismaClient, SessionTokenType as PrismaTokenType } from '../../prisma/generated/prisma/index.js'
import type { CellCoord, SessionToken, SessionTokenType } from '@gygax/shared'

// Default colors by type
const DEFAULT_COLORS: Record<SessionTokenType, string> = {
  PC: '#22c55e',      // green-500
  NPC: '#3b82f6',     // blue-500
  MONSTER: '#ef4444', // red-500
  PARTY: '#f59e0b',   // amber-500
}

// Format a token from database to API response
function formatToken(token: {
  id: string
  sessionId: string
  mapId: string
  type: PrismaTokenType
  name: string
  position: unknown
  imageUrl: string | null
  characterId: string | null
  npcId: string | null
  monsterId: string | null
  imageHotspotX: number | null
  imageHotspotY: number | null
  color: string
}): SessionToken {
  return {
    id: token.id,
    sessionId: token.sessionId,
    mapId: token.mapId,
    type: token.type as SessionTokenType,
    name: token.name,
    position: token.position as CellCoord,
    imageUrl: token.imageUrl ?? undefined,
    characterId: token.characterId ?? undefined,
    npcId: token.npcId ?? undefined,
    monsterId: token.monsterId ?? undefined,
    imageHotspotX: token.imageHotspotX ?? undefined,
    imageHotspotY: token.imageHotspotY ?? undefined,
    color: token.color,
  }
}

// Get all tokens for a map in a session
export async function getTokensForMap(
  prisma: PrismaClient,
  sessionId: string,
  mapId: string
): Promise<SessionToken[]> {
  const tokens = await prisma.sessionToken.findMany({
    where: {
      sessionId,
      mapId,
    },
    orderBy: { createdAt: 'asc' },
  })

  return tokens.map(formatToken)
}

// Place a new token
export async function placeToken(
  prisma: PrismaClient,
  sessionId: string,
  mapId: string,
  type: SessionTokenType,
  name: string,
  position: CellCoord,
  options: {
    characterId?: string
    npcId?: string
    monsterId?: string
    color?: string
    imageUrl?: string
    imageHotspotX?: number
    imageHotspotY?: number
  } = {}
): Promise<SessionToken | null> {
  // PARTY tokens: only one per map
  if (type === 'PARTY') {
    const existing = await prisma.sessionToken.findFirst({
      where: { sessionId, mapId, type: 'PARTY' },
    })
    if (existing) {
      return null // Duplicate party token rejected
    }
  }

  const token = await prisma.sessionToken.create({
    data: {
      sessionId,
      mapId,
      type: type as PrismaTokenType,
      name,
      position,
      characterId: options.characterId,
      npcId: options.npcId,
      monsterId: options.monsterId,
      color: options.color ?? DEFAULT_COLORS[type],
      imageUrl: options.imageUrl,
      imageHotspotX: options.imageHotspotX,
      imageHotspotY: options.imageHotspotY,
    },
  })

  return formatToken(token)
}

// Move a token to a new position
export async function moveToken(
  prisma: PrismaClient,
  tokenId: string,
  position: CellCoord
): Promise<SessionToken | null> {
  const token = await prisma.sessionToken.update({
    where: { id: tokenId },
    data: { position },
  })

  return formatToken(token)
}

// Remove a token
export async function removeToken(
  prisma: PrismaClient,
  tokenId: string
): Promise<boolean> {
  try {
    await prisma.sessionToken.delete({
      where: { id: tokenId },
    })
    return true
  } catch {
    return false
  }
}

// Get a single token by ID
export async function getTokenById(
  prisma: PrismaClient,
  tokenId: string
): Promise<SessionToken | null> {
  const token = await prisma.sessionToken.findUnique({
    where: { id: tokenId },
  })

  return token ? formatToken(token) : null
}

// Verify a token belongs to a session
export async function tokenBelongsToSession(
  prisma: PrismaClient,
  tokenId: string,
  sessionId: string
): Promise<boolean> {
  const token = await prisma.sessionToken.findUnique({
    where: { id: tokenId },
    select: { sessionId: true },
  })

  return token?.sessionId === sessionId
}
