import type { PrismaClient } from '../../prisma/generated/prisma/index.js'
import type {
  ChatChannel,
  ChatChannelParticipant,
  ChatMessage,
  ChatMessageType,
} from '@gygax/shared'
import { parseDice, rollDice } from '@gygax/shared'

// Format a channel participant for API response
function formatParticipant(participant: {
  id: string
  userId: string
  user: { id: string; name: string; avatarUrl: string | null }
}): ChatChannelParticipant {
  return {
    id: participant.user.id,
    name: participant.user.name,
    avatarUrl: participant.user.avatarUrl,
  }
}

// Format a chat message for API response
export function formatChatMessage(message: {
  id: string
  content: string
  type: string
  createdAt: Date
  channelId: string
  senderId: string
  sender: { id: string; name: string; avatarUrl: string | null }
  diceExpression: string | null
  diceRolls: unknown | null
  diceTotal: number | null
  diceModifier: number | null
}): ChatMessage {
  return {
    id: message.id,
    content: message.content,
    type: message.type as ChatMessageType,
    createdAt: message.createdAt.toISOString(),
    channelId: message.channelId,
    sender: {
      id: message.sender.id,
      name: message.sender.name,
      avatarUrl: message.sender.avatarUrl,
    },
    diceExpression: message.diceExpression ?? undefined,
    diceRolls: (message.diceRolls as number[] | null) ?? undefined,
    diceTotal: message.diceTotal ?? undefined,
    diceModifier: message.diceModifier ?? undefined,
  }
}

// Format a channel for API response
export async function formatChannel(
  prisma: PrismaClient,
  channel: {
    id: string
    name: string | null
    isMain: boolean
    sessionId: string
    participants: Array<{
      id: string
      userId: string
      lastReadAt: Date
      user: { id: string; name: string; avatarUrl: string | null }
    }>
  },
  userId: string
): Promise<ChatChannel> {
  // Get unread count for this user
  const userParticipation = channel.participants.find((p) => p.userId === userId)
  const lastReadAt = userParticipation?.lastReadAt ?? new Date(0)

  const unreadCount = await prisma.chatMessage.count({
    where: {
      channelId: channel.id,
      createdAt: { gt: lastReadAt },
      senderId: { not: userId }, // Don't count own messages
    },
  })

  // Get last message
  const lastMessage = await prisma.chatMessage.findFirst({
    where: { channelId: channel.id },
    orderBy: { createdAt: 'desc' },
    include: {
      sender: { select: { name: true } },
    },
  })

  return {
    id: channel.id,
    name: channel.name,
    isMain: channel.isMain,
    participants: channel.participants.map(formatParticipant),
    unreadCount,
    lastMessage: lastMessage
      ? {
          content: lastMessage.content,
          senderName: lastMessage.sender.name,
          createdAt: lastMessage.createdAt.toISOString(),
        }
      : undefined,
  }
}

// Create the main channel for a session
export async function createMainChannel(
  prisma: PrismaClient,
  sessionId: string,
  participantUserIds: string[]
): Promise<{ id: string }> {
  const channel = await prisma.chatChannel.create({
    data: {
      sessionId,
      isMain: true,
      participants: {
        create: participantUserIds.map((userId) => ({
          userId,
        })),
      },
    },
  })

  return channel
}

// Add a user to the main channel when they join a session
export async function addUserToMainChannel(
  prisma: PrismaClient,
  sessionId: string,
  userId: string
): Promise<void> {
  // Find the main channel
  const mainChannel = await prisma.chatChannel.findFirst({
    where: { sessionId, isMain: true },
  })

  if (!mainChannel) {
    return // No main channel yet
  }

  // Check if user is already a participant
  const existing = await prisma.chatChannelParticipant.findUnique({
    where: {
      channelId_userId: {
        channelId: mainChannel.id,
        userId,
      },
    },
  })

  if (!existing) {
    await prisma.chatChannelParticipant.create({
      data: {
        channelId: mainChannel.id,
        userId,
      },
    })
  }
}

// Remove a user from the main channel when they leave a session
export async function removeUserFromMainChannel(
  prisma: PrismaClient,
  sessionId: string,
  userId: string
): Promise<void> {
  const mainChannel = await prisma.chatChannel.findFirst({
    where: { sessionId, isMain: true },
  })

  if (!mainChannel) {
    return
  }

  await prisma.chatChannelParticipant.deleteMany({
    where: {
      channelId: mainChannel.id,
      userId,
    },
  })
}

