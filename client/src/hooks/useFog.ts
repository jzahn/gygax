import { useState, useEffect, useCallback, useRef } from 'react'
import type { CellCoord, WSMessage, WSFogState, WSFogUpdated } from '@gygax/shared'

interface UseFogOptions {
  mapId: string | null
  isDm: boolean
  lastMessage: WSMessage | null
  fogState: WSFogState | null  // Dedicated fog state from socket (avoids message batching issues)
  sendMessage: (type: string, payload: unknown) => void
  isConnected: boolean
}

interface UseFogReturn {
  revealedCells: CellCoord[]
  isFullyRevealed: boolean
  isRevealed: (coord: CellCoord) => boolean
  revealCells: (cells: CellCoord[]) => void
  revealAll: () => void
  hideAll: () => void
}

// Check if two cell coordinates are equal
function cellsEqual(a: CellCoord, b: CellCoord): boolean {
  // Square grid comparison
  if (a.col !== undefined && a.row !== undefined && b.col !== undefined && b.row !== undefined) {
    return a.col === b.col && a.row === b.row
  }
  // Hex grid comparison
  if (a.q !== undefined && a.r !== undefined && b.q !== undefined && b.r !== undefined) {
    return a.q === b.q && a.r === b.r
  }
  return false
}

export function useFog({
  mapId,
  isDm,
  lastMessage,
  fogState,
  sendMessage,
  isConnected,
}: UseFogOptions): UseFogReturn {
  const [revealedCells, setRevealedCells] = useState<CellCoord[]>([])
  const [isFullyRevealed, setIsFullyRevealed] = useState(false)

  // Create a Set for O(1) lookup (using string keys)
  const revealedSetRef = useRef<Set<string>>(new Set())

  // Convert coord to string key for Set
  const coordToKey = (coord: CellCoord): string => {
    if (coord.col !== undefined && coord.row !== undefined) {
      return `sq:${coord.col},${coord.row}`
    }
    if (coord.q !== undefined && coord.r !== undefined) {
      return `hex:${coord.q},${coord.r}`
    }
    return ''
  }

  // Update the Set when revealedCells changes
  useEffect(() => {
    const newSet = new Set<string>()
    for (const cell of revealedCells) {
      newSet.add(coordToKey(cell))
    }
    revealedSetRef.current = newSet
  }, [revealedCells])

  // Reset when map changes
  useEffect(() => {
    setRevealedCells([])
    setIsFullyRevealed(false)
    revealedSetRef.current = new Set()

    // Request fog state for the new map (backup in case proactive send is missed)
    if (mapId && isConnected) {
      sendMessage('fog:get-state', { mapId })
    }
  }, [mapId, isConnected, sendMessage])

  // Apply fog state from dedicated socket state (handles proactive sends reliably)
  useEffect(() => {
    if (fogState && fogState.mapId === mapId) {
      setRevealedCells(fogState.revealedCells)
    }
  }, [fogState, mapId])

  // Handle incremental fog updates via lastMessage
  useEffect(() => {
    if (!lastMessage) return

    if (lastMessage.type === 'fog:updated') {
      const payload = lastMessage.payload as WSFogUpdated
      if (payload.mapId === mapId) {
        setRevealedCells((prev) => {
          // Add newly revealed cells
          const newCells = payload.newlyRevealed.filter(
            (cell) => !prev.some((existing) => cellsEqual(existing, cell))
          )
          return [...prev, ...newCells]
        })
      }
    }
  }, [lastMessage, mapId])

  // Check if a cell is revealed
  const isRevealed = useCallback((coord: CellCoord): boolean => {
    return revealedSetRef.current.has(coordToKey(coord))
  }, [])

  // Reveal cells (DM only) - optimistic update
  const revealCells = useCallback((cells: CellCoord[]) => {
    if (!isDm || !mapId || cells.length === 0) return

    // Optimistic update - immediately show revealed cells locally
    setRevealedCells((prev) => {
      const newCells = cells.filter(
        (cell) => !prev.some((existing) => cellsEqual(existing, cell))
      )
      if (newCells.length === 0) return prev
      return [...prev, ...newCells]
    })

    // Send to server for persistence
    sendMessage('fog:reveal', { mapId, cells })
  }, [isDm, mapId, sendMessage])

  // Reveal all cells (DM only)
  const revealAll = useCallback(() => {
    if (!isDm || !mapId) return
    sendMessage('fog:reveal-all', { mapId })
    setIsFullyRevealed(true)
  }, [isDm, mapId, sendMessage])

  // Hide all cells / reset fog (DM only)
  const hideAll = useCallback(() => {
    if (!isDm || !mapId) return
    sendMessage('fog:hide-all', { mapId })
    setIsFullyRevealed(false)
  }, [isDm, mapId, sendMessage])

  return {
    revealedCells,
    isFullyRevealed,
    isRevealed,
    revealCells,
    revealAll,
    hideAll,
  }
}
