import type { FastifyInstance } from 'fastify'
import type {
  WSMessage,
  WSChatMessage,
  WSChatCreateChannel,
  WSChatMarkRead,
  WSChatMessageReceived,
  WSChatChannels,
  WSChatChannelCreated,
  ChatChannel,
  ChatMessage,
} from '@gygax/shared'
import { sendToUser, getSessionUsers } from './sessionManager.js'
import {
  sendMessage,
  sendSystemMessage,
  createChannel,
  getChannelsForUser,
  markChannelRead,
  isChannelParticipant,
  getChannelById,
  getMainChannel,
  formatChannel,
} from '../services/chatService.js'

// Handle chat-related WebSocket messages
export async function handleChatMessage(
  fastify: FastifyInstance,
  sessionId: string,
  userId: string,
  message: WSMessage
): Promise<boolean> {
  switch (message.type) {
    case 'chat:message': {
      const payload = message.payload as WSChatMessage
      await handleSendMessage(fastify, sessionId, userId, payload)
      return true
    }

    case 'chat:create_channel': {
      const payload = message.payload as WSChatCreateChannel
      await handleCreateChannel(fastify, sessionId, userId, payload)
      return true
    }

    case 'chat:mark_read': {
      const payload = message.payload as WSChatMarkRead
      await handleMarkRead(fastify, sessionId, userId, payload)
      return true
    }

    default:
      return false // Not a chat message
  }
}

// Send chat channels to a user when they connect
export async function sendChatChannelsOnConnect(
  fastify: FastifyInstance,
  sessionId: string,
  userId: string
): Promise<void> {
  const channels = await getChannelsForUser(fastify.prisma, sessionId, userId)

  const payload: WSChatChannels = { channels }
  sendToUser(sessionId, userId, { type: 'chat:channels', payload })
}

// Send a "player joined" system message to the main channel
export async function sendPlayerJoinedMessage(
  fastify: FastifyInstance,
  sessionId: string,
  userId: string,
  playerName: string
): Promise<void> {
  const mainChannel = await getMainChannel(fastify.prisma, sessionId)
  if (!mainChannel) return

  const chatMessage = await sendSystemMessage(
    fastify.prisma,
    mainChannel.id,
    userId,
    `${playerName} joined the session`
  )

  // Broadcast to all channel participants
  broadcastMessageToChannel(fastify, sessionId, mainChannel.id, chatMessage)
}

// Send a "player left" system message to the main channel
export async function sendPlayerLeftMessage(
  fastify: FastifyInstance,
  sessionId: string,
  userId: string,
  playerName: string
): Promise<void> {
  const mainChannel = await getMainChannel(fastify.prisma, sessionId)
  if (!mainChannel) return

  const chatMessage = await sendSystemMessage(
    fastify.prisma,
    mainChannel.id,
    userId,
    `${playerName} left the session`
  )

  // Broadcast to all channel participants
  broadcastMessageToChannel(fastify, sessionId, mainChannel.id, chatMessage)
}

// Send a "session paused/resumed" system message
export async function sendSessionStatusMessage(
  fastify: FastifyInstance,
  sessionId: string,
  dmUserId: string,
  status: 'paused' | 'resumed'
): Promise<void> {
  const mainChannel = await getMainChannel(fastify.prisma, sessionId)
  if (!mainChannel) return

  const chatMessage = await sendSystemMessage(
    fastify.prisma,
    mainChannel.id,
    dmUserId,
    `Session ${status}`
  )

  // Broadcast to all channel participants
  broadcastMessageToChannel(fastify, sessionId, mainChannel.id, chatMessage)
}

// Handle sending a chat message
async function handleSendMessage(
  fastify: FastifyInstance,
  sessionId: string,
  userId: string,
  payload: WSChatMessage
): Promise<void> {
  const { channelId, content } = payload

  if (!content || content.trim().length === 0) {
    sendToUser(sessionId, userId, {
      type: 'error',
      payload: { message: 'Message content is required' },
    })
    return
  }

  // Verify user is a participant of the channel
  const channel = await getChannelById(fastify.prisma, channelId)
  if (!channel || channel.sessionId !== sessionId) {
    sendToUser(sessionId, userId, {
      type: 'error',
      payload: { message: 'Channel not found' },
    })
    return
  }

  const isParticipant = await isChannelParticipant(fastify.prisma, channelId, userId)
  if (!isParticipant) {
    sendToUser(sessionId, userId, {
      type: 'error',
      payload: { message: 'Not a participant of this channel' },
    })
    return
  }

  // Send the message (handles dice rolls)
  const chatMessage = await sendMessage(fastify.prisma, channelId, userId, content)

  // Broadcast to all channel participants
  broadcastMessageToChannel(fastify, sessionId, channelId, chatMessage)
}

