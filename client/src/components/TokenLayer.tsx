import * as React from 'react'
import type { Map, SessionToken, CellCoord, GridType } from '@gygax/shared'

interface TokenLayerProps {
  map: Map
  tokens: SessionToken[]
  selectedTokenId: string | null
  revealedCells: CellCoord[]
  isDm: boolean
  onTokenClick?: (tokenId: string) => void
  onTokenDragStart?: (tokenId: string) => void
  onTokenDragEnd?: (tokenId: string, position: CellCoord) => void
  className?: string
}

// Get hex center position in pixels
function getHexCenter(col: number, row: number, cellSize: number): { x: number; y: number } {
  const size = cellSize / 2
  const hexHeight = Math.sqrt(3) * size
  const horizSpacing = size * 1.5
  const vertSpacing = hexHeight

  const cx = size + col * horizSpacing
  const cy = hexHeight / 2 + row * vertSpacing + (col % 2 === 1 ? vertSpacing / 2 : 0)

  return { x: cx, y: cy }
}

// Get square cell center position in pixels
function getSquareCenter(col: number, row: number, cellSize: number): { x: number; y: number } {
  return {
    x: col * cellSize + cellSize / 2,
    y: row * cellSize + cellSize / 2,
  }
}

// Get token position in pixels
function getTokenPosition(
  position: CellCoord,
  gridType: GridType,
  cellSize: number
): { x: number; y: number } {
  if (gridType === 'HEX') {
    const q = position.q ?? 0
    const r = position.r ?? 0
    return getHexCenter(q, r, cellSize)
  } else {
    const col = position.col ?? 0
    const row = position.row ?? 0
    return getSquareCenter(col, row, cellSize)
  }
}

// Check if a cell is revealed
function isCellRevealed(position: CellCoord, revealedSet: Set<string>): boolean {
  if (position.col !== undefined && position.row !== undefined) {
    return revealedSet.has(`sq:${position.col},${position.row}`)
  }
  if (position.q !== undefined && position.r !== undefined) {
    return revealedSet.has(`hex:${position.q},${position.r}`)
  }
  return false
}

// Get 2-letter abbreviation for a name
function getNameAbbreviation(name: string): string {
  const words = name.trim().split(/\s+/)
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

// Token colors by type
const TOKEN_BORDER_COLORS: Record<string, string> = {
  PC: '#22c55e',      // green-500
  NPC: '#3b82f6',     // blue-500
  MONSTER: '#ef4444', // red-500
}

interface TokenProps {
  token: SessionToken
  position: { x: number; y: number }
  size: number
  isSelected: boolean
  onClick?: () => void
  onDragStart?: () => void
  onDragEnd?: (position: CellCoord) => void
  gridType: GridType
  cellSize: number
}

function Token({
  token,
  position,
  size,
  isSelected,
  onClick,
  onDragStart,
  onDragEnd,
  gridType,
  cellSize,
}: TokenProps) {
  const [isDragging, setIsDragging] = React.useState(false)
  const [dragOffset, setDragOffset] = React.useState({ x: 0, y: 0 })
  const [currentPos, setCurrentPos] = React.useState(position)

  // Update position when token moves
  React.useEffect(() => {
    if (!isDragging) {
      setCurrentPos(position)
    }
  }, [position, isDragging])

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return // Only left click
    e.preventDefault()
    e.stopPropagation()

    onClick?.()

    // Start drag
    setIsDragging(true)
    setDragOffset({
      x: e.clientX - currentPos.x,
      y: e.clientY - currentPos.y,
    })
    onDragStart?.()
  }

  React.useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      setCurrentPos({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      })
    }

    const handleMouseUp = (e: MouseEvent) => {
      setIsDragging(false)

      // Calculate grid position from pixel position
      const x = e.clientX - dragOffset.x
      const y = e.clientY - dragOffset.y

      let newPosition: CellCoord

      if (gridType === 'HEX') {
        // Convert pixel to hex coordinate (simplified)
        const size = cellSize / 2
        const hexHeight = Math.sqrt(3) * size
        const horizSpacing = size * 1.5
        const vertSpacing = hexHeight

        const q = Math.round((x - size) / horizSpacing)
        const rowOffset = q % 2 === 1 ? vertSpacing / 2 : 0
        const r = Math.round((y - hexHeight / 2 - rowOffset) / vertSpacing)

        newPosition = { q, r }
      } else {
        // Convert pixel to square coordinate
        const col = Math.floor(x / cellSize)
        const row = Math.floor(y / cellSize)
        newPosition = { col, row }
      }

      onDragEnd?.(newPosition)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }
  }, [isDragging, dragOffset, gridType, cellSize, onDragEnd])

  const borderColor = token.color || TOKEN_BORDER_COLORS[token.type] || '#666666'
  const abbreviation = getNameAbbreviation(token.name)

  return (
    <div
      className={`absolute flex cursor-pointer select-none items-center justify-center border-3 bg-parchment-100 shadow-md transition-shadow ${
        isSelected ? 'ring-2 ring-ink ring-offset-1' : ''
      } ${isDragging ? 'z-50 shadow-lg' : ''}`}
      style={{
        left: currentPos.x - size / 2,
        top: currentPos.y - size / 2,
        width: size,
        height: size,
        borderColor,
        borderRadius: 2,
      }}
      onMouseDown={handleMouseDown}
      title={token.name}
    >
      {token.imageUrl ? (
        <img
          src={token.imageUrl}
          alt={token.name}
          className="h-full w-full rounded-sm object-cover"
          draggable={false}
        />
      ) : (
        <span
          className="font-display text-xs font-bold text-ink"
          style={{ fontSize: size * 0.35 }}
        >
          {abbreviation}
        </span>
      )}
    </div>
  )
}

export function TokenLayer({
  map,
  tokens,
  selectedTokenId,
  revealedCells,
  isDm,
  onTokenClick,
  onTokenDragStart,
  onTokenDragEnd,
  className = '',
}: TokenLayerProps) {
  // Build a Set for O(1) revealed cell lookup
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

  // Filter visible tokens
  // DM sees all tokens, players only see tokens in revealed cells
  const visibleTokens = React.useMemo(() => {
    if (isDm) return tokens

    return tokens.filter((token) => isCellRevealed(token.position, revealedSet))
  }, [tokens, isDm, revealedSet])

  // Token size (80% of cell size as per spec)
  const tokenSize = Math.round(map.cellSize * 0.8)

  return (
    <div className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {visibleTokens.map((token) => {
        const position = getTokenPosition(token.position, map.gridType, map.cellSize)

        return (
          <div key={token.id} className="pointer-events-auto">
            <Token
              token={token}
              position={position}
              size={tokenSize}
              isSelected={selectedTokenId === token.id}
              onClick={onTokenClick ? () => onTokenClick(token.id) : undefined}
              onDragStart={onTokenDragStart ? () => onTokenDragStart(token.id) : undefined}
              onDragEnd={onTokenDragEnd ? (pos) => onTokenDragEnd(token.id, pos) : undefined}
              gridType={map.gridType}
              cellSize={map.cellSize}
            />
          </div>
        )
      })}
    </div>
  )
}
