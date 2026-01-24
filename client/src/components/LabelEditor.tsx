import * as React from 'react'
import type { MapPoint, TextSize } from '@gygax/shared'
import { getLabelFontSize } from '../utils/labelUtils'

interface LabelEditorProps {
  position: MapPoint
  initialText: string
  size: TextSize
  zoom: number
  offset: { x: number; y: number }
  onConfirm: (text: string) => void
  onCancel: () => void
}

export function LabelEditor({
  position,
  initialText,
  size,
  zoom,
  offset,
  onConfirm,
  onCancel,
}: LabelEditorProps) {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null)
  const [text, setText] = React.useState(initialText)
  const mountedRef = React.useRef(false)

  // Calculate screen position from map position
  const screenX = position.x * zoom + offset.x
  const screenY = position.y * zoom + offset.y

  // Calculate font size based on label size and zoom
  const fontSize = getLabelFontSize(size) * zoom

  // Auto-focus textarea on mount with a small delay to prevent immediate blur issues
  React.useEffect(() => {
    const timer = setTimeout(() => {
      textareaRef.current?.focus()
      textareaRef.current?.select()
      mountedRef.current = true
    }, 10)
    return () => clearTimeout(timer)
  }, [])

  const handleConfirm = () => {
    const trimmed = text.trim()
    onConfirm(trimmed)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      // Enter without Shift confirms
      e.preventDefault()
      handleConfirm()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onCancel()
    }
    // Shift+Enter allows default behavior (newline)
  }

  const handleBlur = () => {
    // Only handle blur after the component has fully mounted
    // This prevents immediate closure from focus stealing
    if (!mountedRef.current) return
    handleConfirm()
  }

  // Calculate textarea dimensions based on content
  const lines = text.split('\n')
  const maxLineLength = Math.max(...lines.map((l) => l.length), 10)
  const numLines = lines.length

  return (
    <div
      className="pointer-events-auto absolute"
      style={{
        left: screenX,
        top: screenY,
        transform: 'translate(-50%, -50%)',
      }}
    >
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        onBlur={handleBlur}
        className="resize-none border-2 border-ink bg-white/90 px-2 py-0.5 text-center font-fell text-ink focus:outline-none"
        style={{
          fontSize: `${fontSize}px`,
          lineHeight: 1.2,
          minWidth: '100px',
          width: `${Math.max(100, maxLineLength * fontSize * 0.6 + 20)}px`,
          height: `${Math.max(fontSize * 1.5, numLines * fontSize * 1.2 + 10)}px`,
        }}
        maxLength={200}
        placeholder="Enter label..."
      />
    </div>
  )
}
