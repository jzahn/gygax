import * as React from 'react'
import type { PathType } from '@gygax/shared'
import { getPathStyle } from '../utils/pathUtils'

const PATH_TYPES: PathType[] = ['road', 'trail', 'river', 'stream', 'border']

interface PathPaletteProps {
  selectedPath: PathType
  onPathChange: (path: PathType) => void
  onHover?: (path: PathType | null) => void
}

interface PathButtonProps {
  pathType: PathType
  isSelected: boolean
  onClick: () => void
  onHover?: (path: PathType | null) => void
}

function PathButton({ pathType, isSelected, onClick, onHover }: PathButtonProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)

  // Draw path preview on canvas
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const width = 64
    const height = 28

    canvas.width = width * dpr
    canvas.height = height * dpr
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)

    // Clear
    ctx.fillStyle = isSelected ? '#ffffff' : '#faf5eb'
    ctx.fillRect(0, 0, width, height)

    // Draw path preview line
    const style = getPathStyle(pathType)
    ctx.strokeStyle = style.color
    ctx.lineWidth = Math.max(style.width * 0.75, 2)
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'

    if (style.dash.length > 0) {
      ctx.setLineDash(style.dash.map((d) => d * 0.6))
    } else {
      ctx.setLineDash([])
    }

    ctx.beginPath()
    ctx.moveTo(8, height / 2)
    ctx.lineTo(width - 8, height / 2)
    ctx.stroke()
  }, [pathType, isSelected])

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => onHover?.(pathType)}
      onMouseLeave={() => onHover?.(null)}
      className={`
        flex items-center justify-center border-2 transition-all
        ${
          isSelected
            ? '-translate-y-0.5 border-ink bg-white shadow-brutal'
            : 'border-ink bg-parchment-100 shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal'
        }
      `}
    >
      <canvas ref={canvasRef} className="block" />
    </button>
  )
}

export function PathPalette({ selectedPath, onPathChange, onHover }: PathPaletteProps) {
  return (
    <div className="flex flex-col gap-1 p-2">
      {PATH_TYPES.map((pathType) => (
        <PathButton
          key={pathType}
          pathType={pathType}
          isSelected={selectedPath === pathType}
          onClick={() => onPathChange(pathType)}
          onHover={onHover}
        />
      ))}
      <div className="mt-1 border-t border-ink-faded pt-1 text-center font-mono text-xs text-ink-faded">
        1-5 to select
      </div>
    </div>
  )
}
