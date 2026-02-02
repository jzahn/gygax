import { useState, type ReactNode } from 'react'

interface FloatingConsoleProps {
  isDM: boolean
  chatUnreadCount: number
  dmToolsContent: ReactNode
  chatContent: ReactNode
}

export function FloatingConsole({
  isDM,
  chatUnreadCount,
  dmToolsContent,
  chatContent,
}: FloatingConsoleProps) {
  const [isMinimized, setIsMinimized] = useState(false)
  const [activeTab, setActiveTab] = useState<'dm' | 'chat'>(isDM ? 'dm' : 'chat')

  // Minimized state - small floating icon
  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="floating-console-icon group"
        aria-label="Open console"
      >
        {/* Scroll/tome icon */}
        <div className="floating-console-icon-inner">
          <span className="floating-console-icon-glyph">&#128220;</span>
          {chatUnreadCount > 0 && (
            <span className="floating-console-badge animate-unread-pulse">
              {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
            </span>
          )}
        </div>
        <span className="floating-console-tooltip">
          {isDM ? 'DM Console' : 'Chat'}
        </span>
      </button>
    )
  }

  return (
    <div className="floating-console">
      {/* Header with tabs and minimize */}
      <div className="floating-console-header">
        {/* Tab bar */}
        <div className="floating-console-tabs">
          {isDM && (
            <button
              onClick={() => setActiveTab('dm')}
              className={`floating-console-tab ${activeTab === 'dm' ? 'active' : ''}`}
            >
              <span className="floating-console-tab-icon">&#9881;</span>
              <span>DM Tools</span>
            </button>
          )}
          <button
            onClick={() => setActiveTab('chat')}
            className={`floating-console-tab ${activeTab === 'chat' ? 'active' : ''}`}
          >
            <span className="floating-console-tab-icon">&#128172;</span>
            <span>Chat</span>
            {chatUnreadCount > 0 && activeTab !== 'chat' && (
              <span className="floating-console-tab-badge">
                {chatUnreadCount > 9 ? '9+' : chatUnreadCount}
              </span>
            )}
          </button>
        </div>

        {/* Minimize button */}
        <button
          onClick={() => setIsMinimized(true)}
          className="floating-console-minimize"
          aria-label="Minimize console"
        >
          <span>&#8722;</span>
        </button>
      </div>

      {/* Content area */}
      <div
        className={`floating-console-content ${
          activeTab === 'dm' ? 'dm-mode' : 'chat-mode'
        }`}
      >
        {activeTab === 'dm' && dmToolsContent}
        {activeTab === 'chat' && chatContent}
      </div>
    </div>
  )
}
