interface ModeToggleProps {
  activeMode: 'dm' | 'chat'
  onModeChange: (mode: 'dm' | 'chat') => void
  chatUnreadCount: number
  isDM: boolean
}

export function ModeToggle({
  activeMode,
  onModeChange,
  chatUnreadCount,
  isDM,
}: ModeToggleProps) {
  // Players don't see the toggle - they only have chat
  if (!isDM) {
    return null
  }

  return (
    <div className="mode-toggle">
      <button
        className={`mode-toggle-option ${activeMode === 'dm' ? 'active' : ''}`}
        onClick={() => onModeChange('dm')}
      >
        DM Tools
      </button>
      <button
        className={`mode-toggle-option ${activeMode === 'chat' ? 'active' : ''}`}
        onClick={() => onModeChange('chat')}
      >
        Chat
        {chatUnreadCount > 0 && (
          <span className="mode-toggle-badge animate-unread-pulse">
            {chatUnreadCount > 99 ? '99+' : chatUnreadCount}
          </span>
        )}
      </button>
    </div>
  )
}
