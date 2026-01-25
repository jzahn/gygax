import * as React from 'react'

export type WallMode = 'add' | 'remove'

interface WallPaletteProps {
  mode: WallMode
  onModeChange: (mode: WallMode) => void
  onHover?: (mode: WallMode | null) => void
}

interface ModeButtonProps {
  mode: WallMode
  currentMode: WallMode
  onClick: () => void
  onHover?: (mode: WallMode | null) => void
  children: React.ReactNode
}

function ModeButton({ mode, currentMode, onClick, onHover, children }: ModeButtonProps) {
  const isSelected = mode === currentMode
  return (
    <button
      onClick={onClick}
      onMouseEnter={() => onHover?.(mode)}
      onMouseLeave={() => onHover?.(null)}
      className={`
        flex h-9 flex-1 items-center justify-center border-2 transition-all
        ${
          isSelected
            ? '-translate-y-0.5 border-ink bg-white shadow-brutal'
            : 'border-ink bg-parchment-100 shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal'
        }
      `}
    >
      {children}
    </button>
  )
}

// Filled square icon for Add mode
function AddIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
      <rect x="4" y="4" width="16" height="16" rx="1" />
    </svg>
  )
}

// Empty square icon for Remove mode
function RemoveIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="1" />
    </svg>
  )
}

export function WallPalette({ mode, onModeChange, onHover }: WallPaletteProps) {
  return (
    <div className="flex flex-col gap-2 p-2">
      <div className="flex gap-1">
        <ModeButton
          mode="add"
          currentMode={mode}
          onClick={() => onModeChange('add')}
          onHover={onHover}
        >
          <AddIcon />
        </ModeButton>
        <ModeButton
          mode="remove"
          currentMode={mode}
          onClick={() => onModeChange('remove')}
          onHover={onHover}
        >
          <RemoveIcon />
        </ModeButton>
      </div>
    </div>
  )
}