// Get channels for a user in a session
export async function getChannelsForUser(
  prisma: PrismaClient,
  sessionId: string,
  userId: string
): Promise<ChatChannel[]> {
  const channels = await prisma.chatChannel.findMany({
    where: {
      sessionId,
      participants: {
        some: { userId },
      },
    },
    include: {
      participants: {
        include: {
          user: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
    },
    orderBy: [
      { isMain: 'desc' }, // Main channel first
      { createdAt: 'asc' },
    ],
  })

  const formattedChannels = await Promise.all(
    channels.map((channel) => formatChannel(prisma, channel, userId))
  )

  return formattedChannels
}

// Find existing 1:1 channel between two users
export async function findExisting1to1Channel(
  prisma: PrismaClient,
  sessionId: string,
  userId1: string,
  userId2: string
): Promise<string | null> {
  // Find channels where both users are participants and it's not a main channel
  const channels = await prisma.chatChannel.findMany({
    where: {
      sessionId,
      isMain: false,
      participants: {
        every: {
          userId: { in: [userId1, userId2] },
        },
      },
    },
    include: {
      _count: { select: { participants: true } },
    },
  })

  // Find one with exactly 2 participants
  const channel = channels.find((c) => c._count.participants === 2)
  return channel?.id ?? null
}

// Create a new channel
export async function createChannel(
  prisma: PrismaClient,
  sessionId: string,
  creatorUserId: string,
  participantIds: string[],
  name?: string
): Promise<{ id: string }> {
  // Ensure creator is in the participants
  const allParticipantIds = Array.from(new Set([creatorUserId, ...participantIds]))

  // For 2-person channels, check if one already exists
  if (allParticipantIds.length === 2) {
    const existingId = await findExisting1to1Channel(
      prisma,
      sessionId,
      allParticipantIds[0],
      allParticipantIds[1]
    )
    if (existingId) {
      return { id: existingId }
    }
  }

  // Generate name if not provided and it's a group (3+)
  let channelName = name
  if (!channelName && allParticipantIds.length > 2) {
    const users = await prisma.user.findMany({
      where: { id: { in: allParticipantIds } },
      select: { name: true },
    })
    channelName = users.map((u) => u.name).join(', ')
  }

  const channel = await prisma.chatChannel.create({
    data: {
      sessionId,
      name: channelName,
      isMain: false,
      participants: {
        create: allParticipantIds.map((userId) => ({
          userId,
        })),
      },
    },
  })

  return channel
}

// Get messages for a channel
export async function getMessages(
  prisma: PrismaClient,
  channelId: string,
  options: { before?: string; limit?: number } = {}
): Promise<{ messages: ChatMessage[]; hasMore: boolean }> {
  const limit = Math.min(options.limit ?? 50, 100)

  const whereClause: { channelId: string; id?: { lt: string } } = { channelId }
  if (options.before) {
    whereClause.id = { lt: options.before }
  }

  const messages = await prisma.chatMessage.findMany({
    where: whereClause,
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true } },
    },
    orderBy: { createdAt: 'desc' },
    take: limit + 1, // Get one extra to check if there's more
  })

  const hasMore = messages.length > limit
  const resultMessages = messages.slice(0, limit).reverse() // Reverse to get chronological order

  return {
    messages: resultMessages.map(formatChatMessage),
    hasMore,
  }
}

// Send a chat message (handles dice rolls)
export async function sendMessage(
  prisma: PrismaClient,
  channelId: string,
  senderId: string,
  content: string
): Promise<ChatMessage> {
  // Check if it's a dice roll command
  const trimmedContent = content.trim()
  const isRollCommand = trimmedContent.toLowerCase().startsWith('/roll ')

  if (isRollCommand) {
    const expression = trimmedContent.substring(6).trim()
    const parsed = parseDice(expression)

    if (parsed) {
      // Valid dice expression - roll and store result
      const result = rollDice(parsed)

      const message = await prisma.chatMessage.create({
        data: {
          channelId,
          senderId,
          content: trimmedContent,
          type: 'ROLL',
          diceExpression: parsed.raw,
          diceRolls: result.rolls,
          diceTotal: result.total,
          diceModifier: parsed.modifier,
        },
        include: {
          sender: { select: { id: true, name: true, avatarUrl: true } },
        },
      })

      return formatChatMessage(message)
    }
    // Invalid dice expression - treat as regular text
  }

  // Regular text message
  const message = await prisma.chatMessage.create({
    data: {
      channelId,
      senderId,
      content,
      type: 'TEXT',
    },
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true } },
    },
  })

  return formatChatMessage(message)
}

// Send a system message
export async function sendSystemMessage(
  prisma: PrismaClient,
  channelId: string,
  senderId: string,
  content: string
): Promise<ChatMessage> {
  const message = await prisma.chatMessage.create({
    data: {
      channelId,
      senderId,
      content,
      type: 'SYSTEM',
    },
    include: {
      sender: { select: { id: true, name: true, avatarUrl: true } },
    },
  })

  return formatChatMessage(message)
}

// Mark a channel as read for a user
export async function markChannelRead(
  prisma: PrismaClient,
  channelId: string,
  userId: string
): Promise<void> {
  await prisma.chatChannelParticipant.update({
    where: {
      channelId_userId: {
        channelId,
        userId,
      },
    },
    data: {
      lastReadAt: new Date(),
    },
  })
}

// Check if a user is a participant of a channel
export async function isChannelParticipant(
  prisma: PrismaClient,
  channelId: string,
  userId: string
): Promise<boolean> {
  const participant = await prisma.chatChannelParticipant.findUnique({
    where: {
      channelId_userId: {
        channelId,
        userId,
      },
    },
  })
  return !!participant
}

// Get channel by ID with participants
export async function getChannelById(
  prisma: PrismaClient,
  channelId: string
): Promise<{
  id: string
  sessionId: string
  isMain: boolean
  participants: Array<{ userId: string }>
} | null> {
  return prisma.chatChannel.findUnique({
    where: { id: channelId },
    include: {
      participants: {
        select: { userId: true },
      },
    },
  })
}

// Get the main channel for a session
export async function getMainChannel(
  prisma: PrismaClient,
  sessionId: string
): Promise<{ id: string } | null> {
  return prisma.chatChannel.findFirst({
    where: { sessionId, isMain: true },
    select: { id: true },
  })
}
