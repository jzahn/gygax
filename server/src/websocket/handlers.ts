import type { WebSocket } from 'ws'
import type { FastifyInstance } from 'fastify'
import type {
  WSMessage,
  WSUserConnected,
  WSUserDisconnected,
  WSSessionUpdated,
  WSParticipantJoined,
  WSParticipantLeft,
  WSSetMap,
  WSSetBackdrop,
  WSRtcOffer,
  WSRtcAnswer,
  WSRtcIceCandidate,
  WSRtcMuteState,
  SessionWithDetails,
  SessionStatus,
  SessionAccessType,
  SessionParticipantWithDetails,
  SessionInviteWithDetails,
  CharacterClass,
} from '@gygax/shared'
import {
  addUserToSession,
  removeUserFromSession,
  getUserInSession,
  updateUserPing,
  broadcastToSession,
  sendToUser,
  buildSessionState,
} from './sessionManager.js'
import {
  handleChatMessage,
  sendChatChannelsOnConnect,
  sendPlayerJoinedMessage,
  sendPlayerLeftMessage,
} from './chatHandler.js'
import { handleFogMessage, sendFogStateToUser } from './fogHandler.js'
import { handleTokenMessage, sendTokenStateToUser } from './tokenHandler.js'
import { addUserToMainChannel, removeUserFromMainChannel } from '../services/chatService.js'

function formatSessionParticipant(participant: {
  id: string
  sessionId: string
  userId: string
  characterId: string
  joinedAt: Date
  leftAt: Date | null
  user: { id: string; name: string; avatarUrl: string | null }
  character: {
    id: string
    name: string
    class: string
    level: number
    hitPointsCurrent: number
    hitPointsMax: number
    armorClass: number
    avatarUrl: string | null
  }
}): SessionParticipantWithDetails {
  return {
    id: participant.id,
    sessionId: participant.sessionId,
    userId: participant.userId,
    characterId: participant.characterId,
    joinedAt: participant.joinedAt.toISOString(),
    leftAt: participant.leftAt?.toISOString() ?? null,
    user: {
      id: participant.user.id,
      name: participant.user.name,
      avatarUrl: participant.user.avatarUrl,
    },
    character: {
      id: participant.character.id,
      name: participant.character.name,
      class: participant.character.class as CharacterClass,
      level: participant.character.level,
      hitPointsCurrent: participant.character.hitPointsCurrent,
      hitPointsMax: participant.character.hitPointsMax,
      armorClass: participant.character.armorClass,
      avatarUrl: participant.character.avatarUrl,
    },
  }
}

function formatSessionInvite(invite: {
  id: string
  sessionId: string
  userId: string | null
  email: string | null
  createdAt: Date
  acceptedAt: Date | null
  declinedAt: Date | null
  user: { id: string; name: string; email: string } | null
}): SessionInviteWithDetails {
  return {
    id: invite.id,
    sessionId: invite.sessionId,
    userId: invite.userId,
    email: invite.email,
    createdAt: invite.createdAt.toISOString(),
    acceptedAt: invite.acceptedAt?.toISOString() ?? null,
    declinedAt: invite.declinedAt?.toISOString() ?? null,
    user: invite.user
      ? {
          id: invite.user.id,
          name: invite.user.name,
          email: invite.user.email,
        }
      : null,
  }
}

