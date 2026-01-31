import { useState, useCallback, type KeyboardEvent, type ChangeEvent } from 'react'
import type { ChatChannel } from '@gygax/shared'

interface ChatInputProps {
  channel: ChatChannel | null
  onSend: (content: string) => void
  disabled?: boolean
}

export function ChatInput({ channel, onSend, disabled = false }: ChatInputProps) {
  const [value, setValue] = useState('')
  const [showRollHint, setShowRollHint] = useState(false)

  // Determine placeholder based on channel type
  const getPlaceholder = () => {
    if (!channel) return 'Select a channel...'
    if (channel.isMain) return 'Address the party...'
    if (channel.participants.length === 2) {
      const otherParticipant = channel.participants.find((p) => p.name !== channel.name)
      return `Whisper to ${otherParticipant?.name || 'them'}...`
    }
    return `Message ${channel.name || 'the group'}...`
  }

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value
    setValue(newValue)

    // Show hint when typing /r
    setShowRollHint(newValue.toLowerCase().startsWith('/r'))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleSend = useCallback(() => {
    if (!value.trim() || disabled) return
    onSend(value.trim())
    setValue('')
    setShowRollHint(false)
  }, [value, disabled, onSend])

  return (
    <div className="relative flex items-center gap-2 p-2 border-t-2 border-ink bg-parchment-100">
      {showRollHint && (
        <div className="absolute bottom-full left-2 mb-1 px-2 py-1 bg-parchment-300 border border-ink text-xs font-input">
          /roll NdS+M (e.g., /roll 1d20+5)
        </div>
      )}
      <input
        type="text"
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        placeholder={getPlaceholder()}
        disabled={disabled || !channel}
        className="chat-input flex-1"
      />
      <button
        onClick={handleSend}
        disabled={disabled || !value.trim() || !channel}
        className="btn-brutal bg-ink text-parchment-100 px-4 py-2 border-3 border-ink font-display text-sm uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Send
      </button>
    </div>
  )
}
