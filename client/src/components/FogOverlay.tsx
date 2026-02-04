import * as React from 'react'
import type { Map, CellCoord, GridType } from '@gygax/shared'

interface FogOverlayProps {
  map: Map
  revealedCells: CellCoord[]
  isDm: boolean
  className?: string
}

// Get hex corner point (flat-top orientation)
function hexCorner(cx: number, cy: number, size: number, i: number) {
  const angleDeg = 60 * i
  const angleRad = (Math.PI / 180) * angleDeg
  return {
    x: cx + size * Math.cos(angleRad),
    y: cy + size * Math.sin(angleRad),
  }
}

// Draw a single hex path on canvas
function drawHexPath(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  cellSize: number
) {
  const size = cellSize / 2
  const hexHeight = Math.sqrt(3) * size
  const horizSpacing = size * 1.5
  const vertSpacing = hexHeight

  const cx = size + col * horizSpacing
  const cy = hexHeight / 2 + row * vertSpacing + (col % 2 === 1 ? vertSpacing / 2 : 0)

  ctx.beginPath()
  const start = hexCorner(cx, cy, size, 0)
  ctx.moveTo(start.x, start.y)
  for (let i = 1; i <= 6; i++) {
    const corner = hexCorner(cx, cy, size, i % 6)
    ctx.lineTo(corner.x, corner.y)
  }
  ctx.closePath()
}

// Check if a cell is revealed
function isCellRevealed(
  col: number,
  row: number,
  revealedSet: Set<string>,
  gridType: GridType
): boolean {
  if (gridType === 'HEX') {
    // For hex, use q/r coordinates
    return revealedSet.has(`hex:${col},${row}`)
  } else {
    // For square, use col/row coordinates
    return revealedSet.has(`sq:${col},${row}`)
  }
}

export function FogOverlay({ map, revealedCells, isDm, className = '' }: FogOverlayProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 })

  // Build a Set for O(1) lookup
  const revealedSet = React.useMemo(() => {
    const set = new Set<string>()
    for (const cell of revealedCells) {
      if (cell.col !== undefined && cell.row !== undefined) {
        set.add(`sq:${cell.col},${cell.row}`)
      }
      if (cell.q !== undefined && cell.r !== undefined) {
        set.add(`hex:${cell.q},${cell.r}`)
      }
    }
    return set
  }, [revealedCells])

  // Observe container size
  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        })
      }
    })

    resizeObserver.observe(container)
    return () => resizeObserver.disconnect()
  }, [])

  // Render fog
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || containerSize.width === 0 || containerSize.height === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1

    // Set canvas size
    canvas.width = containerSize.width * dpr
    canvas.height = containerSize.height * dpr
    canvas.style.width = `${containerSize.width}px`
    canvas.style.height = `${containerSize.height}px`

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.clearRect(0, 0, containerSize.width, containerSize.height)

    // Fog color (parchment-200)
    const FOG_COLOR = isDm ? 'rgba(214, 207, 190, 0.4)' : '#D6CFBE'

    // For DM, we don't draw solid fog - just a subtle indicator
    // For players, we draw solid fog over unrevealed cells

    if (map.gridType === 'HEX') {
      // Hex grid fog
      for (let col = 0; col < map.width; col++) {
        for (let row = 0; row < map.height; row++) {
          const isRevealed = isCellRevealed(col, row, revealedSet, 'HEX')
          if (!isRevealed) {
            drawHexPath(ctx, col, row, map.cellSize)
            ctx.fillStyle = FOG_COLOR
            ctx.fill()
          }
        }
      }
    } else {
      // Square grid fog
      for (let col = 0; col < map.width; col++) {
        for (let row = 0; row < map.height; row++) {
          const isRevealed = isCellRevealed(col, row, revealedSet, 'SQUARE')
          if (!isRevealed) {
            ctx.fillStyle = FOG_COLOR
            ctx.fillRect(
              col * map.cellSize,
              row * map.cellSize,
              map.cellSize,
              map.cellSize
            )
          }
        }
      }
    }

    // Draw fog edge border (where revealed meets unrevealed)
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2

    if (map.gridType === 'HEX') {
      // For hex, draw edge between revealed and unrevealed hexes
      // (Simplified - just draw borders around unrevealed areas)
      for (let col = 0; col < map.width; col++) {
        for (let row = 0; row < map.height; row++) {
          const isRevealed = isCellRevealed(col, row, revealedSet, 'HEX')
          if (isRevealed) {
            // Check neighbors and draw edge if neighbor is unrevealed
            // For hex, neighbors depend on odd/even column
            // Simplified: just outline the revealed hex
            drawHexPath(ctx, col, row, map.cellSize)
            ctx.stroke()
          }
        }
      }
    } else {
      // For square, draw edge between revealed and unrevealed squares
      for (let col = 0; col < map.width; col++) {
        for (let row = 0; row < map.height; row++) {
          const isRevealed = isCellRevealed(col, row, revealedSet, 'SQUARE')
          if (!isRevealed) continue

          const x = col * map.cellSize
          const y = row * map.cellSize
          const size = map.cellSize

          // Check each edge
          // Top edge
          if (row === 0 || !isCellRevealed(col, row - 1, revealedSet, 'SQUARE')) {
            ctx.beginPath()
            ctx.moveTo(x, y)
            ctx.lineTo(x + size, y)
            ctx.stroke()
          }
          // Bottom edge
          if (row === map.height - 1 || !isCellRevealed(col, row + 1, revealedSet, 'SQUARE')) {
            ctx.beginPath()
            ctx.moveTo(x, y + size)
            ctx.lineTo(x + size, y + size)
            ctx.stroke()
          }
          // Left edge
          if (col === 0 || !isCellRevealed(col - 1, row, revealedSet, 'SQUARE')) {
            ctx.beginPath()
            ctx.moveTo(x, y)
            ctx.lineTo(x, y + size)
            ctx.stroke()
          }
          // Right edge
          if (col === map.width - 1 || !isCellRevealed(col + 1, row, revealedSet, 'SQUARE')) {
            ctx.beginPath()
            ctx.moveTo(x + size, y)
            ctx.lineTo(x + size, y + size)
            ctx.stroke()
          }
        }
      }
    }
  }, [map, containerSize, revealedSet, isDm])

  return (
    <div ref={containerRef} className={`pointer-events-none absolute inset-0 ${className}`}>
      <canvas ref={canvasRef} className="h-full w-full" />
    </div>
  )
}
