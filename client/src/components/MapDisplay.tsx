import * as React from 'react'
import type { Map, CellCoord, SessionToken } from '@gygax/shared'
import { MapCanvas } from './MapCanvas'
import type { DrawingState, StoredTerrain } from '../hooks/useMapDrawing'
import { preloadTerrainImages } from '../utils/terrainIcons'

interface MapDisplayProps {
  map: Map
  className?: string
  // Session mode (fog of war & tokens)
  fogRevealedCells?: CellCoord[]
  tokens?: SessionToken[]
  selectedTokenId?: string | null
  isDm?: boolean
  sessionTool?: 'fog-brush' | 'fog-rect' | 'token-place' | null
  isSpaceHeld?: boolean
  onTokenClick?: (tokenId: string) => void
  onTokenDrag?: (tokenId: string, position: CellCoord) => void
  onCellClick?: (coord: CellCoord) => void
}

const TERRAIN_COLORS_KEY = 'gygax-show-terrain-colors'

// Convert map.content to a DrawingState for read-only display
function contentToDrawingState(map: Map): DrawingState | undefined {
  if (!map.content) {
    return undefined
  }

  const content = map.content

  // Convert terrain array to Map<string, StoredTerrain>
  const terrainMap = new globalThis.Map<string, StoredTerrain>()
  if (content.terrain) {
    for (const stamp of content.terrain) {
      // TerrainStamp has nested hex object with col/row
      const key = `${stamp.hex.col},${stamp.hex.row}`
      terrainMap.set(key, {
        terrain: stamp.terrain,
        variant: (stamp.variant ?? 0) as 0 | 1 | 2,
      })
    }
  }

  // Convert walls array to Set<string>
  const wallsSet = new Set<string>()
  if (content.walls) {
    for (const wall of content.walls) {
      wallsSet.add(`${wall.col},${wall.row}`)
    }
  }

  return {
    // Core tools - defaults for read-only
    tool: 'pan',
    previousTool: 'pan',
    isSpaceHeld: false,
    saveStatus: 'idle',

    // Terrain
    selectedTerrain: 'grassland',
    terrain: terrainMap,
    hoveredHex: null,

    // Paths
    paths: content.paths ?? [],
    selectedPathType: 'road',
    selectedPathId: null,
    pathInProgress: null,
    draggingVertexIndex: null,

    // Labels
    labels: content.labels ?? [],
    selectedTextSize: 'medium',
    editingLabelId: null,
    selectedLabelId: null,
    draggingLabel: false,

    // Walls (square grid)
    walls: wallsSet,
    wallMode: 'draw',
    hoveredCell: null,

    // Features (square grid)
    features: content.features ?? [],
    selectedFeatureType: 'door',
    selectedFeatureId: null,
    draggingFeature: false,
  }
}

export function MapDisplay({
  map,
  className = '',
  fogRevealedCells,
  tokens,
  selectedTokenId,
  isDm,
  sessionTool,
  isSpaceHeld,
  onTokenClick,
  onTokenDrag,
  onCellClick,
}: MapDisplayProps) {
  const [imagesReady, setImagesReady] = React.useState(false)
  const [showTerrainColors, setShowTerrainColors] = React.useState(() => {
    try {
      return localStorage.getItem(TERRAIN_COLORS_KEY) === 'true'
    } catch {
      return false
    }
  })

  // Preload terrain images
  React.useEffect(() => {
    preloadTerrainImages().then(() => {
      setImagesReady(true)
    })
  }, [])

  const handleToggleColors = () => {
    const next = !showTerrainColors
    setShowTerrainColors(next)
    try {
      localStorage.setItem(TERRAIN_COLORS_KEY, String(next))
    } catch {
      // Ignore localStorage errors
    }
  }

  // Memoize the drawing state conversion
  const drawingState = React.useMemo(() => contentToDrawingState(map), [map])

  // Don't render until images are loaded (for hex maps with terrain)
  if (!imagesReady && map.gridType === 'HEX' && map.content?.terrain?.length) {
    return (
      <div className={`relative flex h-full w-full items-center justify-center ${className}`}>
        <span className="font-body text-ink-soft">Loading map...</span>
      </div>
    )
  }

  const isHexMap = map.gridType === 'HEX'

  return (
    <div className={`relative h-full w-full ${className}`}>
      {/* Map name header - padding matches header (px-3 mobile, px-4 desktop) */}
      <div className="absolute left-3 top-3 z-10 max-w-[70%] truncate border-2 border-ink bg-parchment-100 px-2 py-1 shadow-brutal md:left-4 md:top-4 md:max-w-none md:px-3">
        <span className="font-display text-xs uppercase tracking-wide text-ink md:text-sm">{map.name}</span>
      </div>

      {/* Color tint toggle (hex maps only) */}
      {isHexMap && (
        <div className="absolute right-3 top-3 z-10 flex items-center gap-2 border-2 border-ink bg-parchment-100 px-2 py-1 shadow-brutal md:right-4 md:top-4 md:px-3 md:py-1.5">
          <span className="hidden font-body text-xs text-ink md:inline">Color Tint</span>
          <button
            type="button"
            role="switch"
            aria-checked={showTerrainColors}
            aria-label="Toggle color tint"
            onClick={handleToggleColors}
            className={`relative h-5 w-10 border-2 border-ink transition-colors ${
              showTerrainColors ? 'bg-ink' : 'bg-parchment-200'
            }`}
          >
            <span
              className={`absolute left-0.5 top-0.5 h-3 w-3 border border-ink transition-all ${
                showTerrainColors ? 'left-[22px] bg-parchment-100' : 'left-0.5 bg-ink-soft'
              }`}
            />
          </button>
        </div>
      )}

      {/* Read-only MapCanvas with converted drawing state */}
      <MapCanvas
        map={map}
        drawingState={drawingState}
        showTerrainColors={showTerrainColors}
        showBorder={false}
        className="h-full w-full"
        fogRevealedCells={fogRevealedCells}
        tokens={tokens}
        selectedTokenId={selectedTokenId}
        isDm={isDm}
        sessionTool={sessionTool}
        isSpaceHeld={isSpaceHeld}
        onTokenClick={onTokenClick}
        onTokenDrag={onTokenDrag}
        onCellClick={onCellClick}
      />
    </div>
  )
}
