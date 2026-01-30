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
  adventure: { id: string; name: string }
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
  const [session, user, participant] = await Promise.all([
    fastify.prisma.session.findUnique({
      where: { id: sessionId },
      include: {
        adventure: { select: { id: true, name: true } },
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
  sendToUser(sessionId, userId, {
    type: 'session:state',
    payload: sessionState,
  })

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
    removeUserFromSession(sessionId, userId)

    // Broadcast user disconnected
    const userDisconnected: WSUserDisconnected = { userId }
    broadcastToSession(sessionId, {
      type: 'user:disconnected',
      payload: userDisconnected,
    })
  })
}

async function handleMessage(
  fastify: FastifyInstance,
  sessionId: string,
  userId: string,
  message: WSMessage
): Promise<void> {
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
