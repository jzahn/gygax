import { useState, type ReactNode } from 'react'
import { ModeToggle } from './ModeToggle'

interface MobileBottomPanelProps {
  isDM: boolean
  chatUnreadCount: number
  dmToolsContent: ReactNode
  chatContent: ReactNode
}

// Heights in pixels
const DRAG_HANDLE_HEIGHT = 24
const MODE_TOGGLE_HEIGHT = 43
const DM_TOOLS_CONTENT_HEIGHT = 145 // Fits dropdowns + action buttons
const CHAT_CONTENT_HEIGHT_PERCENT = 50 // Percentage of viewport for chat

export function MobileBottomPanel({
  isDM,
  chatUnreadCount,
  dmToolsContent,
  chatContent,
}: MobileBottomPanelProps) {
  // DMs can toggle between DM tools and chat
  // Players always see chat
  const [activeMode, setActiveMode] = useState<'dm' | 'chat'>(isDM ? 'dm' : 'chat')
  const [isExpanded, setIsExpanded] = useState(false)

  const headerHeight = DRAG_HANDLE_HEIGHT + (isDM ? MODE_TOGGLE_HEIGHT : 0)
  const collapsedHeight = headerHeight

  // Calculate expanded height based on active mode
  const getExpandedHeight = () => {
    if (activeMode === 'dm') {
      return headerHeight + DM_TOOLS_CONTENT_HEIGHT
    }
    // Chat uses percentage of viewport
    return Math.max(
      headerHeight + 200, // minimum
      window.innerHeight * (CHAT_CONTENT_HEIGHT_PERCENT / 100)
    )
  }

  const panelHeight = isExpanded ? getExpandedHeight() : collapsedHeight

  const toggle = () => setIsExpanded(!isExpanded)

  // Background changes based on expanded state and mode
  const bgColor = isExpanded && activeMode === 'dm' ? 'bg-ink' : 'bg-parchment-100'

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 ${bgColor} border-t-3 border-ink z-40 overflow-hidden chat-panel-expand flex flex-col`}
      style={{ height: panelHeight }}
    >
      {/* Drag handle */}
      <div
        className="chat-drag-handle flex-shrink-0"
        onClick={toggle}
      />

      {/* Mode toggle (DM only) */}
      {isDM && (
        <ModeToggle
          activeMode={activeMode}
          onModeChange={(mode) => {
            setActiveMode(mode)
            // Auto-expand when switching modes
            if (!isExpanded) {
              setIsExpanded(true)
            }
          }}
          chatUnreadCount={chatUnreadCount}
          isDM={isDM}
        />
      )}

      {/* Content area - only render when expanded */}
      {isExpanded && (
        <div className="flex-1 overflow-hidden">
          {activeMode === 'dm' ? dmToolsContent : chatContent}
        </div>
      )}
    </div>
  )
}