function formatSessionWithDetails(session: {
  id: string
  status: string
  accessType: string
  adventureId: string
  dmId: string
  activeMapId: string | null
  activeBackdropId: string | null
  createdAt: Date
  updatedAt: Date
  startedAt: Date | null
  pausedAt: Date | null
  endedAt: Date | null
  adventure: { id: string; name: string; campaignId: string | null }
  dm: { id: string; name: string; avatarUrl: string | null }
  participants: Array<{
    id: string
    sessionId: string
    userId: string
    characterId: string
    joinedAt: Date
    leftAt: Date | null
    user: { id: string; name: string; avatarUrl: string | null }
    character: {
      id: string
      name: string
      class: string
      level: number
      hitPointsCurrent: number
      hitPointsMax: number
      armorClass: number
      avatarUrl: string | null
    }
  }>
  invites: Array<{
    id: string
    sessionId: string
    userId: string | null
    email: string | null
    createdAt: Date
    acceptedAt: Date | null
    declinedAt: Date | null
    user: { id: string; name: string; email: string } | null
  }>
}): SessionWithDetails {
  return {
    id: session.id,
    status: session.status as SessionStatus,
    accessType: session.accessType as SessionAccessType,
    adventureId: session.adventureId,
    dmId: session.dmId,
    activeMapId: session.activeMapId,
    activeBackdropId: session.activeBackdropId,
    createdAt: session.createdAt.toISOString(),
    updatedAt: session.updatedAt.toISOString(),
    startedAt: session.startedAt?.toISOString() ?? null,
    pausedAt: session.pausedAt?.toISOString() ?? null,
    endedAt: session.endedAt?.toISOString() ?? null,
    adventure: {
      id: session.adventure.id,
      name: session.adventure.name,
      campaignId: session.adventure.campaignId,
    },
    dm: {
      id: session.dm.id,
      name: session.dm.name,
      avatarUrl: session.dm.avatarUrl,
    },
    participants: session.participants
      .filter((p) => p.leftAt === null)
      .map(formatSessionParticipant),
    invites: session.invites.map(formatSessionInvite),
  }
}

export async function handleConnection(
  fastify: FastifyInstance,
  socket: WebSocket,
  sessionId: string,
  userId: string
): Promise<void> {
  // Fetch session and user data
  const [session, user, activeParticipant] = await Promise.all([
    fastify.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        adventure: { select: { id: true, name: true, campaignId: true } },
        dm: { select: { id: true, name: true, avatarUrl: true } },
        participants: {
          where: { leftAt: null },
          include: {
            user: { select: { id: true, name: true, avatarUrl: true } },
            character: {
              select: {
                id: true,
                name: true,
                class: true,
                level: true,
                hitPointsCurrent: true,
                hitPointsMax: true,
                armorClass: true,
                avatarUrl: true,
              },
            },
          },
        },
        invites: {
          include: {
            user: { select: { id: true, name: true, email: true } },
          },
        },
      },
    }),
    fastify.prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, name: true, avatarUrl: true },
    }),
    fastify.prisma.sessionParticipant.findFirst({
      where: { sessionId, userId, leftAt: null },
      include: {
        character: { select: { id: true, name: true } },
      },
    }),
  ])

  if (!session || !user) {
    socket.close(1008, 'Session or user not found')
    return
  }

  const isDm = session.dmId === userId
  const role = isDm ? 'dm' : 'player'

  // If player has no active participation, check for a former one to reactivate
  let participant = activeParticipant
  if (!participant && !isDm) {
    const formerParticipant = await fastify.prisma.sessionParticipant.findFirst({
      where: { sessionId, userId, leftAt: { not: null } },
      include: {
        character: { select: { id: true, name: true } },
      },
      orderBy: { leftAt: 'desc' },
    })

    if (formerParticipant) {
      // Reactivate the former participant (e.g., after a page refresh)
      await fastify.prisma.sessionParticipant.update({
        where: { id: formerParticipant.id },
        data: { leftAt: null },
      })
      participant = { ...formerParticipant, leftAt: null }
    }
  }

  // Add user to session manager
  addUserToSession(sessionId, userId, {
    userId: user.id,
    userName: user.name,
    avatarUrl: user.avatarUrl,
    role,
    characterId: participant?.character?.id,
    characterName: participant?.character?.name,
    socket,
  })

  // Send session state to the connecting user
  const sessionState = buildSessionState(formatSessionWithDetails(session), sessionId)
  console.log(`[WS] Sending session:state to ${userId}. activeMapId: ${sessionState.session.activeMapId}, activeBackdropId: ${sessionState.session.activeBackdropId}`)
  sendToUser(sessionId, userId, {
    type: 'session:state',
    payload: sessionState,
  })

  // Add user to main channel before sending channels (so the channel list includes Main)
  await addUserToMainChannel(fastify.prisma, sessionId, userId)

  // Send chat channels to the connecting user
  await sendChatChannelsOnConnect(fastify, sessionId, userId)

  // Send fog and token state if there's an active map
  if (session.activeMapId) {
    await sendFogStateToUser(fastify, sessionId, userId, session.activeMapId)
    await sendTokenStateToUser(fastify, sessionId, userId, session.activeMapId)
  }

  // Broadcast user connected to others
  const userConnected: WSUserConnected = {
    userId: user.id,
    userName: user.name,
    avatarUrl: user.avatarUrl,
    role,
    characterId: participant?.character?.id,
    characterName: participant?.character?.name,
  }
  broadcastToSession(
    sessionId,
    { type: 'user:connected', payload: userConnected },
    userId
  )

  // Send "player joined" system message to chat (only for players, not DM)
  if (!isDm) {
    await sendPlayerJoinedMessage(fastify, sessionId, userId, user.name)
  }

  // Handle incoming messages
  socket.on('message', (data) => {
    try {
      const message: WSMessage = JSON.parse(data.toString())
      handleMessage(fastify, sessionId, userId, message).catch((err) => {
        fastify.log.error({ err }, 'Error handling WebSocket message')
        sendToUser(sessionId, userId, {
          type: 'error',
          payload: { message: 'Error processing message' },
        })
      })
    } catch {
      sendToUser(sessionId, userId, {
        type: 'error',
        payload: { message: 'Invalid message format' },
      })
    }
  })

  // Handle disconnect
  socket.on('close', () => {
    // Check if this socket is still the active one for this user
    // If not, a new connection has replaced it and we shouldn't do disconnect actions
    const currentUser = getUserInSession(sessionId, userId)
    console.log(`[WS] Socket close for user ${userId} in session ${sessionId}`)
    console.log(`[WS] Current user in session:`, currentUser ? 'exists' : 'not found')
    console.log(`[WS] Socket match:`, currentUser?.socket === socket ? 'same' : 'different')

    if (currentUser && currentUser.socket !== socket) {
      // A new connection replaced this one - don't remove or mark as left
      console.log(`[WS] Skipping disconnect - new connection replaced this one`)
      return
    }

    console.log(`[WS] Proceeding with disconnect cleanup`)
    removeUserFromSession(sessionId, userId, socket)

    // Broadcast user disconnected
    const userDisconnected: WSUserDisconnected = { userId }
    broadcastToSession(sessionId, {
      type: 'user:disconnected',
      payload: userDisconnected,
    })

    // Mark player as having left in the database (only for players, not DM)
    // This allows them to rejoin later
    if (!isDm) {
      // Send "player left" system message to chat
      sendPlayerLeftMessage(fastify, sessionId, userId, user.name).catch((err) => {
        fastify.log.error({ err }, 'Failed to send player left message')
      })

      // Remove player from main chat channel
      removeUserFromMainChannel(fastify.prisma, sessionId, userId).catch((err) => {
        fastify.log.error({ err }, 'Failed to remove user from main channel')
      })

      fastify.prisma.sessionParticipant
        .updateMany({
          where: { sessionId, userId, leftAt: null },
          data: { leftAt: new Date() },
        })
        .catch((err) => {
          fastify.log.error({ err }, 'Failed to mark participant as left on disconnect')
        })
    }
  })
}

