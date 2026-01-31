import type { ChatMessage as ChatMessageType } from '@gygax/shared'
import { DiceRollCard } from './DiceRollCard'
import { SystemMessage } from './SystemMessage'

interface ChatMessageProps {
  message: ChatMessageType
  showSender?: boolean // Set to false when grouping consecutive messages
}

export function ChatMessage({ message, showSender = true }: ChatMessageProps) {
  if (message.type === 'SYSTEM') {
    return <SystemMessage content={message.content} />
  }

  if (message.type === 'ROLL') {
    return <DiceRollCard message={message} />
  }

  // Regular text message
  const timestamp = new Date(message.createdAt).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })

  return (
    <div className="py-1 animate-chat-message">
      {showSender && (
        <div className="flex items-baseline justify-between">
          <span className="chat-sender-name">{message.sender.name}</span>
          <span className="chat-timestamp">{timestamp}</span>
        </div>
      )}
      <div className="chat-message-body">{message.content}</div>
    </div>
  )
}
