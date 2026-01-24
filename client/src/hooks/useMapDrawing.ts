import * as React from 'react'
import type { HexCoord, TerrainType, MapContent, TerrainStamp } from '@gygax/shared'
import { hexKey, parseHexKey } from '../utils/hexUtils'
import { getRandomVariant } from '../utils/terrainIcons'

export type DrawingTool = 'pan' | 'terrain' | 'erase'
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// Stored terrain data includes the variant
export interface StoredTerrain {
  terrain: TerrainType
  variant: 0 | 1 | 2
}

export interface DrawingState {
  tool: DrawingTool
  previousTool: DrawingTool
  selectedTerrain: TerrainType
  terrain: Map<string, StoredTerrain>
  hoveredHex: HexCoord | null
  saveStatus: SaveStatus
  isSpaceHeld: boolean
}

interface UseMapDrawingOptions {
  initialContent: MapContent | null
  onSave: (content: MapContent) => Promise<void>
}

interface UseMapDrawingReturn {
  state: DrawingState
  setTool: (tool: DrawingTool) => void
  setSelectedTerrain: (terrain: TerrainType) => void
  stampTerrain: (hex: HexCoord) => void
  setHoveredHex: (hex: HexCoord | null) => void
  handleSpaceDown: () => void
  handleSpaceUp: () => void
}

function terrainArrayToMap(stamps: TerrainStamp[]): Map<string, StoredTerrain> {
  const map = new Map<string, StoredTerrain>()
  for (const stamp of stamps) {
    map.set(hexKey(stamp.hex), {
      terrain: stamp.terrain,
      variant: stamp.variant ?? 0,
    })
  }
  return map
}

function terrainMapToArray(terrain: Map<string, StoredTerrain>): TerrainStamp[] {
  return Array.from(terrain.entries()).map(([key, stored]) => ({
    hex: parseHexKey(key),
    terrain: stored.terrain,
    variant: stored.variant,
  }))
}

export function useMapDrawing({ initialContent, onSave }: UseMapDrawingOptions): UseMapDrawingReturn {
  const [state, setState] = React.useState<DrawingState>(() => ({
    tool: 'pan',
    previousTool: 'pan',
    selectedTerrain: 'forest',
    terrain: initialContent ? terrainArrayToMap(initialContent.terrain) : new Map(),
    hoveredHex: null,
    saveStatus: 'idle',
    isSpaceHeld: false,
  }))

  // Keep a ref to the latest terrain for use in the save timeout
  const terrainRef = React.useRef(state.terrain)
  React.useEffect(() => {
    terrainRef.current = state.terrain
  }, [state.terrain])

  // Sync initial content when it becomes available (after map loads)
  const hasLoadedInitialContent = React.useRef(false)
  React.useEffect(() => {
    if (initialContent && !hasLoadedInitialContent.current) {
      hasLoadedInitialContent.current = true
      const loadedTerrain = terrainArrayToMap(initialContent.terrain)
      setState((s) => ({ ...s, terrain: loadedTerrain }))
      terrainRef.current = loadedTerrain
    }
  }, [initialContent])

  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDirtyRef = React.useRef(false)

  // Debounced save - uses ref to get current terrain
  const scheduleSave = React.useCallback(() => {
    isDirtyRef.current = true

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (!isDirtyRef.current) return

      setState((s) => ({ ...s, saveStatus: 'saving' }))

      try {
        const content: MapContent = {
          version: 1,
          terrain: terrainMapToArray(terrainRef.current),
        }
        await onSave(content)
        isDirtyRef.current = false
        setState((s) => ({ ...s, saveStatus: 'saved' }))

        // Reset to idle after 2 seconds
        setTimeout(() => {
          setState((s) => (s.saveStatus === 'saved' ? { ...s, saveStatus: 'idle' } : s))
        }, 2000)
      } catch {
        setState((s) => ({ ...s, saveStatus: 'error' }))
      }
    }, 2000)
  }, [onSave])

  // Cleanup on unmount
  React.useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // Keyboard shortcuts
  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      // Ignore if typing in an input
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return
      }

      switch (e.key.toLowerCase()) {
        case 'p':
          setState((s) => ({ ...s, tool: 'pan', previousTool: s.tool }))
          break
        case 't':
          setState((s) => ({ ...s, tool: 'terrain', previousTool: s.tool }))
          break
        case 'e':
          setState((s) => ({ ...s, tool: 'erase', previousTool: s.tool }))
          break
        case ' ':
          if (!e.repeat) {
            e.preventDefault()
            setState((s) => ({
              ...s,
              isSpaceHeld: true,
              previousTool: s.tool,
              tool: 'pan',
            }))
          }
          break
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === ' ') {
        setState((s) => ({
          ...s,
          isSpaceHeld: false,
          tool: s.previousTool,
        }))
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  const setTool = React.useCallback((tool: DrawingTool) => {
    setState((s) => ({ ...s, tool, previousTool: s.tool }))
  }, [])

  const setSelectedTerrain = React.useCallback((terrain: TerrainType) => {
    setState((s) => ({ ...s, selectedTerrain: terrain }))
  }, [])

  const stampTerrain = React.useCallback(
    (hex: HexCoord) => {
      setState((s) => {
        const key = hexKey(hex)
        const newTerrain = new Map(s.terrain)

        if (s.tool === 'erase') {
          newTerrain.delete(key)
        } else if (s.tool === 'terrain') {
          if (s.selectedTerrain === 'clear') {
            newTerrain.delete(key)
          } else {
            newTerrain.set(key, {
              terrain: s.selectedTerrain,
              variant: getRandomVariant(),
            })
          }
        } else {
          return s // Pan tool doesn't stamp
        }

        return { ...s, terrain: newTerrain }
      })
      scheduleSave()
    },
    [scheduleSave]
  )

  const setHoveredHex = React.useCallback((hex: HexCoord | null) => {
    setState((s) => ({ ...s, hoveredHex: hex }))
  }, [])

  const handleSpaceDown = React.useCallback(() => {
    setState((s) => ({
      ...s,
      isSpaceHeld: true,
      previousTool: s.tool,
      tool: 'pan',
    }))
  }, [])

  const handleSpaceUp = React.useCallback(() => {
    setState((s) => ({
      ...s,
      isSpaceHeld: false,
      tool: s.previousTool,
    }))
  }, [])

  return {
    state,
    setTool,
    setSelectedTerrain,
    stampTerrain,
    setHoveredHex,
    handleSpaceDown,
    handleSpaceUp,
  }
}
