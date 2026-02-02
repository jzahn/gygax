import { useRef, useEffect, useState, useCallback } from 'react'
import type { ChatChannel, ChatMessage as ChatMessageType } from '@gygax/shared'
import { ChatTabs } from './ChatTabs'
import { ChatMessage } from './ChatMessage'
import { ChatInput } from './ChatInput'
import { CreateChannelDialog } from './CreateChannelDialog'

interface ChatPanelProps {
  channels: ChatChannel[]
  activeChannelId: string | null
  messages: ChatMessageType[]
  hasMore: boolean
  isLoading: boolean
  onSelectChannel: (channelId: string) => void
  onSendMessage: (content: string) => void
  onLoadMore: () => void
  onCreateChannel: (participantIds: string[], name?: string) => Promise<void>
  // For create channel dialog
  sessionParticipants: Array<{
    userId: string
    userName: string
    avatarUrl: string | null
    characterName?: string
  }>
  currentUserId: string
  // Panel state
  collapsed?: boolean
  onToggleCollapse?: () => void
}

export function ChatPanel({
  channels,
  activeChannelId,
  messages,
  hasMore,
  isLoading,
  onSelectChannel,
  onSendMessage,
  onLoadMore,
  onCreateChannel,
  sessionParticipants,
  currentUserId,
  collapsed = false,
  onToggleCollapse,
}: ChatPanelProps) {
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const [showNewMessageIndicator, setShowNewMessageIndicator] = useState(false)
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [isScrolledToBottom, setIsScrolledToBottom] = useState(true)

  const activeChannel = channels.find((c) => c.id === activeChannelId) ?? null

  // Auto-scroll to bottom when new messages arrive (if already at bottom)
  useEffect(() => {
    if (isScrolledToBottom && messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
    } else if (!isScrolledToBottom && messages.length > 0) {
      setShowNewMessageIndicator(true)
    }
  }, [messages, isScrolledToBottom])

  // Track scroll position
  const handleScroll = useCallback(() => {
    if (!messagesContainerRef.current) return
    const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current
    const atBottom = scrollHeight - scrollTop - clientHeight < 50
    setIsScrolledToBottom(atBottom)
    if (atBottom) {
      setShowNewMessageIndicator(false)
    }
  }, [])

  // Scroll to bottom when clicking indicator
  const scrollToBottom = () => {
    if (messagesContainerRef.current) {
      messagesContainerRef.current.scrollTop = messagesContainerRef.current.scrollHeight
      setShowNewMessageIndicator(false)
    }
  }

  // Group consecutive messages from the same sender within 1 minute
  const groupedMessages = messages.reduce<Array<{ message: ChatMessageType; showSender: boolean }>>(
    (acc, message, index) => {
      const prevMessage = index > 0 ? messages[index - 1] : null
      const showSender =
        !prevMessage ||
        prevMessage.sender.id !== message.sender.id ||
        prevMessage.type !== message.type ||
        new Date(message.createdAt).getTime() - new Date(prevMessage.createdAt).getTime() > 60000

      acc.push({ message, showSender })
      return acc
    },
    []
  )

  // Collapsed view - just show tabs with unread badges (legacy desktop mode)
  if (collapsed) {
    return (
      <div className="bg-parchment-100">
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-between px-3 py-2 hover:bg-parchment-200"
        >
          <span className="font-display text-sm uppercase tracking-wider">Chat</span>
          <span className="text-ink-faded">&#9660;</span>
        </button>
        <ChatTabs
          channels={channels}
          activeChannelId={activeChannelId}
          onSelectChannel={(id) => {
            onSelectChannel(id)
            onToggleCollapse?.()
          }}
          onCreateChannel={() => {
            setShowCreateDialog(true)
            onToggleCollapse?.()
          }}
        />
      </div>
    )
  }

  return (
    <div className="flex flex-col bg-parchment-100 h-full min-h-0">
      {/* Header with collapse button (only shown when onToggleCollapse provided - old desktop mode) */}
      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="w-full flex items-center justify-between px-3 py-1 bg-parchment-200 border-b border-ink hover:bg-parchment-300"
        >
          <span className="font-display text-sm uppercase tracking-wider">Chat</span>
          <span className="text-ink-faded">&#9650;</span>
        </button>
      )}

      {/* Channel tabs */}
      <ChatTabs
        channels={channels}
        activeChannelId={activeChannelId}
        onSelectChannel={onSelectChannel}
        onCreateChannel={() => setShowCreateDialog(true)}
      />

      {/* Private channel header */}
      {activeChannel && !activeChannel.isMain && (
        <div className="private-channel-header">
          <span>&#128274;</span>
          <span>
            Private:{' '}
            {activeChannel.name ||
              `You and ${activeChannel.participants.map((p) => p.name).join(', ')}`}
          </span>
        </div>
      )}

      {/* Messages area */}
      <div
        ref={messagesContainerRef}
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto px-3 py-2 chat-scroll-container"
      >
        {/* Load more button */}
        {hasMore && (
          <div className="text-center py-2">
            <button
              onClick={onLoadMore}
              disabled={isLoading}
              className="text-sm text-ink-faded hover:text-ink underline disabled:opacity-50"
            >
              {isLoading ? 'Loading...' : 'Load older messages'}
            </button>
          </div>
        )}

        {/* Messages */}
        {groupedMessages.map(({ message, showSender }) => (
          <ChatMessage key={message.id} message={message} showSender={showSender} />
        ))}

        {/* Empty state */}
        {messages.length === 0 && !isLoading && (
          <div className="text-center py-8 text-ink-ghost italic">
            No messages yet. Start the conversation!
          </div>
        )}
      </div>

      {/* New messages indicator */}
      {showNewMessageIndicator && (
        <div className="new-messages-indicator">
          <button onClick={scrollToBottom}>&#8595; New messages below</button>
        </div>
      )}

      {/* Input area */}
      <ChatInput channel={activeChannel} onSend={onSendMessage} />

      {/* Create channel dialog */}
      <CreateChannelDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        participants={sessionParticipants}
        currentUserId={currentUserId}
        onCreateChannel={onCreateChannel}
      />
    </div>
  )
}