async function handleMessage(
  fastify: FastifyInstance,
  sessionId: string,
  userId: string,
  message: WSMessage
): Promise<void> {
  // Try to handle as chat message first
  const isChatMessage = await handleChatMessage(fastify, sessionId, userId, message)
  if (isChatMessage) return

  // Try to handle as fog message
  const isFogMessage = await handleFogMessage(fastify, sessionId, userId, message)
  if (isFogMessage) return

  // Try to handle as token message
  const isTokenMessage = await handleTokenMessage(fastify, sessionId, userId, message)
  if (isTokenMessage) return

  switch (message.type) {
    case 'ping':
      updateUserPing(sessionId, userId)
      break

    // WebRTC signaling relay
    case 'rtc:offer': {
      const payload = message.payload as WSRtcOffer
      sendToUser(sessionId, payload.targetUserId, {
        type: 'rtc:offer',
        payload: { fromUserId: userId, sdp: payload.sdp },
      })
      break
    }

    case 'rtc:answer': {
      const payload = message.payload as WSRtcAnswer
      sendToUser(sessionId, payload.targetUserId, {
        type: 'rtc:answer',
        payload: { fromUserId: userId, sdp: payload.sdp },
      })
      break
    }

    case 'rtc:ice-candidate': {
      const payload = message.payload as WSRtcIceCandidate
      sendToUser(sessionId, payload.targetUserId, {
        type: 'rtc:ice-candidate',
        payload: { fromUserId: userId, candidate: payload.candidate },
      })
      break
    }

    case 'rtc:mute-state': {
      const payload = message.payload as WSRtcMuteState
      // Broadcast to all users in session (including self for consistency)
      broadcastToSession(sessionId, {
        type: 'rtc:mute-state',
        payload: { userId, muted: payload.muted },
      })
      break
    }

    // Map/Backdrop switching (DM only)
    case 'session:set-map': {
      const user = getUserInSession(sessionId, userId)
      if (user?.role !== 'dm') {
        sendToUser(sessionId, userId, {
          type: 'error',
          payload: { message: 'Only the DM can change the map' },
        })
        break
      }

      const payload = message.payload as WSSetMap
      const session = await fastify.prisma.session.update({
        where: { id: sessionId },
        data: {
          activeMapId: payload.mapId,
          activeBackdropId: null, // Clear backdrop when setting map
        },
      })

      broadcastSessionUpdate(sessionId, {
        status: session.status as SessionStatus,
        activeMapId: session.activeMapId,
        activeBackdropId: session.activeBackdropId,
        pausedAt: session.pausedAt?.toISOString() ?? null,
        endedAt: session.endedAt?.toISOString() ?? null,
      })

      // Send fog and token state for the new map to all users
      if (payload.mapId) {
        const { getSessionUsers } = await import('./sessionManager.js')
        const users = getSessionUsers(sessionId)
        for (const [uid] of users) {
          await sendFogStateToUser(fastify, sessionId, uid, payload.mapId)
          await sendTokenStateToUser(fastify, sessionId, uid, payload.mapId)
        }
      }
      break
    }

    case 'session:set-backdrop': {
      const user = getUserInSession(sessionId, userId)
      if (user?.role !== 'dm') {
        sendToUser(sessionId, userId, {
          type: 'error',
          payload: { message: 'Only the DM can change the backdrop' },
        })
        break
      }

      const payload = message.payload as WSSetBackdrop
      const session = await fastify.prisma.session.update({
        where: { id: sessionId },
        data: {
          activeBackdropId: payload.backdropId,
          activeMapId: null, // Clear map when setting backdrop
        },
      })

      broadcastSessionUpdate(sessionId, {
        status: session.status as SessionStatus,
        activeMapId: session.activeMapId,
        activeBackdropId: session.activeBackdropId,
        pausedAt: session.pausedAt?.toISOString() ?? null,
        endedAt: session.endedAt?.toISOString() ?? null,
      })
      break
    }

    case 'session:clear-display': {
      const user = getUserInSession(sessionId, userId)
      if (user?.role !== 'dm') {
        sendToUser(sessionId, userId, {
          type: 'error',
          payload: { message: 'Only the DM can clear the display' },
        })
        break
      }

      const session = await fastify.prisma.session.update({
        where: { id: sessionId },
        data: {
          activeMapId: null,
          activeBackdropId: null,
        },
      })

      broadcastSessionUpdate(sessionId, {
        status: session.status as SessionStatus,
        activeMapId: session.activeMapId,
        activeBackdropId: session.activeBackdropId,
        pausedAt: session.pausedAt?.toISOString() ?? null,
        endedAt: session.endedAt?.toISOString() ?? null,
      })
      break
    }

    default:
      // Unknown message type - ignore
      break
  }
}

// Broadcast session updated event to all users in session
export function broadcastSessionUpdate(
  sessionId: string,
  session: {
    status: SessionStatus
    activeMapId: string | null
    activeBackdropId: string | null
    pausedAt: string | null
    endedAt: string | null
  }
): void {
  const payload: WSSessionUpdated = {
    status: session.status,
    activeMapId: session.activeMapId,
    activeBackdropId: session.activeBackdropId,
    pausedAt: session.pausedAt,
    endedAt: session.endedAt,
  }

  broadcastToSession(sessionId, { type: 'session:updated', payload })
}

// Broadcast participant joined event
export function broadcastParticipantJoined(
  sessionId: string,
  participant: SessionParticipantWithDetails
): void {
  const payload: WSParticipantJoined = { participant }
  broadcastToSession(sessionId, { type: 'participant:joined', payload })
}

// Broadcast participant left event
export function broadcastParticipantLeft(sessionId: string, userId: string): void {
  const payload: WSParticipantLeft = { userId }
  broadcastToSession(sessionId, { type: 'participant:left', payload })
}
