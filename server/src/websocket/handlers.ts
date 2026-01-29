import type { WebSocket } from 'ws'
import type { FastifyInstance } from 'fastify'
import type {
  WSMessage,
  WSUserConnected,
  WSUserDisconnected,
  WSSessionUpdated,
  WSParticipantJoined,
  WSParticipantLeft,
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
  getConnectedUsers,
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
      handleMessage(fastify, sessionId, userId, message)
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

function handleMessage(
  _fastify: FastifyInstance,
  sessionId: string,
  userId: string,
  message: WSMessage
): void {
  switch (message.type) {
    case 'ping':
      updateUserPing(sessionId, userId)
      break
    default:
      // Unknown message type - ignore for now
      // Future specs will add more message handlers
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