// Handle creating a new channel
async function handleCreateChannel(
  fastify: FastifyInstance,
  sessionId: string,
  userId: string,
  payload: WSChatCreateChannel
): Promise<void> {
  const { participantIds, name } = payload

  if (!participantIds || participantIds.length === 0) {
    sendToUser(sessionId, userId, {
      type: 'error',
      payload: { message: 'participantIds is required' },
    })
    return
  }

  // Verify session and check that user is DM or participant
  const session = await fastify.prisma.session.findUnique({
    where: { id: sessionId },
    include: {
      participants: { where: { leftAt: null }, select: { userId: true } },
    },
  })

  if (!session) {
    sendToUser(sessionId, userId, {
      type: 'error',
      payload: { message: 'Session not found' },
    })
    return
  }

  // Verify all participant IDs are valid session members
  const validUserIds = new Set([session.dmId, ...session.participants.map((p) => p.userId)])
  const invalidIds = participantIds.filter((id: string) => !validUserIds.has(id))

  if (invalidIds.length > 0) {
    sendToUser(sessionId, userId, {
      type: 'error',
      payload: { message: 'Some participant IDs are not members of this session' },
    })
    return
  }

  // Create channel
  const channel = await createChannel(fastify.prisma, sessionId, userId, participantIds, name)

  // Get the full channel with participants
  const fullChannel = await fastify.prisma.chatChannel.findUnique({
    where: { id: channel.id },
    include: {
      participants: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
    },
  })

  if (!fullChannel) {
    sendToUser(sessionId, userId, {
      type: 'error',
      payload: { message: 'Failed to create channel' },
    })
    return
  }

  const formattedChannel = await formatChannel(fastify.prisma, fullChannel, userId)

  // Broadcast to all channel participants
  broadcastChannelCreated(sessionId, fullChannel.participants.map((p) => p.userId), formattedChannel)
}

// Handle marking a channel as read
async function handleMarkRead(
  fastify: FastifyInstance,
  sessionId: string,
  userId: string,
  payload: WSChatMarkRead
): Promise<void> {
  const { channelId } = payload

  // Verify user is a participant
  const isParticipant = await isChannelParticipant(fastify.prisma, channelId, userId)
  if (!isParticipant) {
    return // Silently ignore if not a participant
  }

  await markChannelRead(fastify.prisma, channelId, userId)
}

// Broadcast a message to all participants of a channel
function broadcastMessageToChannel(
  fastify: FastifyInstance,
  sessionId: string,
  channelId: string,
  message: ChatMessage
): void {
  // Get all connected users in the session
  const sessionUsers = getSessionUsers(sessionId)
  if (!sessionUsers) return

  // Get channel participant IDs
  fastify.prisma.chatChannelParticipant
    .findMany({
      where: { channelId },
      select: { userId: true },
    })
    .then((participants) => {
      const participantIds = new Set(participants.map((p) => p.userId))

      const payload: WSChatMessageReceived = {
        channelId,
        message,
      }

      // Send to each connected participant
      for (const [connectedUserId] of sessionUsers) {
        if (participantIds.has(connectedUserId)) {
          sendToUser(sessionId, connectedUserId, { type: 'chat:message', payload })
        }
      }
    })
    .catch((err) => {
      fastify.log.error({ err }, 'Failed to broadcast chat message')
    })
}

// Broadcast that a channel was created to all its participants
export function broadcastChannelCreated(
  sessionId: string,
  participantUserIds: string[],
  channel: ChatChannel
): void {
  const sessionUsers = getSessionUsers(sessionId)
  if (!sessionUsers) return

  const participantIds = new Set(participantUserIds)
  const payload: WSChatChannelCreated = { channel }

  // Send to each connected participant
  for (const [connectedUserId] of sessionUsers) {
    if (participantIds.has(connectedUserId)) {
      sendToUser(sessionId, connectedUserId, { type: 'chat:channel_created', payload })
    }
  }
}
