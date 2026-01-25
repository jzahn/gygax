import * as React from 'react'
import type {
  HexCoord,
  TerrainType,
  MapContent,
  TerrainStamp,
  PathType,
  MapPath,
  MapPoint,
  MapLabel,
  TextSize,
  DungeonFeature,
  FeatureType,
} from '@gygax/shared'
import { hexKey, parseHexKey } from '../utils/hexUtils'
import { getRandomVariant } from '../utils/terrainIcons'
import { wallsToArray, wallsToSet, wallKey } from '../utils/featureUtils'
import type { WallMode } from '../components/WallPalette'

export type DrawingTool = 'pan' | 'terrain' | 'path' | 'label' | 'erase' | 'wall' | 'feature'
export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error'

// Stored terrain data includes the variant
export interface StoredTerrain {
  terrain: TerrainType
  variant: 0 | 1 | 2
}

export interface DrawingState {
  // Core tools
  tool: DrawingTool
  previousTool: DrawingTool
  isSpaceHeld: boolean
  saveStatus: SaveStatus

  // Terrain (hex only)
  selectedTerrain: TerrainType
  terrain: Map<string, StoredTerrain>
  hoveredHex: HexCoord | null

  // Paths (hex only)
  paths: MapPath[]
  selectedPathType: PathType
  selectedPathId: string | null
  pathInProgress: MapPoint[] | null
  draggingVertexIndex: number | null

  // Labels (both)
  labels: MapLabel[]
  selectedLabelSize: TextSize
  selectedLabelId: string | null
  labelEditingId: string | null
  draggingLabel: boolean

  // Walls (square only)
  walls: Set<string>  // "col,row" keys for O(1) lookup
  wallMode: WallMode
  hoveredCell: { col: number; row: number } | null

  // Features (square only)
  features: DungeonFeature[]
  selectedFeatureType: FeatureType
  featureRotation: 0 | 90 | 180 | 270
  selectedFeatureId: string | null
  draggingFeature: boolean
}

interface UseMapDrawingOptions {
  initialContent: MapContent | null
  onSave: (content: MapContent) => Promise<void>
  gridType: 'SQUARE' | 'HEX'
  mapWidth: number
  mapHeight: number
}

interface UseMapDrawingReturn {
  state: DrawingState
  setTool: (tool: DrawingTool) => void
  setSelectedTerrain: (terrain: TerrainType) => void
  stampTerrain: (hex: HexCoord) => void
  setHoveredHex: (hex: HexCoord | null) => void
  handleSpaceDown: () => void
  handleSpaceUp: () => void

  // Path functions
  setSelectedPathType: (type: PathType) => void
  startPath: (point: MapPoint) => void
  addPathPoint: (point: MapPoint) => void
  finishPath: () => void
  cancelPath: () => void
  selectPath: (id: string | null) => void
  deletePath: (id: string) => void
  updatePathVertex: (pathId: string, vertexIndex: number, point: MapPoint) => void
  startDraggingVertex: (vertexIndex: number) => void
  stopDraggingVertex: () => void

  // Label functions
  setSelectedLabelSize: (size: TextSize) => void
  createLabel: (position: MapPoint, text: string) => void
  startEditingLabel: (id: string) => void
  finishEditingLabel: (text: string) => void
  cancelEditingLabel: () => void
  selectLabel: (id: string | null) => void
  deleteLabel: (id: string) => void
  updateLabelPosition: (id: string, position: MapPoint) => void
  startDraggingLabel: () => void
  stopDraggingLabel: () => void

  // Wall functions (square grid only)
  setWallMode: (mode: WallMode) => void
  setHoveredCell: (cell: { col: number; row: number } | null) => void
  paintWall: (col: number, row: number) => void
  eraseWall: (col: number, row: number) => void

