import { useState, useEffect, useCallback, useRef } from 'react'
import type {
  ChatChannel,
  ChatMessage,
  WSMessage,
  WSChatMessageReceived,
  WSChatChannels,
  WSChatChannelCreated,
} from '@gygax/shared'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

interface UseChatOptions {
  sessionId: string
  lastMessage: WSMessage | null
  sendMessage: (type: string, payload: unknown) => void
  isConnected: boolean
}

interface UseChatReturn {
  // Channels
  channels: ChatChannel[]
  activeChannelId: string | null
  setActiveChannelId: (channelId: string) => void
  createChannel: (participantIds: string[], name?: string) => Promise<ChatChannel | null>

  // Messages (for active channel)
  messages: ChatMessage[]
  sendChatMessage: (content: string) => void
  loadMore: () => Promise<void>
  hasMore: boolean
  isLoading: boolean

  // Unread tracking
  totalUnreadCount: number
  markChannelRead: (channelId: string) => void
}

export function useChat({
  sessionId,
  lastMessage,
  sendMessage,
  isConnected,
}: UseChatOptions): UseChatReturn {
  const [channels, setChannels] = useState<ChatChannel[]>([])
  const [activeChannelId, setActiveChannelIdState] = useState<string | null>(null)
  const [messagesByChannel, setMessagesByChannel] = useState<Record<string, ChatMessage[]>>({})
  const [hasMoreByChannel, setHasMoreByChannel] = useState<Record<string, boolean>>({})
  const [isLoading, setIsLoading] = useState(false)

  // Track which channels we've already loaded messages for
  const loadedChannelsRef = useRef<Set<string>>(new Set())

  // Get messages for active channel
  const messages = activeChannelId ? messagesByChannel[activeChannelId] ?? [] : []
  const hasMore = activeChannelId ? hasMoreByChannel[activeChannelId] ?? false : false

  // Calculate total unread count across all channels
  const totalUnreadCount = channels.reduce((sum, ch) => sum + ch.unreadCount, 0)

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return

    switch (lastMessage.type) {
      case 'chat:channels': {
        const payload = lastMessage.payload as WSChatChannels
        setChannels(payload.channels)
        // Auto-select main channel if none selected
        if (!activeChannelId) {
          const mainChannel = payload.channels.find((c) => c.isMain)
          if (mainChannel) {
            setActiveChannelIdState(mainChannel.id)
          }
        }
        break
      }

      case 'chat:message': {
        const payload = lastMessage.payload as WSChatMessageReceived
        const { channelId, message } = payload

        // Add message to the channel
        setMessagesByChannel((prev) => ({
          ...prev,
          [channelId]: [...(prev[channelId] ?? []), message],
        }))

        // Update unread count if not the active channel
        if (channelId !== activeChannelId) {
          setChannels((prev) =>
            prev.map((ch) =>
              ch.id === channelId ? { ...ch, unreadCount: ch.unreadCount + 1 } : ch
            )
          )
        }

        // Update last message preview
        setChannels((prev) =>
          prev.map((ch) =>
            ch.id === channelId
              ? {
                  ...ch,
                  lastMessage: {
                    content: message.content,
                    senderName: message.sender.name,
                    createdAt: message.createdAt,
                  },
                }
              : ch
          )
        )
        break
      }

      case 'chat:channel_created': {
        const payload = lastMessage.payload as WSChatChannelCreated
        setChannels((prev) => {
          // Don't add if already exists
          if (prev.some((c) => c.id === payload.channel.id)) {
            return prev
          }
          return [...prev, payload.channel]
        })
        break
      }
    }
  }, [lastMessage, activeChannelId])

  // Load messages when active channel changes
  useEffect(() => {
    if (!activeChannelId || !isConnected) return
    if (loadedChannelsRef.current.has(activeChannelId)) return

    loadMessages(activeChannelId)
    loadedChannelsRef.current.add(activeChannelId)
  }, [activeChannelId, isConnected])

  // Load messages for a channel
  const loadMessages = async (channelId: string, before?: string) => {
    setIsLoading(true)
    try {
      const url = before
        ? `${API_URL}/api/channels/${channelId}/messages?before=${before}`
        : `${API_URL}/api/channels/${channelId}/messages`

      const response = await fetch(url, {
        credentials: 'include',
      })

      if (!response.ok) {
        console.error('Failed to load messages:', response.status)
        return
      }

      const data = await response.json()
      const newMessages = data.messages as ChatMessage[]

      setMessagesByChannel((prev) => ({
        ...prev,
        [channelId]: before
          ? [...newMessages, ...(prev[channelId] ?? [])]
          : newMessages,
      }))

      setHasMoreByChannel((prev) => ({
        ...prev,
        [channelId]: data.hasMore,
      }))
    } catch (err) {
      console.error('Error loading messages:', err)
    } finally {
      setIsLoading(false)
    }
  }

  // Load older messages (pagination)
  const loadMore = useCallback(async () => {
    if (!activeChannelId || isLoading || !hasMore) return

    const currentMessages = messagesByChannel[activeChannelId] ?? []
    if (currentMessages.length === 0) return

    const oldestMessage = currentMessages[0]
    await loadMessages(activeChannelId, oldestMessage.id)
  }, [activeChannelId, isLoading, hasMore, messagesByChannel])

  // Set active channel (also marks as read)
  const setActiveChannelId = useCallback(
    (channelId: string) => {
      setActiveChannelIdState(channelId)

      // Mark as read locally
      setChannels((prev) =>
        prev.map((ch) => (ch.id === channelId ? { ...ch, unreadCount: 0 } : ch))
      )

      // Send mark read to server
      if (isConnected) {
        sendMessage('chat:mark_read', { channelId })
      }
    },
    [sendMessage, isConnected]
  )

  // Send a chat message
  const sendChatMessage = useCallback(
    (content: string) => {
      if (!activeChannelId || !content.trim()) return

      sendMessage('chat:message', {
        channelId: activeChannelId,
        content: content.trim(),
      })
    },
    [activeChannelId, sendMessage]
  )

  // Create a new channel
  const createChannel = useCallback(
    async (participantIds: string[], name?: string): Promise<ChatChannel | null> => {
      try {
        const response = await fetch(`${API_URL}/api/sessions/${sessionId}/channels`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ participantIds, name }),
        })

        if (!response.ok) {
          console.error('Failed to create channel:', response.status)
          return null
        }

        const data = await response.json()
        const channel = data.channel as ChatChannel

        // The server will broadcast chat:channel_created to add it to channels
        // But we return it immediately for the caller
        return channel
      } catch (err) {
        console.error('Error creating channel:', err)
        return null
      }
    },
    [sessionId]
  )

  // Mark a channel as read
  const markChannelRead = useCallback(
    (channelId: string) => {
      // Mark as read locally
      setChannels((prev) =>
        prev.map((ch) => (ch.id === channelId ? { ...ch, unreadCount: 0 } : ch))
      )

      // Send to server
      if (isConnected) {
        sendMessage('chat:mark_read', { channelId })
      }
    },
    [sendMessage, isConnected]
  )

  return {
    channels,
    activeChannelId,
    setActiveChannelId,
    createChannel,
    messages,
    sendChatMessage,
    loadMore,
    hasMore,
    isLoading,
    totalUnreadCount,
    markChannelRead,
  }
}
