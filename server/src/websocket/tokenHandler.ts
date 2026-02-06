import type { FastifyInstance } from 'fastify'
import type {
  WSMessage,
  WSTokenPlace,
  WSTokenMove,
  WSTokenRemove,
} from '@gygax/shared'
import { getUserInSession, broadcastToSession, sendToUser } from './sessionManager.js'
import {
  getTokensForMap,
  placeToken,
  moveToken,
  removeToken,
  tokenBelongsToSession,
} from '../services/tokenService.js'

// Handle token-related WebSocket messages
// Returns true if the message was handled, false otherwise
export async function handleTokenMessage(
  fastify: FastifyInstance,
  sessionId: string,
  userId: string,
  message: WSMessage
): Promise<boolean> {
  switch (message.type) {
    case 'token:place':
      await handleTokenPlace(fastify, sessionId, userId, message.payload as WSTokenPlace)
      return true

    case 'token:move':
      await handleTokenMove(fastify, sessionId, userId, message.payload as WSTokenMove)
      return true

    case 'token:remove':
      await handleTokenRemove(fastify, sessionId, userId, message.payload as WSTokenRemove)
      return true

    case 'token:get-state':
      await handleTokenGetState(fastify, sessionId, userId, message.payload as { mapId: string })
      return true

    default:
      return false
  }
}

// Handle token:place message
async function handleTokenPlace(
  fastify: FastifyInstance,
  sessionId: string,
  userId: string,
  payload: WSTokenPlace
): Promise<void> {
  // Validate DM role
  const user = getUserInSession(sessionId, userId)
  if (user?.role !== 'dm') {
    sendToUser(sessionId, userId, {
      type: 'error',
      payload: { message: 'Only the DM can place tokens' },
    })
    return
  }

  const { mapId, type, name, position, characterId, npcId, monsterId, color, imageUrl, imageHotspotX, imageHotspotY } = payload

  // Validate required fields
  if (!mapId || !type || !name || !position) {
    sendToUser(sessionId, userId, {
      type: 'error',
      payload: { message: 'Missing required token fields' },
    })
    return
  }

  // Create the token
  const token = await placeToken(fastify.prisma, sessionId, mapId, type, name, position, {
    characterId,
    npcId,
    monsterId,
    color,
    imageUrl,
    imageHotspotX,
    imageHotspotY,
  })

  if (!token) {
    sendToUser(sessionId, userId, {
      type: 'error',
      payload: { message: 'Could not place token (party token may already exist on this map)' },
    })
    return
  }

  // Broadcast to all session participants
  broadcastToSession(sessionId, {
    type: 'token:placed',
    payload: { token },
  })
}

// Handle token:move message
async function handleTokenMove(
  fastify: FastifyInstance,
  sessionId: string,
  userId: string,
  payload: WSTokenMove
): Promise<void> {
  // Validate DM role
  const user = getUserInSession(sessionId, userId)
  if (user?.role !== 'dm') {
    sendToUser(sessionId, userId, {
      type: 'error',
      payload: { message: 'Only the DM can move tokens' },
    })
    return
  }

  const { tokenId, position } = payload

  // Validate token exists and belongs to this session
  const belongsToSession = await tokenBelongsToSession(fastify.prisma, tokenId, sessionId)
  if (!belongsToSession) {
    sendToUser(sessionId, userId, {
      type: 'error',
      payload: { message: 'Token not found' },
    })
    return
  }

  // Move the token
  const token = await moveToken(fastify.prisma, tokenId, position)

  if (token) {
    // Broadcast to all session participants
    broadcastToSession(sessionId, {
      type: 'token:moved',
      payload: { tokenId, position },
    })
  }
}

// Handle token:remove message
async function handleTokenRemove(
  fastify: FastifyInstance,
  sessionId: string,
  userId: string,
  payload: WSTokenRemove
): Promise<void> {
  // Validate DM role
  const user = getUserInSession(sessionId, userId)
  if (user?.role !== 'dm') {
    sendToUser(sessionId, userId, {
      type: 'error',
      payload: { message: 'Only the DM can remove tokens' },
    })
    return
  }

  const { tokenId } = payload

  // Validate token exists and belongs to this session
  const belongsToSession = await tokenBelongsToSession(fastify.prisma, tokenId, sessionId)
  if (!belongsToSession) {
    sendToUser(sessionId, userId, {
      type: 'error',
      payload: { message: 'Token not found' },
    })
    return
  }

  // Remove the token
  const success = await removeToken(fastify.prisma, tokenId)

  if (success) {
    // Broadcast to all session participants
    broadcastToSession(sessionId, {
      type: 'token:removed',
      payload: { tokenId },
    })
  }
}

// Handle token:get-state message (send all tokens for a map)
async function handleTokenGetState(
  fastify: FastifyInstance,
  sessionId: string,
  userId: string,
  payload: { mapId: string }
): Promise<void> {
  const { mapId } = payload

  const tokens = await getTokensForMap(fastify.prisma, sessionId, mapId)

  sendToUser(sessionId, userId, {
    type: 'token:state',
    payload: { mapId, tokens },
  })
}

// Send token state to a user when they connect or switch maps
export async function sendTokenStateToUser(
  fastify: FastifyInstance,
  sessionId: string,
  userId: string,
  mapId: string
): Promise<void> {
  const tokens = await getTokensForMap(fastify.prisma, sessionId, mapId)

  sendToUser(sessionId, userId, {
    type: 'token:state',
    payload: { mapId, tokens },
  })
}