  // Feature functions (square grid only)
  setSelectedFeatureType: (type: FeatureType) => void
  rotateFeature: (direction: 'cw' | 'ccw') => void
  placeFeature: (col: number, row: number) => void
  selectFeature: (id: string | null) => void
  deleteFeature: (id: string) => void
  updateFeaturePosition: (id: string, col: number, row: number) => void
  rotateSelectedFeature: (direction: 'cw' | 'ccw') => void
  startDraggingFeature: () => void
  stopDraggingFeature: () => void

  // Selection
  clearSelection: () => void
  deleteSelected: () => void
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

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

export function useMapDrawing({ initialContent, onSave, gridType, mapWidth, mapHeight }: UseMapDrawingOptions): UseMapDrawingReturn {
  const isSquareGrid = gridType === 'SQUARE'

  // Use a ref for onSave to avoid stale closure issues in the save timeout
  const onSaveRef = React.useRef(onSave)
  React.useEffect(() => {
    onSaveRef.current = onSave
  }, [onSave])

  const [state, setState] = React.useState<DrawingState>(() => ({
    tool: 'pan',
    previousTool: 'pan',
    isSpaceHeld: false,
    saveStatus: 'idle',

    // Terrain
    selectedTerrain: 'forest',
    terrain: initialContent ? terrainArrayToMap(initialContent.terrain) : new Map(),
    hoveredHex: null,

    // Paths
    paths: initialContent?.paths ?? [],
    selectedPathType: 'road',
    selectedPathId: null,
    pathInProgress: null,
    draggingVertexIndex: null,

    // Labels
    labels: initialContent?.labels ?? [],
    selectedLabelSize: 'medium',
    selectedLabelId: null,
    labelEditingId: null,
    draggingLabel: false,

    // Walls
    walls: initialContent?.walls ? wallsToSet(initialContent.walls) : new Set(),
    wallMode: 'add',
    hoveredCell: null,

    // Features
    features: initialContent?.features ?? [],
    selectedFeatureType: 'door',
    featureRotation: 0,
    selectedFeatureId: null,
    draggingFeature: false,
  }))

  // Keep refs to the latest data for use in the save timeout
  const terrainRef = React.useRef(state.terrain)
  const pathsRef = React.useRef(state.paths)
  const labelsRef = React.useRef(state.labels)
  const wallsRef = React.useRef(state.walls)
  const featuresRef = React.useRef(state.features)

  React.useEffect(() => {
    terrainRef.current = state.terrain
    pathsRef.current = state.paths
    labelsRef.current = state.labels
    wallsRef.current = state.walls
    featuresRef.current = state.features
  }, [state.terrain, state.paths, state.labels, state.walls, state.features])

  // Sync initial content when it becomes available (after map loads)
  const hasLoadedInitialContent = React.useRef(false)
  React.useEffect(() => {
    if (initialContent && !hasLoadedInitialContent.current) {
      hasLoadedInitialContent.current = true
      const loadedTerrain = terrainArrayToMap(initialContent.terrain)
      const loadedWalls = initialContent.walls ? wallsToSet(initialContent.walls) : new Set<string>()
      setState((s) => ({
        ...s,
        terrain: loadedTerrain,
        paths: initialContent.paths ?? [],
        labels: initialContent.labels ?? [],
        walls: loadedWalls,
        features: initialContent.features ?? [],
      }))
      terrainRef.current = loadedTerrain
      pathsRef.current = initialContent.paths ?? []
      labelsRef.current = initialContent.labels ?? []
      wallsRef.current = loadedWalls
      featuresRef.current = initialContent.features ?? []
    }
  }, [initialContent])

  const saveTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const isDirtyRef = React.useRef(false)

  // Debounced save - uses refs to get current data and latest onSave callback
  const scheduleSave = React.useCallback(() => {
    isDirtyRef.current = true

    if (saveTimeoutRef.current) {
      clearTimeout(saveTimeoutRef.current)
    }

    saveTimeoutRef.current = setTimeout(async () => {
      if (!isDirtyRef.current) return

      setState((s) => ({ ...s, saveStatus: 'saving' }))

      try {
        const hasPaths = pathsRef.current.length > 0
        const hasLabels = labelsRef.current.length > 0
        const hasWalls = wallsRef.current.size > 0
        const hasFeatures = featuresRef.current.length > 0

        // Determine version based on content
        let version = 1
        if (hasPaths || hasLabels) version = 2
        if (hasWalls || hasFeatures) version = 3

        const content: MapContent = {
          version,
          terrain: terrainMapToArray(terrainRef.current),
          ...(hasPaths && { paths: pathsRef.current }),
          ...(hasLabels && { labels: labelsRef.current }),
          ...(hasWalls && { walls: wallsToArray(wallsRef.current) }),
          ...(hasFeatures && { features: featuresRef.current }),
        }
        // Use ref to always get the latest onSave callback
        await onSaveRef.current(content)
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
  }, [])

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

      // Ignore if editing a label
      setState((current) => {
        if (current.labelEditingId) return current
        return current
      })

      switch (e.key.toLowerCase()) {
        case 'p':
          setState((s) => {
            if (s.labelEditingId) return s
            return { ...s, tool: 'pan', previousTool: s.tool }
          })
          break
        case 't':
          setState((s) => {
            if (s.labelEditingId) return s
            // Only allow terrain tool on hex grids
            if (!isSquareGrid) {
              return { ...s, tool: 'terrain', previousTool: s.tool }
            }
            return s
          })
          break
        case 'r':
          setState((s) => {
            if (s.labelEditingId) return s
            // Only allow path tool on hex grids
            if (!isSquareGrid) {
              return { ...s, tool: 'path', previousTool: s.tool }
            }
            return s
          })
          break
        case 'w':
          setState((s) => {
            if (s.labelEditingId) return s
            // Only allow wall tool on square grids
            if (isSquareGrid) {
              return { ...s, tool: 'wall', previousTool: s.tool }
            }
            return s
          })
          break
        case 'f':
          setState((s) => {
            if (s.labelEditingId) return s
            // Only allow feature tool on square grids
            if (isSquareGrid) {
              return { ...s, tool: 'feature', previousTool: s.tool }
            }
            return s
          })
          break
        case 'l':
          setState((s) => {
            if (s.labelEditingId) return s
            return { ...s, tool: 'label', previousTool: s.tool }
          })
          break
        case 'e':
          setState((s) => {
            if (s.labelEditingId) return s
            return { ...s, tool: 'erase', previousTool: s.tool }
          })
          break
        case 'z':
          setState((s) => {
            if (s.labelEditingId) return s
            // Rotate feature (when in feature tool or when a feature is selected)
            if (s.tool === 'feature' || s.selectedFeatureId) {
              const rotations: (0 | 90 | 180 | 270)[] = [0, 90, 180, 270]
              const currentIdx = rotations.indexOf(s.featureRotation)
              const direction = e.shiftKey ? -1 : 1
              const newIdx = (currentIdx + direction + 4) % 4
              const newRotation = rotations[newIdx]

              // If a feature is selected, rotate it
              if (s.selectedFeatureId) {
                return {
                  ...s,
                  featureRotation: newRotation,
                  features: s.features.map((f) =>
                    f.id === s.selectedFeatureId ? { ...f, rotation: newRotation } : f
                  ),
                }
              }

              return { ...s, featureRotation: newRotation }
            }
            return s
          })
          if (e.key.toLowerCase() === 'z') {
            scheduleSave()
          }
          break
        case ' ':
          if (!e.repeat) {
            e.preventDefault()
            setState((s) => {
              if (s.labelEditingId) return s
              return {
                ...s,
                isSpaceHeld: true,
                previousTool: s.tool,
                tool: 'pan',
              }
            })
          }
          break
        case '1':
        case '2':
        case '3':
        case '4':
        case '5':
          setState((s) => {
            if (s.labelEditingId) return s
            const num = parseInt(e.key, 10)
            if (s.tool === 'path') {
              const pathTypes: PathType[] = ['road', 'trail', 'river', 'stream', 'border']
              if (num >= 1 && num <= 5) {
                return { ...s, selectedPathType: pathTypes[num - 1] }
              }
            } else if (s.tool === 'label') {
              const sizes: TextSize[] = ['small', 'medium', 'large', 'xlarge']
              if (num >= 1 && num <= 4) {
                return { ...s, selectedLabelSize: sizes[num - 1] }
              }
            } else if (s.tool === 'wall') {
              // 1 = add, 2 = remove
              if (num === 1) {
                return { ...s, wallMode: 'add' as WallMode }
              } else if (num === 2) {
                return { ...s, wallMode: 'remove' as WallMode }
              }
            }
            return s
          })
          break
        case 'enter':
          setState((s) => {
            if (s.labelEditingId) return s
            if (s.pathInProgress && s.pathInProgress.length >= 2) {
              // Finish path
              const newPath: MapPath = {
                id: generateId(),
                type: s.selectedPathType,
                points: s.pathInProgress,
              }
              return {
                ...s,
                paths: [...s.paths, newPath],
                pathInProgress: null,
              }
            }
            return s
          })
          // Schedule save after path creation
          scheduleSave()
          break
        case 'escape':
          setState((s) => {
            // Cancel path in progress
            if (s.pathInProgress) {
              return { ...s, pathInProgress: null }
            }
            // Deselect
            if (s.selectedPathId || s.selectedLabelId || s.selectedFeatureId) {
              return { ...s, selectedPathId: null, selectedLabelId: null, selectedFeatureId: null }
            }
            return s
          })
          break
        case 'delete':
        case 'backspace':
          setState((s) => {
            if (s.labelEditingId) return s
            // Delete selected path
            if (s.selectedPathId) {
              return {
                ...s,
                paths: s.paths.filter((p) => p.id !== s.selectedPathId),
                selectedPathId: null,
              }
            }
            // Delete selected label
            if (s.selectedLabelId) {
              return {
                ...s,
                labels: s.labels.filter((l) => l.id !== s.selectedLabelId),
                selectedLabelId: null,
              }
            }
            // Delete selected feature
            if (s.selectedFeatureId) {
              return {
                ...s,
                features: s.features.filter((f) => f.id !== s.selectedFeatureId),
                selectedFeatureId: null,
              }
            }
            return s
          })
          scheduleSave()
          break
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === ' ') {
        setState((s) => {
          if (s.labelEditingId) return s
          return {
            ...s,
            isSpaceHeld: false,
            tool: s.previousTool,
          }
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [scheduleSave, isSquareGrid])

  const setTool = React.useCallback((tool: DrawingTool) => {
    setState((s) => ({
      ...s,
      tool,
      previousTool: s.tool,
      // Clear path in progress when switching tools
      pathInProgress: tool !== 'path' ? null : s.pathInProgress,
      // Clear selections when switching tools
      selectedPathId: null,
      selectedLabelId: null,
      selectedFeatureId: null,
    }))
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

  // Path functions
  const setSelectedPathType = React.useCallback((type: PathType) => {
    setState((s) => ({ ...s, selectedPathType: type }))
  }, [])

  const startPath = React.useCallback((point: MapPoint) => {
    setState((s) => ({ ...s, pathInProgress: [point] }))
  }, [])

  const addPathPoint = React.useCallback((point: MapPoint) => {
    setState((s) => {
      if (!s.pathInProgress) return s
      return { ...s, pathInProgress: [...s.pathInProgress, point] }
    })
  }, [])

  const finishPath = React.useCallback(() => {
    setState((s) => {
      if (!s.pathInProgress || s.pathInProgress.length < 2) {
        return { ...s, pathInProgress: null }
      }

      const newPath: MapPath = {
        id: generateId(),
        type: s.selectedPathType,
        points: s.pathInProgress,
      }

      return {
        ...s,
        paths: [...s.paths, newPath],
        pathInProgress: null,
      }
    })
    scheduleSave()
  }, [scheduleSave])

  const cancelPath = React.useCallback(() => {
    setState((s) => ({ ...s, pathInProgress: null }))
  }, [])

  const selectPath = React.useCallback((id: string | null) => {
    setState((s) => ({
      ...s,
      selectedPathId: id,
      selectedLabelId: null, // Deselect label when selecting path
    }))
  }, [])

  const deletePath = React.useCallback(
    (id: string) => {
      setState((s) => ({
        ...s,
        paths: s.paths.filter((p) => p.id !== id),
        selectedPathId: s.selectedPathId === id ? null : s.selectedPathId,
      }))
      scheduleSave()
    },
    [scheduleSave]
  )

  const updatePathVertex = React.useCallback(
    (pathId: string, vertexIndex: number, point: MapPoint) => {
      setState((s) => ({
        ...s,
        paths: s.paths.map((p) => {
          if (p.id !== pathId) return p
          const newPoints = [...p.points]
          newPoints[vertexIndex] = point
          return { ...p, points: newPoints }
        }),
      }))
      scheduleSave()
    },
    [scheduleSave]
  )

  const startDraggingVertex = React.useCallback((vertexIndex: number) => {
    setState((s) => ({ ...s, draggingVertexIndex: vertexIndex }))
  }, [])

  const stopDraggingVertex = React.useCallback(() => {
    setState((s) => ({ ...s, draggingVertexIndex: null }))
  }, [])

  // Label functions
  const setSelectedLabelSize = React.useCallback((size: TextSize) => {
    setState((s) => ({ ...s, selectedLabelSize: size }))
  }, [])

  const createLabel = React.useCallback(
    (position: MapPoint, text: string) => {
      if (!text.trim()) return

      setState((s) => {
        const newLabel: MapLabel = {
          id: generateId(),
          text: text.trim(),
          position,
          size: s.selectedLabelSize,
        }
        return {
          ...s,
          labels: [...s.labels, newLabel],
          labelEditingId: null,
        }
      })
      scheduleSave()
    },
    [scheduleSave]
  )

  const startEditingLabel = React.useCallback((id: string) => {
    setState((s) => ({ ...s, labelEditingId: id, selectedLabelId: id }))
  }, [])

  const finishEditingLabel = React.useCallback(
    (text: string) => {
      setState((s) => {
        if (!s.labelEditingId) return s

        const trimmedText = text.trim()

        // If text is empty, delete the label
        if (!trimmedText) {
          return {
            ...s,
            labels: s.labels.filter((l) => l.id !== s.labelEditingId),
            labelEditingId: null,
            selectedLabelId: null,
          }
        }

        return {
          ...s,
          labels: s.labels.map((l) => (l.id === s.labelEditingId ? { ...l, text: trimmedText } : l)),
          labelEditingId: null,
        }
      })
      scheduleSave()
    },
    [scheduleSave]
  )

  const cancelEditingLabel = React.useCallback(() => {
    setState((s) => {
      // If it was a new label that hasn't been saved yet, remove it
      const editingLabel = s.labels.find((l) => l.id === s.labelEditingId)
      if (editingLabel && !editingLabel.text) {
        return {
          ...s,
          labels: s.labels.filter((l) => l.id !== s.labelEditingId),
          labelEditingId: null,
          selectedLabelId: null,
        }
      }
      return { ...s, labelEditingId: null }
    })
  }, [])

  const selectLabel = React.useCallback((id: string | null) => {
    setState((s) => ({
      ...s,
      selectedLabelId: id,
      selectedPathId: null, // Deselect path when selecting label
    }))
  }, [])

  const deleteLabel = React.useCallback(
    (id: string) => {
      setState((s) => ({
        ...s,
        labels: s.labels.filter((l) => l.id !== id),
        selectedLabelId: s.selectedLabelId === id ? null : s.selectedLabelId,
        labelEditingId: s.labelEditingId === id ? null : s.labelEditingId,
      }))
      scheduleSave()
    },
    [scheduleSave]
  )

  const updateLabelPosition = React.useCallback(
    (id: string, position: MapPoint) => {
      setState((s) => ({
        ...s,
        labels: s.labels.map((l) => (l.id === id ? { ...l, position } : l)),
      }))
      scheduleSave()
    },
    [scheduleSave]
  )

  const startDraggingLabel = React.useCallback(() => {
    setState((s) => ({ ...s, draggingLabel: true }))
  }, [])

  const stopDraggingLabel = React.useCallback(() => {
    setState((s) => ({ ...s, draggingLabel: false }))
  }, [])

  // Wall functions
  const setWallMode = React.useCallback((mode: WallMode) => {
    setState((s) => ({ ...s, wallMode: mode }))
  }, [])

  const setHoveredCell = React.useCallback((cell: { col: number; row: number } | null) => {
    setState((s) => ({ ...s, hoveredCell: cell }))
  }, [])

  const paintWall = React.useCallback(
    (col: number, row: number) => {
      if (col < 0 || col >= mapWidth || row < 0 || row >= mapHeight) return

      setState((s) => {
        const key = wallKey(col, row)
        if (s.wallMode === 'add') {
          if (s.walls.has(key)) return s // Already a wall
          const newWalls = new Set(s.walls)
          newWalls.add(key)
          return { ...s, walls: newWalls }
        } else {
          if (!s.walls.has(key)) return s // Not a wall
          const newWalls = new Set(s.walls)
          newWalls.delete(key)
          return { ...s, walls: newWalls }
        }
      })
      scheduleSave()
    },
    [mapWidth, mapHeight, scheduleSave]
  )

  const eraseWall = React.useCallback(
    (col: number, row: number) => {
      if (col < 0 || col >= mapWidth || row < 0 || row >= mapHeight) return

      setState((s) => {
        const key = wallKey(col, row)
        if (!s.walls.has(key)) return s
        const newWalls = new Set(s.walls)
        newWalls.delete(key)
        return { ...s, walls: newWalls }
      })
      scheduleSave()
    },
    [mapWidth, mapHeight, scheduleSave]
  )

  // Feature functions
  const setSelectedFeatureType = React.useCallback((type: FeatureType) => {
    setState((s) => ({ ...s, selectedFeatureType: type }))
  }, [])

  const rotateFeature = React.useCallback((direction: 'cw' | 'ccw') => {
    setState((s) => {
      const rotations: (0 | 90 | 180 | 270)[] = [0, 90, 180, 270]
      const currentIdx = rotations.indexOf(s.featureRotation)
      const delta = direction === 'cw' ? 1 : -1
      const newIdx = (currentIdx + delta + 4) % 4
      return { ...s, featureRotation: rotations[newIdx] }
    })
  }, [])

  const placeFeature = React.useCallback(
    (col: number, row: number) => {
      setState((s) => {
        const newFeature: DungeonFeature = {
          id: generateId(),
          type: s.selectedFeatureType,
          position: { col, row },
          rotation: s.featureRotation,
        }
        return { ...s, features: [...s.features, newFeature] }
      })
      scheduleSave()
    },
    [scheduleSave]
  )

  const selectFeature = React.useCallback((id: string | null) => {
    setState((s) => ({
      ...s,
      selectedFeatureId: id,
      selectedPathId: null,
      selectedLabelId: null,
      // Sync rotation with selected feature
      ...(id && s.features.find((f) => f.id === id)
        ? { featureRotation: s.features.find((f) => f.id === id)!.rotation }
        : {}),
    }))
  }, [])

  const deleteFeature = React.useCallback(
    (id: string) => {
      setState((s) => ({
        ...s,
        features: s.features.filter((f) => f.id !== id),
        selectedFeatureId: s.selectedFeatureId === id ? null : s.selectedFeatureId,
      }))
      scheduleSave()
    },
    [scheduleSave]
  )

  const updateFeaturePosition = React.useCallback(
    (id: string, col: number, row: number) => {
      setState((s) => ({
        ...s,
        features: s.features.map((f) => (f.id === id ? { ...f, position: { col, row } } : f)),
      }))
      scheduleSave()
    },
    [scheduleSave]
  )

  const rotateSelectedFeature = React.useCallback(
    (direction: 'cw' | 'ccw') => {
      setState((s) => {
        if (!s.selectedFeatureId) return s
        const rotations: (0 | 90 | 180 | 270)[] = [0, 90, 180, 270]
        const feature = s.features.find((f) => f.id === s.selectedFeatureId)
        if (!feature) return s
        const currentIdx = rotations.indexOf(feature.rotation)
        const delta = direction === 'cw' ? 1 : -1
        const newIdx = (currentIdx + delta + 4) % 4
        const newRotation = rotations[newIdx]
        return {
          ...s,
          featureRotation: newRotation,
          features: s.features.map((f) =>
            f.id === s.selectedFeatureId ? { ...f, rotation: newRotation } : f
          ),
        }
      })
      scheduleSave()
    },
    [scheduleSave]
  )

  const startDraggingFeature = React.useCallback(() => {
    setState((s) => ({ ...s, draggingFeature: true }))
  }, [])

  const stopDraggingFeature = React.useCallback(() => {
    setState((s) => ({ ...s, draggingFeature: false }))
  }, [])

  // Selection functions
  const clearSelection = React.useCallback(() => {
    setState((s) => ({
      ...s,
      selectedPathId: null,
      selectedLabelId: null,
      selectedFeatureId: null,
    }))
  }, [])

  const deleteSelected = React.useCallback(() => {
    setState((s) => {
      if (s.selectedPathId) {
        return {
          ...s,
          paths: s.paths.filter((p) => p.id !== s.selectedPathId),
          selectedPathId: null,
        }
      }
      if (s.selectedLabelId) {
        return {
          ...s,
          labels: s.labels.filter((l) => l.id !== s.selectedLabelId),
          selectedLabelId: null,
        }
      }
      if (s.selectedFeatureId) {
        return {
          ...s,
          features: s.features.filter((f) => f.id !== s.selectedFeatureId),
          selectedFeatureId: null,
        }
      }
      return s
    })
    scheduleSave()
  }, [scheduleSave])

  return {
    state,
    setTool,
    setSelectedTerrain,
    stampTerrain,
    setHoveredHex,
    handleSpaceDown,
    handleSpaceUp,

    // Path functions
    setSelectedPathType,
    startPath,
    addPathPoint,
    finishPath,
    cancelPath,
    selectPath,
    deletePath,
    updatePathVertex,
    startDraggingVertex,
    stopDraggingVertex,

    // Label functions
    setSelectedLabelSize,
    createLabel,
    startEditingLabel,
    finishEditingLabel,
    cancelEditingLabel,
    selectLabel,
    deleteLabel,
    updateLabelPosition,
    startDraggingLabel,
    stopDraggingLabel,

    // Wall functions
    setWallMode,
    setHoveredCell,
    paintWall,
    eraseWall,

    // Feature functions
    setSelectedFeatureType,
    rotateFeature,
    placeFeature,
    selectFeature,
    deleteFeature,
    updateFeaturePosition,
    rotateSelectedFeature,
    startDraggingFeature,
    stopDraggingFeature,

    // Selection
    clearSelection,
    deleteSelected,
  }
}
