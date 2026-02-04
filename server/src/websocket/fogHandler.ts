import type { FastifyInstance } from 'fastify'
import type {
  WSMessage,
  WSFogReveal,
  WSFogRevealAll,
  WSFogHideAll,
  CellCoord,
} from '@gygax/shared'
import { getUserInSession, broadcastToSession, sendToUser } from './sessionManager.js'
import { getFogState, revealCells, revealAll, hideAll } from '../services/fogService.js'

// Handle fog-related WebSocket messages
// Returns true if the message was handled, false otherwise
export async function handleFogMessage(
  fastify: FastifyInstance,
  sessionId: string,
  userId: string,
  message: WSMessage
): Promise<boolean> {
  switch (message.type) {
    case 'fog:reveal':
      await handleFogReveal(fastify, sessionId, userId, message.payload as WSFogReveal)
      return true

    case 'fog:reveal-all':
      await handleFogRevealAll(fastify, sessionId, userId, message.payload as WSFogRevealAll)
      return true

    case 'fog:hide-all':
      await handleFogHideAll(fastify, sessionId, userId, message.payload as WSFogHideAll)
      return true

    case 'fog:get-state':
      await handleFogGetState(fastify, sessionId, userId, message.payload as { mapId: string })
      return true

    default:
      return false
  }
}

// Handle fog:reveal message
async function handleFogReveal(
  fastify: FastifyInstance,
  sessionId: string,
  userId: string,
  payload: WSFogReveal
): Promise<void> {
  // Validate DM role
  const user = getUserInSession(sessionId, userId)
  if (user?.role !== 'dm') {
    sendToUser(sessionId, userId, {
      type: 'error',
      payload: { message: 'Only the DM can reveal fog' },
    })
    return
  }

  const { mapId, cells } = payload

  // Validate cells
  if (!cells || !Array.isArray(cells) || cells.length === 0) {
    sendToUser(sessionId, userId, {
      type: 'error',
      payload: { message: 'No cells provided' },
    })
    return
  }

  // Reveal cells
  const newlyRevealed = await revealCells(fastify.prisma, sessionId, mapId, cells)

  if (newlyRevealed.length > 0) {
    // Broadcast to all session participants
    broadcastToSession(sessionId, {
      type: 'fog:updated',
      payload: { mapId, newlyRevealed },
    })
  }
}

// Handle fog:reveal-all message
async function handleFogRevealAll(
  fastify: FastifyInstance,
  sessionId: string,
  userId: string,
  payload: WSFogRevealAll
): Promise<void> {
  // Validate DM role
  const user = getUserInSession(sessionId, userId)
  if (user?.role !== 'dm') {
    sendToUser(sessionId, userId, {
      type: 'error',
      payload: { message: 'Only the DM can reveal fog' },
    })
    return
  }

  const { mapId } = payload

  // Fetch the map to get dimensions
  const map = await fastify.prisma.map.findUnique({
    where: { id: mapId },
    select: { width: true, height: true, gridType: true },
  })

  if (!map) {
    sendToUser(sessionId, userId, {
      type: 'error',
      payload: { message: 'Map not found' },
    })
    return
  }

  // Generate all cell coordinates
  const allCells: CellCoord[] = []
  if (map.gridType === 'HEX') {
    // For hex maps, use axial coordinates
    for (let r = 0; r < map.height; r++) {
      for (let q = 0; q < map.width; q++) {
        allCells.push({ q, r })
      }
    }
  } else {
    // For square maps, use col/row
    for (let row = 0; row < map.height; row++) {
      for (let col = 0; col < map.width; col++) {
        allCells.push({ col, row })
      }
    }
  }

  // Reveal all cells
  await revealAll(fastify.prisma, sessionId, mapId, allCells)

  // Broadcast full state to all participants
  broadcastToSession(sessionId, {
    type: 'fog:state',
    payload: { mapId, revealedCells: allCells },
  })
}

// Handle fog:hide-all message (reset fog to fully hidden)
async function handleFogHideAll(
  fastify: FastifyInstance,
  sessionId: string,
  userId: string,
  payload: WSFogHideAll
): Promise<void> {
  // Validate DM role
  const user = getUserInSession(sessionId, userId)
  if (user?.role !== 'dm') {
    sendToUser(sessionId, userId, {
      type: 'error',
      payload: { message: 'Only the DM can hide fog' },
    })
    return
  }

  const { mapId } = payload

  // Hide all cells (clear revealed state)
  await hideAll(fastify.prisma, sessionId, mapId)

  // Broadcast empty state to all participants
  broadcastToSession(sessionId, {
    type: 'fog:state',
    payload: { mapId, revealedCells: [] },
  })
}

// Handle fog:get-state message (send current fog state for a map)
async function handleFogGetState(
  fastify: FastifyInstance,
  sessionId: string,
  userId: string,
  payload: { mapId: string }
): Promise<void> {
  const { mapId } = payload

  const fogState = await getFogState(fastify.prisma, sessionId, mapId)

  sendToUser(sessionId, userId, {
    type: 'fog:state',
    payload: fogState,
  })
}

// Send fog state to a user when they connect or switch maps
export async function sendFogStateToUser(
  fastify: FastifyInstance,
  sessionId: string,
  userId: string,
  mapId: string
): Promise<void> {
  const fogState = await getFogState(fastify.prisma, sessionId, mapId)

  sendToUser(sessionId, userId, {
    type: 'fog:state',
    payload: fogState,
  })
}
