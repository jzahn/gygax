import * as React from 'react'
import type { Map, HexCoord, TerrainType, MapPoint, CellCoord, SessionToken } from '@gygax/shared'
import type { DrawingState, DrawingTool, StoredTerrain } from '../hooks/useMapDrawing'
import { hexToPixel, pixelToHex, isHexInBounds, findNearestSnapPoint } from '../utils/hexUtils'
import { renderTerrainIcon, drawTerrainTint } from '../utils/terrainIcons'
import {
  renderPath,
  renderPathHandles,
  renderPathPreview,
  renderSnapIndicator,
  hitTestPath,
  hitTestPathVertex,
  getPathBounds,
} from '../utils/pathUtils'
import { renderLabel, hitTestLabel, getLabelFontSize } from '../utils/labelUtils'
import {
  renderWalls,
  renderFeature,
  renderFeaturePreview,
  hitTestFeature,
  featureFitsInBounds,
  getWallAtPosition,
  wallKey,
} from '../utils/featureUtils'
import { LabelEditor } from './LabelEditor'

// Spline cache to avoid recalculating curves on every render
const splineCache = new Map<string, { points: string; spline: MapPoint[] }>()

interface MapCanvasProps {
  map: Map
  className?: string
  drawingState?: DrawingState
  onHexClick?: (hex: HexCoord) => void
  onHexHover?: (hex: HexCoord | null) => void
  // Path callbacks
  onStartPath?: (point: MapPoint) => void
  onAddPathPoint?: (point: MapPoint) => void
  onFinishPath?: () => void
  onSelectPath?: (id: string | null) => void
  onDeletePath?: (id: string) => void
  onUpdatePathVertex?: (pathId: string, vertexIndex: number, point: MapPoint) => void
  onStartDraggingVertex?: (vertexIndex: number) => void
  onStopDraggingVertex?: () => void
  // Label callbacks
  onCreateLabel?: (position: MapPoint, text: string) => void
  onStartEditingLabel?: (id: string) => void
  onFinishEditingLabel?: (text: string) => void
  onCancelEditingLabel?: () => void
  onSelectLabel?: (id: string | null) => void
  onDeleteLabel?: (id: string) => void
  onUpdateLabelPosition?: (id: string, position: MapPoint) => void
  onStartDraggingLabel?: () => void
  onStopDraggingLabel?: () => void
  // Wall callbacks (square grid)
  onPaintWall?: (col: number, row: number) => void
  onEraseWall?: (col: number, row: number) => void
  onHoveredCellChange?: (cell: { col: number; row: number } | null) => void
  // Feature callbacks (square grid)
  onPlaceFeature?: (col: number, row: number) => void
  onSelectFeature?: (id: string | null) => void
  onDeleteFeature?: (id: string) => void
  onUpdateFeaturePosition?: (id: string, col: number, row: number) => void
  onStartDraggingFeature?: () => void
  onStopDraggingFeature?: () => void
  // Selection
  onClearSelection?: () => void
  // Display options
  showTerrainColors?: boolean
  showBorder?: boolean
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

interface ViewportState {
  offsetX: number
  offsetY: number
  zoom: number
}

const MIN_ZOOM = 0.5
const MAX_ZOOM = 5
const ZOOM_STEP_SMALL = 0.1
const ZOOM_STEP_LARGE = 0.25
const SNAP_THRESHOLD = 15 // Pixels at 100% zoom
const PATH_HIT_DISTANCE = 8
const VERTEX_HIT_DISTANCE = 10

// Draw square grid
function drawSquareGrid(ctx: CanvasRenderingContext2D, map: Map) {
  const { width, height, cellSize } = map

  ctx.beginPath()

  for (let x = 0; x <= width; x++) {
    ctx.moveTo(x * cellSize, 0)
    ctx.lineTo(x * cellSize, height * cellSize)
  }

  for (let y = 0; y <= height; y++) {
    ctx.moveTo(0, y * cellSize)
    ctx.lineTo(width * cellSize, y * cellSize)
  }

  ctx.stroke()
}

// Get hex corner point
function hexCorner(cx: number, cy: number, size: number, i: number) {
  const angleDeg = 60 * i
  const angleRad = (Math.PI / 180) * angleDeg
  return {
    x: cx + size * Math.cos(angleRad),
    y: cy + size * Math.sin(angleRad),
  }
}

// Fill all hexes with white (called before drawing grid lines)
function fillHexes(ctx: CanvasRenderingContext2D, map: Map) {
  const { width, height, cellSize } = map

  const size = cellSize / 2
  const hexHeight = Math.sqrt(3) * size
  const horizSpacing = size * 1.5
  const vertSpacing = hexHeight

  ctx.fillStyle = '#FFFFFF'

  for (let col = 0; col < width; col++) {
    for (let row = 0; row < height; row++) {
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
      ctx.fill()
    }
  }
}

// Draw hex grid (flat-top orientation, odd-q offset)
function drawHexGrid(ctx: CanvasRenderingContext2D, map: Map) {
  const { width, height, cellSize } = map

  const size = cellSize / 2
  const hexHeight = Math.sqrt(3) * size
  const horizSpacing = size * 1.5
  const vertSpacing = hexHeight

  ctx.beginPath()

  for (let col = 0; col < width; col++) {
    for (let row = 0; row < height; row++) {
      const cx = size + col * horizSpacing
      const cy = hexHeight / 2 + row * vertSpacing + (col % 2 === 1 ? vertSpacing / 2 : 0)

      const start = hexCorner(cx, cy, size, 0)
      ctx.moveTo(start.x, start.y)
      for (let i = 1; i <= 6; i++) {
        const corner = hexCorner(cx, cy, size, i % 6)
        ctx.lineTo(corner.x, corner.y)
      }
    }
  }

  ctx.stroke()
}

// Draw terrain icons for hex grids (with viewport culling)
function drawTerrainCulled(
  ctx: CanvasRenderingContext2D,
  terrain: globalThis.Map<string, StoredTerrain>,
  cellSize: number,
  visibleBounds: { minX: number; minY: number; maxX: number; maxY: number },
  showColors: boolean = false
) {
  const padding = cellSize / 2

  // First pass: draw color tints if enabled
  if (showColors) {
    terrain.forEach((stored, key) => {
      const [col, row] = key.split(',').map(Number)
      const { x, y } = hexToPixel({ col, row }, cellSize)
      if (
        x + padding >= visibleBounds.minX &&
        x - padding <= visibleBounds.maxX &&
        y + padding >= visibleBounds.minY &&
        y - padding <= visibleBounds.maxY
      ) {
        drawTerrainTint(ctx, x, y, stored.terrain, cellSize)
      }
    })
  }

  // Second pass: draw terrain icons
  terrain.forEach((stored, key) => {
    const [col, row] = key.split(',').map(Number)
    const { x, y } = hexToPixel({ col, row }, cellSize)
    // Cull terrain icons outside visible bounds
    if (
      x + padding >= visibleBounds.minX &&
      x - padding <= visibleBounds.maxX &&
      y + padding >= visibleBounds.minY &&
      y - padding <= visibleBounds.maxY
    ) {
      renderTerrainIcon(ctx, x, y, stored.terrain, cellSize, stored.variant, showColors)
    }
  })
}

// Draw hover preview for terrain tool
function drawHoverPreview(
  ctx: CanvasRenderingContext2D,
  hex: HexCoord,
  tool: DrawingTool,
  selectedTerrain: TerrainType,
  cellSize: number
) {
  const { x, y } = hexToPixel(hex, cellSize)

  ctx.save()
  ctx.globalAlpha = 0.5

  if (tool === 'terrain' && selectedTerrain !== 'clear') {
    renderTerrainIcon(ctx, x, y, selectedTerrain, cellSize)
  } else if (tool === 'erase') {
    // Draw an X for eraser preview
    const size = cellSize * 0.3
    ctx.strokeStyle = '#d32f2f'
    ctx.lineWidth = 3
    ctx.beginPath()
    ctx.moveTo(x - size, y - size)
    ctx.lineTo(x + size, y + size)
    ctx.moveTo(x + size, y - size)
    ctx.lineTo(x - size, y + size)
    ctx.stroke()
  }

  ctx.restore()
}

function getCursorForTool(
  tool: DrawingTool,
  isPanning: boolean,
  isOverPath: boolean,
  isOverLabel: boolean,
  isOverVertex: boolean,
  isOverFeature: boolean = false,
  sessionTool?: 'fog-brush' | 'fog-rect' | 'token-place' | null,
  isSpaceHeld?: boolean
): string {
  if (isPanning) return 'grabbing'
  // Space held = ready to pan
  if (isSpaceHeld) return 'grab'
  // Session tools take priority
  if (sessionTool === 'fog-brush' || sessionTool === 'fog-rect' || sessionTool === 'token-place') {
    return 'crosshair'
  }
  if (isOverVertex) return 'move'
  if (isOverPath || isOverLabel || isOverFeature) return 'pointer'
  switch (tool) {
    case 'pan':
      return 'grab'
    case 'terrain':
    case 'erase':
    case 'path':
    case 'label':
    case 'wall':
    case 'feature':
      return 'crosshair'
    default:
      return 'default'
  }
}

// Calculate visible bounds in map coordinates
function getVisibleBounds(
  viewport: ViewportState,
  containerWidth: number,
  containerHeight: number
): { minX: number; minY: number; maxX: number; maxY: number } {
  const minX = -viewport.offsetX / viewport.zoom
  const minY = -viewport.offsetY / viewport.zoom
  const maxX = (containerWidth - viewport.offsetX) / viewport.zoom
  const maxY = (containerHeight - viewport.offsetY) / viewport.zoom
  return { minX, minY, maxX, maxY }
}

// Check if a bounding box intersects the visible bounds
function isInViewport(
  bounds: { minX: number; minY: number; maxX: number; maxY: number },
  visible: { minX: number; minY: number; maxX: number; maxY: number }
): boolean {
  return bounds.maxX >= visible.minX &&
    bounds.minX <= visible.maxX &&
    bounds.maxY >= visible.minY &&
    bounds.minY <= visible.maxY
}

export function MapCanvas({
  map,
  className = '',
  drawingState,
  onHexClick,
  onHexHover,
  onStartPath,
  onAddPathPoint,
  onFinishPath,
  onSelectPath,
  onDeletePath,
  onUpdatePathVertex,
  onStartDraggingVertex,
  onStopDraggingVertex,
  onCreateLabel,
  onStartEditingLabel,
  onFinishEditingLabel,
  onCancelEditingLabel,
  onSelectLabel,
  onDeleteLabel,
  onUpdateLabelPosition,
  onStartDraggingLabel,
  onStopDraggingLabel,
  onPaintWall,
  onEraseWall,
  onHoveredCellChange,
  onPlaceFeature,
  onSelectFeature,
  onDeleteFeature,
  onUpdateFeaturePosition,
  onStartDraggingFeature,
  onStopDraggingFeature,
  onClearSelection,
  showTerrainColors = false,
  showBorder = true,
  // Session mode props
  fogRevealedCells,
  tokens,
  selectedTokenId,
  isDm = false,
  sessionTool,
  isSpaceHeld = false,
  onTokenClick,
  onTokenDrag,
  onCellClick,
}: MapCanvasProps) {
  // Note: onTokenClick and onTokenDrag are for future token interaction
  void onTokenClick
  void onTokenDrag
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 })
  const [zoomDisplay, setZoomDisplay] = React.useState(100)

  const viewportRef = React.useRef<ViewportState>({
    offsetX: 0,
    offsetY: 0,
    zoom: 1,
  })
  const isPanningRef = React.useRef(false)
  const panStartRef = React.useRef({ x: 0, y: 0 })
  const rafIdRef = React.useRef<number | null>(null)
  const hasInitializedRef = React.useRef(false)

  // Track cursor position for snap indicator
  const [cursorMapPos, setCursorMapPos] = React.useState<MapPoint | null>(null)
  const [snapPoint, setSnapPoint] = React.useState<MapPoint | null>(null)
  const [isOverPath, setIsOverPath] = React.useState(false)
  const [isOverLabel, setIsOverLabel] = React.useState(false)
  const [isOverVertex, setIsOverVertex] = React.useState(false)
  const [isOverFeature, setIsOverFeature] = React.useState(false)
  const [newLabelPosition, setNewLabelPosition] = React.useState<MapPoint | null>(null)
  const [hoveredCell, setHoveredCell] = React.useState<{ col: number; row: number } | null>(null)

  const tool = drawingState?.tool ?? 'pan'
  const isHexGrid = map.gridType === 'HEX'
  const isSquareGrid = map.gridType === 'SQUARE'

  const getMapDimensions = React.useCallback(() => {
    if (map.gridType === 'SQUARE') {
      return {
        width: map.width * map.cellSize,
        height: map.height * map.cellSize,
      }
    } else {
      const size = map.cellSize / 2
      const hexHeight = Math.sqrt(3) * size
      const horizSpacing = size * 1.5
      const totalWidth = size * 2 + (map.width - 1) * horizSpacing
      const hasOddLastCol = (map.width - 1) % 2 === 1
      const totalHeight = map.height * hexHeight + (hasOddLastCol ? hexHeight / 2 : 0)
      return {
        width: totalWidth,
        height: totalHeight,
      }
    }
  }, [map])

  const render = React.useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const viewport = viewportRef.current
    const dpr = window.devicePixelRatio || 1
    const displayWidth = containerSize.width
    const displayHeight = containerSize.height

    if (displayWidth === 0 || displayHeight === 0) return

    if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
      canvas.width = displayWidth * dpr
      canvas.height = displayHeight * dpr
      canvas.style.width = `${displayWidth}px`
      canvas.style.height = `${displayHeight}px`
    }

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)

    // Black background outside map bounds (both grid types)
    ctx.fillStyle = '#1a1a1a'
    ctx.fillRect(0, 0, displayWidth, displayHeight)

    ctx.save()
    ctx.translate(viewport.offsetX, viewport.offsetY)
    ctx.scale(viewport.zoom, viewport.zoom)

    // Calculate visible bounds for culling
    const visibleBounds = getVisibleBounds(viewport, displayWidth, displayHeight)

    // 1. Fill map area with white
    if (isHexGrid) {
      // Hex maps: fill each hex with white
      fillHexes(ctx, map)
    } else {
      // Square maps: fill entire map rectangle with white
      ctx.fillStyle = '#FFFFFF'
      ctx.fillRect(0, 0, map.width * map.cellSize, map.height * map.cellSize)
    }

    // 2. Draw walls (square grid only, before grid lines so lines show on top)
    if (isSquareGrid && drawingState?.walls && drawingState.walls.size > 0) {
      renderWalls(ctx, drawingState.walls, map.cellSize)
    }

    // 3. Draw grid lines
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 1 / viewport.zoom

    if (map.gridType === 'SQUARE') {
      drawSquareGrid(ctx, map)
    } else {
      drawHexGrid(ctx, map)
    }

    // 4. Draw terrain icons (hex only, with viewport culling)
    if (isHexGrid && drawingState?.terrain) {
      drawTerrainCulled(ctx, drawingState.terrain, map.cellSize, visibleBounds, showTerrainColors)
    }

    // 5. Draw paths (hex only, with viewport culling)
    // Render order: rivers/streams first, then roads/borders/trails on top
    if (isHexGrid && drawingState?.paths) {
      const waterPaths = drawingState.paths.filter(p => p.type === 'river' || p.type === 'stream')
      const otherPaths = drawingState.paths.filter(p => p.type !== 'river' && p.type !== 'stream')

      for (const path of [...waterPaths, ...otherPaths]) {
        const bounds = getPathBounds(path)
        // Add padding for line width
        const padding = 10
        if (isInViewport(
          { minX: bounds.minX - padding, minY: bounds.minY - padding, maxX: bounds.maxX + padding, maxY: bounds.maxY + padding },
          visibleBounds
        )) {
          renderPath(ctx, path, viewport.zoom, splineCache, showTerrainColors)
        }
      }
    }

    // 6. Draw features (square grid only)
    if (isSquareGrid && drawingState?.features) {
      for (const feature of drawingState.features) {
        renderFeature(ctx, feature, map.cellSize, feature.id === drawingState.selectedFeatureId)
      }
    }

    // 6.5. Draw fog of war (session mode)
    if (fogRevealedCells !== undefined) {
      const revealedSet = new Set<string>()
      for (const cell of fogRevealedCells) {
        if (cell.col !== undefined && cell.row !== undefined) {
          revealedSet.add(`sq:${cell.col},${cell.row}`)
        }
        if (cell.q !== undefined && cell.r !== undefined) {
          revealedSet.add(`hex:${cell.q},${cell.r}`)
        }
      }

      // For players: solid opaque fog
      // For DM: semi-transparent with diagonal stripes pattern
      const PLAYER_FOG_COLOR = '#D6CFBE'
      const DM_FOG_COLOR = 'rgba(100, 80, 60, 0.35)'

      // Helper to draw diagonal stripes pattern for DM
      const drawDmFogPattern = (x: number, y: number, width: number, height: number) => {
        ctx.save()
        ctx.beginPath()
        ctx.rect(x, y, width, height)
        ctx.clip()

        // Fill with semi-transparent overlay
        ctx.fillStyle = DM_FOG_COLOR
        ctx.fillRect(x, y, width, height)

        // Draw diagonal stripes
        ctx.strokeStyle = 'rgba(60, 40, 20, 0.3)'
        ctx.lineWidth = 2 / viewport.zoom
        const stripeSpacing = 12
        const diagonal = Math.sqrt(width * width + height * height)

        for (let i = -diagonal; i < diagonal * 2; i += stripeSpacing) {
          ctx.beginPath()
          ctx.moveTo(x + i, y)
          ctx.lineTo(x + i - height, y + height)
          ctx.stroke()
        }
        ctx.restore()
      }

      if (isHexGrid) {
        // Hex grid fog
        for (let col = 0; col < map.width; col++) {
          for (let row = 0; row < map.height; row++) {
            const isRevealed = revealedSet.has(`hex:${col},${row}`)
            if (!isRevealed) {
              // Draw hex fog
              const size = map.cellSize / 2
              const hexHeight = Math.sqrt(3) * size
              const horizSpacing = size * 1.5
              const vertSpacing = hexHeight
              const cx = size + col * horizSpacing
              const cy = hexHeight / 2 + row * vertSpacing + (col % 2 === 1 ? vertSpacing / 2 : 0)

              ctx.beginPath()
              const startCorner = hexCorner(cx, cy, size, 0)
              ctx.moveTo(startCorner.x, startCorner.y)
              for (let i = 1; i <= 6; i++) {
                const corner = hexCorner(cx, cy, size, i % 6)
                ctx.lineTo(corner.x, corner.y)
              }
              ctx.closePath()

              if (isDm) {
                // DM sees semi-transparent with pattern
                ctx.save()
                ctx.clip()
                ctx.fillStyle = DM_FOG_COLOR
                ctx.fill()
                // Draw stripes within hex
                ctx.strokeStyle = 'rgba(60, 40, 20, 0.3)'
                ctx.lineWidth = 2 / viewport.zoom
                const stripeSpacing = 12
                for (let i = -size * 2; i < size * 4; i += stripeSpacing) {
                  ctx.beginPath()
                  ctx.moveTo(cx - size + i, cy - size)
                  ctx.lineTo(cx - size + i - size * 2, cy + size)
                  ctx.stroke()
                }
                ctx.restore()
              } else {
                ctx.fillStyle = PLAYER_FOG_COLOR
                ctx.fill()
              }
            }
          }
        }
      } else {
        // Square grid fog
        for (let col = 0; col < map.width; col++) {
          for (let row = 0; row < map.height; row++) {
            const isRevealed = revealedSet.has(`sq:${col},${row}`)
            if (!isRevealed) {
              const x = col * map.cellSize
              const y = row * map.cellSize
              if (isDm) {
                drawDmFogPattern(x, y, map.cellSize, map.cellSize)
              } else {
                ctx.fillStyle = PLAYER_FOG_COLOR
                ctx.fillRect(x, y, map.cellSize, map.cellSize)
              }
            }
          }
        }
      }

      // Draw fog edge border for revealed areas (helps DM see boundaries)
      if (isDm) {
        ctx.strokeStyle = '#8B4513' // Saddle brown for visibility
        ctx.lineWidth = 3 / viewport.zoom

        if (isHexGrid) {
          // For hex grids, draw border around revealed hexes
          for (let col = 0; col < map.width; col++) {
            for (let row = 0; row < map.height; row++) {
              const isRevealed = revealedSet.has(`hex:${col},${row}`)
              if (!isRevealed) continue

              const size = map.cellSize / 2
              const hexHeight = Math.sqrt(3) * size
              const horizSpacing = size * 1.5
              const vertSpacing = hexHeight
              const cx = size + col * horizSpacing
              const cy = hexHeight / 2 + row * vertSpacing + (col % 2 === 1 ? vertSpacing / 2 : 0)

              // Hex neighbor directions (flat-top, column-offset grid)
              const neighbors = [
                { dc: 1, dr: col % 2 === 0 ? -1 : 0 },
                { dc: 1, dr: col % 2 === 0 ? 0 : 1 },
                { dc: 0, dr: 1 },
                { dc: -1, dr: col % 2 === 0 ? 0 : 1 },
                { dc: -1, dr: col % 2 === 0 ? -1 : 0 },
                { dc: 0, dr: -1 },
              ]

              // Draw only the specific edges where the neighbor is unrevealed
              // Neighbor index i corresponds to edge from corner (i+5)%6 to corner i
              for (let i = 0; i < neighbors.length; i++) {
                const n = neighbors[i]
                const nc = col + n.dc
                const nr = row + n.dr
                if (nc < 0 || nc >= map.width || nr < 0 || nr >= map.height || !revealedSet.has(`hex:${nc},${nr}`)) {
                  // This neighbor is unrevealed, draw the edge facing it
                  const startCornerIdx = (i + 5) % 6
                  const endCornerIdx = i % 6
                  const startCorner = hexCorner(cx, cy, size, startCornerIdx)
                  const endCorner = hexCorner(cx, cy, size, endCornerIdx)
                  ctx.beginPath()
                  ctx.moveTo(startCorner.x, startCorner.y)
                  ctx.lineTo(endCorner.x, endCorner.y)
                  ctx.stroke()
                }
              }
            }
          }
        } else {
          // Square grid edge borders
          for (let col = 0; col < map.width; col++) {
            for (let row = 0; row < map.height; row++) {
              const isRevealed = revealedSet.has(`sq:${col},${row}`)
              if (!isRevealed) continue

              const x = col * map.cellSize
              const y = row * map.cellSize
              const size = map.cellSize

              // Draw edges where revealed meets unrevealed
              if (row === 0 || !revealedSet.has(`sq:${col},${row - 1}`)) {
                ctx.beginPath()
                ctx.moveTo(x, y)
                ctx.lineTo(x + size, y)
                ctx.stroke()
              }
              if (row === map.height - 1 || !revealedSet.has(`sq:${col},${row + 1}`)) {
                ctx.beginPath()
                ctx.moveTo(x, y + size)
                ctx.lineTo(x + size, y + size)
                ctx.stroke()
              }
              if (col === 0 || !revealedSet.has(`sq:${col - 1},${row}`)) {
                ctx.beginPath()
                ctx.moveTo(x, y)
                ctx.lineTo(x, y + size)
                ctx.stroke()
              }
              if (col === map.width - 1 || !revealedSet.has(`sq:${col + 1},${row}`)) {
                ctx.beginPath()
                ctx.moveTo(x + size, y)
                ctx.lineTo(x + size, y + size)
                ctx.stroke()
              }
            }
          }
        }
      }
    }

    // 6.6. Draw tokens (session mode)
    if (tokens && tokens.length > 0) {
      const revealedSet = new Set<string>()
      if (fogRevealedCells) {
        for (const cell of fogRevealedCells) {
          if (cell.col !== undefined && cell.row !== undefined) {
            revealedSet.add(`sq:${cell.col},${cell.row}`)
          }
          if (cell.q !== undefined && cell.r !== undefined) {
            revealedSet.add(`hex:${cell.q},${cell.r}`)
          }
        }
      }

      const tokenSize = map.cellSize * 0.8
      const TOKEN_COLORS: Record<string, string> = {
        PC: '#22c55e',
        NPC: '#3b82f6',
        MONSTER: '#ef4444',
      }

      for (const token of tokens) {
        // Check visibility
        const pos = token.position
        let isVisible = true
        if (!isDm && fogRevealedCells !== undefined) {
          if (pos.col !== undefined && pos.row !== undefined) {
            isVisible = revealedSet.has(`sq:${pos.col},${pos.row}`)
          } else if (pos.q !== undefined && pos.r !== undefined) {
            isVisible = revealedSet.has(`hex:${pos.q},${pos.r}`)
          }
        }
        if (!isVisible) continue

        // Calculate token center position
        let cx: number, cy: number
        if (isHexGrid) {
          const q = pos.q ?? 0
          const r = pos.r ?? 0
          const size = map.cellSize / 2
          const hexHeight = Math.sqrt(3) * size
          const horizSpacing = size * 1.5
          const vertSpacing = hexHeight
          cx = size + q * horizSpacing
          cy = hexHeight / 2 + r * vertSpacing + (q % 2 === 1 ? vertSpacing / 2 : 0)
        } else {
          const col = pos.col ?? 0
          const row = pos.row ?? 0
          cx = col * map.cellSize + map.cellSize / 2
          cy = row * map.cellSize + map.cellSize / 2
        }

        // Draw token background
        const borderColor = token.color || TOKEN_COLORS[token.type] || '#666666'
        const isSelected = selectedTokenId === token.id

        ctx.save()

        // Token shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'
        ctx.fillRect(
          cx - tokenSize / 2 + 2,
          cy - tokenSize / 2 + 2,
          tokenSize,
          tokenSize
        )

        // Token background
        ctx.fillStyle = '#F5F0E6' // parchment-100
        ctx.fillRect(
          cx - tokenSize / 2,
          cy - tokenSize / 2,
          tokenSize,
          tokenSize
        )

        // Token border
        ctx.strokeStyle = borderColor
        ctx.lineWidth = 3 / viewport.zoom
        ctx.strokeRect(
          cx - tokenSize / 2,
          cy - tokenSize / 2,
          tokenSize,
          tokenSize
        )

        // Selection ring
        if (isSelected) {
          ctx.strokeStyle = '#1a1a1a'
          ctx.lineWidth = 2 / viewport.zoom
          ctx.setLineDash([4 / viewport.zoom, 2 / viewport.zoom])
          ctx.strokeRect(
            cx - tokenSize / 2 - 4,
            cy - tokenSize / 2 - 4,
            tokenSize + 8,
            tokenSize + 8
          )
          ctx.setLineDash([])
        }

        // Token abbreviation
        const abbrev = token.name.substring(0, 2).toUpperCase()
        ctx.fillStyle = '#1a1a1a'
        ctx.font = `bold ${tokenSize * 0.35}px "Rosarivo", serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText(abbrev, cx, cy)

        ctx.restore()
      }
    }

    // 7. Draw labels (with viewport culling and fog visibility)
    if (drawingState?.labels) {
      // Build revealed set for fog check
      const labelRevealedSet = new Set<string>()
      if (fogRevealedCells) {
        for (const cell of fogRevealedCells) {
          if (cell.col !== undefined && cell.row !== undefined) {
            labelRevealedSet.add(`sq:${cell.col},${cell.row}`)
          }
          if (cell.q !== undefined && cell.r !== undefined) {
            labelRevealedSet.add(`hex:${cell.q},${cell.r}`)
          }
        }
      }

      for (const label of drawingState.labels) {
        // Don't render label being edited (it will be shown as input)
        if (label.id !== drawingState.labelEditingId) {
          // Check fog visibility (DMs always see labels)
          let labelVisible = true
          if (!isDm && fogRevealedCells !== undefined) {
            if (isHexGrid) {
              const hex = pixelToHex(label.position.x, label.position.y, map.cellSize)
              // pixelToHex returns {col, row} but fog uses {q, r} - same values, different names
              labelVisible = labelRevealedSet.has(`hex:${hex.col},${hex.row}`)
            } else if (isSquareGrid) {
              const col = Math.floor(label.position.x / map.cellSize)
              const row = Math.floor(label.position.y / map.cellSize)
              labelVisible = labelRevealedSet.has(`sq:${col},${row}`)
            }
          }
          if (!labelVisible) continue

          // Estimate label bounds for culling
          const fontSize = getLabelFontSize(label.size)
          const padding = fontSize * 2 // Generous padding for text width
          const labelBounds = {
            minX: label.position.x - padding,
            minY: label.position.y - padding,
            maxX: label.position.x + padding,
            maxY: label.position.y + padding,
          }
          if (isInViewport(labelBounds, visibleBounds)) {
            renderLabel(ctx, label, viewport.zoom, label.id === drawingState.selectedLabelId)
          }
        }
      }
    }

    // 8. Draw path preview (while drawing, hex only)
    if (isHexGrid && drawingState?.pathInProgress && tool === 'path') {
      renderPathPreview(
        ctx,
        drawingState.pathInProgress,
        drawingState.selectedPathType,
        viewport.zoom,
        cursorMapPos ?? undefined
      )
    }

    // 9. Draw snap indicator (hex only)
    if (isHexGrid && tool === 'path' && snapPoint) {
      renderSnapIndicator(ctx, snapPoint, viewport.zoom)
    }

    // 10. Draw hover preview for terrain/erase (hex only, but not when over a path/label in erase mode)
    const showErasePreview = tool === 'erase' && !isOverPath && !isOverLabel
    if (isHexGrid && drawingState?.hoveredHex && (tool === 'terrain' || showErasePreview)) {
      drawHoverPreview(ctx, drawingState.hoveredHex, tool, drawingState.selectedTerrain, map.cellSize)
    }

    // 11. Draw feature preview (square grid only, when feature tool active)
    if (isSquareGrid && tool === 'feature' && hoveredCell && drawingState) {
      const isValid = featureFitsInBounds(
        hoveredCell.col,
        hoveredCell.row,
        drawingState.selectedFeatureType,
        drawingState.featureRotation,
        map.width,
        map.height
      )
      renderFeaturePreview(
        ctx,
        drawingState.selectedFeatureType,
        hoveredCell.col,
        hoveredCell.row,
        drawingState.featureRotation,
        map.cellSize,
        isValid
      )
    }

    // 12. Draw wall preview for square grids (when wall tool active)
    if (isSquareGrid && tool === 'wall' && hoveredCell && drawingState) {
      const key = wallKey(hoveredCell.col, hoveredCell.row)
      const isWall = drawingState.walls.has(key)
      ctx.save()
      ctx.globalAlpha = 0.5
      if (drawingState.wallMode === 'add' && !isWall) {
        // Show preview of wall being added
        ctx.fillStyle = '#1a1a1a'
        ctx.fillRect(
          hoveredCell.col * map.cellSize,
          hoveredCell.row * map.cellSize,
          map.cellSize,
          map.cellSize
        )
      } else if (drawingState.wallMode === 'remove' && isWall) {
        // Show preview of wall being removed (red X)
        const x = hoveredCell.col * map.cellSize + map.cellSize / 2
        const y = hoveredCell.row * map.cellSize + map.cellSize / 2
        const size = map.cellSize * 0.3
        ctx.strokeStyle = '#d32f2f'
        ctx.lineWidth = 3
        ctx.beginPath()
        ctx.moveTo(x - size, y - size)
        ctx.lineTo(x + size, y + size)
        ctx.moveTo(x + size, y - size)
        ctx.lineTo(x - size, y + size)
        ctx.stroke()
      }
      ctx.restore()
    }

    // 13. Draw selected path handles (hex only)
    if (isHexGrid && drawingState?.selectedPathId) {
      const selectedPath = drawingState.paths.find((p) => p.id === drawingState.selectedPathId)
      if (selectedPath) {
        renderPathHandles(ctx, selectedPath, viewport.zoom)
      }
    }

    ctx.restore()
  }, [map, containerSize, drawingState, tool, isHexGrid, isSquareGrid, cursorMapPos, snapPoint, isOverPath, isOverLabel, hoveredCell, showTerrainColors, fogRevealedCells, tokens, selectedTokenId, isDm])

  const scheduleRender = React.useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
    }
    rafIdRef.current = requestAnimationFrame(() => {
      render()
      rafIdRef.current = null
    })
  }, [render])

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

  // Center map only on initial load
  React.useEffect(() => {
    if (containerSize.width > 0 && containerSize.height > 0 && !hasInitializedRef.current) {
      hasInitializedRef.current = true
      const dims = getMapDimensions()
      const viewport = viewportRef.current
      viewport.offsetX = (containerSize.width - dims.width * viewport.zoom) / 2
      viewport.offsetY = (containerSize.height - dims.height * viewport.zoom) / 2
      scheduleRender()
    }
  }, [containerSize.width, containerSize.height, getMapDimensions, scheduleRender])

  React.useEffect(() => {
    scheduleRender()
  }, [
    map,
    scheduleRender,
    drawingState?.terrain,
    drawingState?.hoveredHex,
    drawingState?.paths,
    drawingState?.labels,
    drawingState?.pathInProgress,
    drawingState?.selectedPathId,
    drawingState?.selectedLabelId,
    drawingState?.labelEditingId,
    drawingState?.walls,
    drawingState?.features,
    drawingState?.selectedFeatureId,
    drawingState?.wallMode,
    drawingState?.featureRotation,
    cursorMapPos,
    snapPoint,
    hoveredCell,
    showTerrainColors,
    fogRevealedCells,
    tokens,
    selectedTokenId,
    isDm,
  ])

  React.useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
    }
  }, [])

  const getZoomStep = React.useCallback((currentZoom: number, zoomingIn: boolean) => {
    const zoomPercent = Math.round(currentZoom * 100)
    if (zoomingIn) {
      return zoomPercent >= 100 ? ZOOM_STEP_LARGE : ZOOM_STEP_SMALL
    } else {
      return zoomPercent > 100 ? ZOOM_STEP_LARGE : ZOOM_STEP_SMALL
    }
  }, [])

  const zoomToward = React.useCallback(
    (centerX: number, centerY: number, zoomingIn: boolean) => {
      const viewport = viewportRef.current
      const step = getZoomStep(viewport.zoom, zoomingIn)
      const delta = zoomingIn ? step : -step
      const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, viewport.zoom + delta))

      if (newZoom === viewport.zoom) return

      const zoomRatio = newZoom / viewport.zoom
      viewport.offsetX = centerX - (centerX - viewport.offsetX) * zoomRatio
      viewport.offsetY = centerY - (centerY - viewport.offsetY) * zoomRatio
      viewport.zoom = newZoom

      setZoomDisplay(Math.round(newZoom * 100))
      scheduleRender()
    },
    [scheduleRender, getZoomStep]
  )

  const handleWheel = React.useCallback(
    (e: React.WheelEvent) => {
      e.preventDefault()

      const rect = canvasRef.current?.getBoundingClientRect()
      if (!rect) return

      const mouseX = e.clientX - rect.left
      const mouseY = e.clientY - rect.top
      const zoomingIn = e.deltaY < 0

      zoomToward(mouseX, mouseY, zoomingIn)
    },
    [zoomToward]
  )

  const handleZoomIn = React.useCallback(() => {
    const centerX = containerSize.width / 2
    const centerY = containerSize.height / 2
    zoomToward(centerX, centerY, true)
  }, [containerSize, zoomToward])

  const handleZoomOut = React.useCallback(() => {
    const centerX = containerSize.width / 2
    const centerY = containerSize.height / 2
    zoomToward(centerX, centerY, false)
  }, [containerSize, zoomToward])

  const handleZoomReset = React.useCallback(() => {
    const viewport = viewportRef.current
    const centerX = containerSize.width / 2
    const centerY = containerSize.height / 2

    // Get the map point currently at center
    const mapCenterX = (centerX - viewport.offsetX) / viewport.zoom
    const mapCenterY = (centerY - viewport.offsetY) / viewport.zoom

    // Set zoom to 1 (100%)
    viewport.zoom = 1

    // Adjust offset to keep the same map point at center
    viewport.offsetX = centerX - mapCenterX * viewport.zoom
    viewport.offsetY = centerY - mapCenterY * viewport.zoom

    setZoomDisplay(100)
    scheduleRender()
  }, [containerSize, scheduleRender])

  // Convert screen coordinates to map coordinates
  const screenToMap = React.useCallback((screenX: number, screenY: number): MapPoint | null => {
    const viewport = viewportRef.current
    const rect = canvasRef.current?.getBoundingClientRect()
    if (!rect) return null

    const canvasX = screenX - rect.left
    const canvasY = screenY - rect.top
    const mapX = (canvasX - viewport.offsetX) / viewport.zoom
    const mapY = (canvasY - viewport.offsetY) / viewport.zoom

    return { x: mapX, y: mapY }
  }, [])

  const [isPanningState, setIsPanningState] = React.useState(false)
  const isPaintingRef = React.useRef(false)
  const lastPaintedHexRef = React.useRef<string | null>(null)
  const lastClickTimeRef = React.useRef<number>(0)

  const handleMouseDown = React.useCallback(
    (e: React.MouseEvent) => {
      if (e.button !== 0) return

      const mapPos = screenToMap(e.clientX, e.clientY)
      if (!mapPos) return

      const viewport = viewportRef.current
      const now = Date.now()
      const isDoubleClick = now - lastClickTimeRef.current < 300
      lastClickTimeRef.current = now

      // Handle session tools (fog, token placement) - these take priority
      // But space bar overrides to enable panning
      if (sessionTool && onCellClick && !isSpaceHeld) {
        // Convert map position to cell coordinate
        if (isHexGrid) {
          const hex = pixelToHex(mapPos.x, mapPos.y, map.cellSize)
          if (isHexInBounds(hex, map)) {
            onCellClick({ q: hex.col, r: hex.row })
            // Enable painting mode for fog brush
            if (sessionTool === 'fog-brush') {
              isPaintingRef.current = true
              lastPaintedHexRef.current = `hex:${hex.col},${hex.row}`
            }
          }
        } else {
          // Square grid
          const col = Math.floor(mapPos.x / map.cellSize)
          const row = Math.floor(mapPos.y / map.cellSize)
          if (col >= 0 && col < map.width && row >= 0 && row < map.height) {
            onCellClick({ col, row })
            // Enable painting mode for fog brush
            if (sessionTool === 'fog-brush') {
              isPaintingRef.current = true
              lastPaintedHexRef.current = `sq:${col},${row}`
            }
          }
        }
        return
      }

      // Check if we should pan (drawingState.isSpaceHeld for edit mode, isSpaceHeld prop for session mode)
      if (tool === 'pan' || drawingState?.isSpaceHeld || isSpaceHeld) {
        // Start panning
        isPanningRef.current = true
        setIsPanningState(true)
        panStartRef.current = {
          x: e.clientX - viewport.offsetX,
          y: e.clientY - viewport.offsetY,
        }
        return
      }

      // Handle path tool
      if (tool === 'path' && isHexGrid) {
        // Check for vertex drag on selected path first
        if (drawingState?.selectedPathId && drawingState?.paths) {
          const selectedPath = drawingState.paths.find((p) => p.id === drawingState.selectedPathId)
          if (selectedPath) {
            const vertexIdx = hitTestPathVertex(
              mapPos,
              selectedPath,
              VERTEX_HIT_DISTANCE / viewport.zoom
            )
            if (vertexIdx !== null) {
              onStartDraggingVertex?.(vertexIdx)
              return
            }
          }
        }

        // Check for clicking on a path to select it
        if (drawingState?.paths && !drawingState?.pathInProgress) {
          for (const path of drawingState.paths) {
            if (hitTestPath(mapPos, path, PATH_HIT_DISTANCE / viewport.zoom)) {
              onSelectPath?.(path.id)
              return
            }
          }
        }

        // Get snap point or use cursor position
        // Borders only snap to corners
        const cornersOnly = drawingState?.selectedPathType === 'border'
        const snapResult = findNearestSnapPoint(
          mapPos,
          map.cellSize,
          map.width,
          map.height,
          SNAP_THRESHOLD / viewport.zoom,
          cornersOnly
        )
        const point = snapResult?.point ?? mapPos

        if (isDoubleClick && drawingState?.pathInProgress && drawingState.pathInProgress.length >= 2) {
          // Finish path on double-click
          onFinishPath?.()
        } else if (drawingState?.pathInProgress) {
          // Add point to existing path
          onAddPathPoint?.(point)
        } else {
          // Start new path
          onStartPath?.(point)
        }
        return
      }

      // Handle label tool
      if (tool === 'label' && isHexGrid) {
        // Check if clicking on existing label
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (ctx && drawingState?.labels) {
          for (const label of drawingState.labels) {
            if (hitTestLabel(mapPos, label, ctx)) {
              if (isDoubleClick) {
                // Double-click to edit
                onStartEditingLabel?.(label.id)
              } else if (drawingState.selectedLabelId === label.id) {
                // Click on already-selected label - start dragging
                onStartDraggingLabel?.()
              } else {
                // Single-click to select
                onSelectLabel?.(label.id)
              }
              return
            }
          }
        }

        // Click on empty space - create new label
        setNewLabelPosition(mapPos)
        return
      }

      // Handle erase tool
      if (tool === 'erase' && isHexGrid) {
        // Check paths first - select or delete if already selected
        if (drawingState?.paths) {
          for (const path of drawingState.paths) {
            if (hitTestPath(mapPos, path, PATH_HIT_DISTANCE / viewport.zoom)) {
              if (drawingState.selectedPathId === path.id) {
                // Already selected - delete it
                onDeletePath?.(path.id)
              } else {
                // Select it first
                onSelectPath?.(path.id)
              }
              return
            }
          }
        }

        // Check labels - select or delete if already selected
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (ctx && drawingState?.labels) {
          for (const label of drawingState.labels) {
            if (hitTestLabel(mapPos, label, ctx)) {
              if (drawingState.selectedLabelId === label.id) {
                // Already selected - delete it
                onDeleteLabel?.(label.id)
              } else {
                // Select it first
                onSelectLabel?.(label.id)
              }
              return
            }
          }
        }

        // Clear selection if clicking elsewhere
        if (drawingState?.selectedPathId || drawingState?.selectedLabelId) {
          onClearSelection?.()
        }

        // Erase terrain
        const hex = pixelToHex(mapPos.x, mapPos.y, map.cellSize)
        if (isHexInBounds(hex, map) && onHexClick) {
          isPaintingRef.current = true
          const hexKeyStr = `${hex.col},${hex.row}`
          lastPaintedHexRef.current = hexKeyStr
          onHexClick(hex)
        }
        return
      }

      // Handle terrain tool
      if (tool === 'terrain' && isHexGrid && onHexClick) {
        isPaintingRef.current = true
        const hex = pixelToHex(mapPos.x, mapPos.y, map.cellSize)
        if (isHexInBounds(hex, map)) {
          const hexKeyStr = `${hex.col},${hex.row}`
          lastPaintedHexRef.current = hexKeyStr
          onHexClick(hex)
        }
        return
      }

      // Handle wall tool (square grid only)
      if (tool === 'wall' && isSquareGrid) {
        isPaintingRef.current = true
        const cell = getWallAtPosition(mapPos.x, mapPos.y, map.cellSize)
        if (cell.col >= 0 && cell.col < map.width && cell.row >= 0 && cell.row < map.height) {
          const cellKey = `${cell.col},${cell.row}`
          lastPaintedHexRef.current = cellKey
          onPaintWall?.(cell.col, cell.row)
        }
        return
      }

      // Handle feature tool (square grid only)
      if (tool === 'feature' && isSquareGrid && drawingState) {
        // Check if clicking on existing feature to select it
        if (drawingState.features) {
          for (const feature of drawingState.features) {
            if (hitTestFeature(mapPos.x, mapPos.y, feature, map.cellSize)) {
              if (drawingState.selectedFeatureId === feature.id) {
                // Already selected - start dragging
                onStartDraggingFeature?.()
              } else {
                // Select it
                onSelectFeature?.(feature.id)
              }
              return
            }
          }
        }

        // Click on empty space - place new feature
        const cell = getWallAtPosition(mapPos.x, mapPos.y, map.cellSize)
        if (featureFitsInBounds(
          cell.col,
          cell.row,
          drawingState.selectedFeatureType,
          drawingState.featureRotation,
          map.width,
          map.height
        )) {
          onPlaceFeature?.(cell.col, cell.row)
        }
        return
      }

      // Handle label tool on square grid
      if (tool === 'label' && isSquareGrid) {
        // Check if clicking on existing label
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (ctx && drawingState?.labels) {
          for (const label of drawingState.labels) {
            if (hitTestLabel(mapPos, label, ctx)) {
              if (isDoubleClick) {
                // Double-click to edit
                onStartEditingLabel?.(label.id)
              } else if (drawingState.selectedLabelId === label.id) {
                // Click on already-selected label - start dragging
                onStartDraggingLabel?.()
              } else {
                // Single-click to select
                onSelectLabel?.(label.id)
              }
              return
            }
          }
        }

        // Click on empty space - create new label
        setNewLabelPosition(mapPos)
        return
      }

      // Handle erase tool on square grid
      if (tool === 'erase' && isSquareGrid && drawingState) {
        // Check features first
        for (const feature of drawingState.features ?? []) {
          if (hitTestFeature(mapPos.x, mapPos.y, feature, map.cellSize)) {
            if (drawingState.selectedFeatureId === feature.id) {
              // Already selected - delete it
              onDeleteFeature?.(feature.id)
            } else {
              // Select it first
              onSelectFeature?.(feature.id)
            }
            return
          }
        }

        // Check labels
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (ctx && drawingState.labels) {
          for (const label of drawingState.labels) {
            if (hitTestLabel(mapPos, label, ctx)) {
              if (drawingState.selectedLabelId === label.id) {
                // Already selected - delete it
                onDeleteLabel?.(label.id)
              } else {
                // Select it first
                onSelectLabel?.(label.id)
              }
              return
            }
          }
        }

        // Clear selection if clicking elsewhere
        if (drawingState.selectedFeatureId || drawingState.selectedLabelId) {
          onClearSelection?.()
        }

        // Erase wall
        isPaintingRef.current = true
        const cell = getWallAtPosition(mapPos.x, mapPos.y, map.cellSize)
        if (cell.col >= 0 && cell.col < map.width && cell.row >= 0 && cell.row < map.height) {
          const cellKey = `${cell.col},${cell.row}`
          lastPaintedHexRef.current = cellKey
          onEraseWall?.(cell.col, cell.row)
        }
        return
      }

    },
    [
      tool,
      drawingState,
      isHexGrid,
      isSquareGrid,
      onHexClick,
      screenToMap,
      map,
      onStartPath,
      onAddPathPoint,
      onFinishPath,
      onSelectPath,
      onDeletePath,
      onStartDraggingVertex,
      onSelectLabel,
      onDeleteLabel,
      onStartEditingLabel,
      onStartDraggingLabel,
      onPaintWall,
      onEraseWall,
      onPlaceFeature,
      onSelectFeature,
      onDeleteFeature,
      onStartDraggingFeature,
      onClearSelection,
      sessionTool,
      onCellClick,
      isSpaceHeld,
    ]
  )

  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent) => {
      const viewport = viewportRef.current

      if (isPanningRef.current) {
        viewport.offsetX = e.clientX - panStartRef.current.x
        viewport.offsetY = e.clientY - panStartRef.current.y
        scheduleRender()
        return
      }

      const mapPos = screenToMap(e.clientX, e.clientY)
      if (!mapPos) return

      setCursorMapPos(mapPos)

      // Handle fog brush painting
      if (isPaintingRef.current && sessionTool === 'fog-brush' && onCellClick) {
        if (isHexGrid) {
          const hex = pixelToHex(mapPos.x, mapPos.y, map.cellSize)
          if (isHexInBounds(hex, map)) {
            const key = `hex:${hex.col},${hex.row}`
            if (key !== lastPaintedHexRef.current) {
              lastPaintedHexRef.current = key
              onCellClick({ q: hex.col, r: hex.row })
            }
          }
        } else {
          const col = Math.floor(mapPos.x / map.cellSize)
          const row = Math.floor(mapPos.y / map.cellSize)
          if (col >= 0 && col < map.width && row >= 0 && row < map.height) {
            const key = `sq:${col},${row}`
            if (key !== lastPaintedHexRef.current) {
              lastPaintedHexRef.current = key
              onCellClick({ col, row })
            }
          }
        }
        return
      }

      // Handle vertex dragging
      if (
        drawingState?.draggingVertexIndex !== null &&
        drawingState?.draggingVertexIndex !== undefined &&
        drawingState?.selectedPathId
      ) {
        // Check if the selected path is a border (corners only)
        const selectedPath = drawingState.paths.find((p) => p.id === drawingState.selectedPathId)
        const cornersOnly = selectedPath?.type === 'border'
        const snapResult = findNearestSnapPoint(
          mapPos,
          map.cellSize,
          map.width,
          map.height,
          SNAP_THRESHOLD / viewport.zoom,
          cornersOnly
        )
        const point = snapResult?.point ?? mapPos
        setSnapPoint(snapResult?.point ?? null)
        onUpdatePathVertex?.(drawingState.selectedPathId, drawingState.draggingVertexIndex, point)
        return
      }

      // Handle label dragging
      if (drawingState?.draggingLabel && drawingState?.selectedLabelId) {
        onUpdateLabelPosition?.(drawingState.selectedLabelId, mapPos)
        return
      }

      // Handle feature dragging (square grid)
      if (drawingState?.draggingFeature && drawingState?.selectedFeatureId && isSquareGrid) {
        const cell = getWallAtPosition(mapPos.x, mapPos.y, map.cellSize)
        const feature = drawingState.features.find((f) => f.id === drawingState.selectedFeatureId)
        if (feature && featureFitsInBounds(
          cell.col,
          cell.row,
          feature.type,
          feature.rotation,
          map.width,
          map.height
        )) {
          onUpdateFeaturePosition?.(drawingState.selectedFeatureId, cell.col, cell.row)
        }
        return
      }

      // Update snap point for path tool
      if (tool === 'path' && isHexGrid) {
        // Borders only snap to corners
        const cornersOnly = drawingState?.selectedPathType === 'border'
        const snapResult = findNearestSnapPoint(
          mapPos,
          map.cellSize,
          map.width,
          map.height,
          SNAP_THRESHOLD / viewport.zoom,
          cornersOnly
        )
        setSnapPoint(snapResult?.point ?? null)
      } else {
        setSnapPoint(null)
      }

      // Update hover states for cursor
      let overPath = false
      let overLabel = false
      let overVertex = false

      if (drawingState?.paths) {
        // Check vertex hit first (for selected path)
        if (drawingState.selectedPathId) {
          const selectedPath = drawingState.paths.find((p) => p.id === drawingState.selectedPathId)
          if (selectedPath) {
            const vertexIdx = hitTestPathVertex(
              mapPos,
              selectedPath,
              VERTEX_HIT_DISTANCE / viewport.zoom
            )
            if (vertexIdx !== null) {
              overVertex = true
            }
          }
        }

        // Check path hit
        if (!overVertex) {
          for (const path of drawingState.paths) {
            if (hitTestPath(mapPos, path, PATH_HIT_DISTANCE / viewport.zoom)) {
              overPath = true
              break
            }
          }
        }
      }

      // Check label hit
      if (!overPath && !overVertex) {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (ctx && drawingState?.labels) {
          for (const label of drawingState.labels) {
            if (hitTestLabel(mapPos, label, ctx)) {
              overLabel = true
              break
            }
          }
        }
      }

      // Check feature hit (square grid)
      let overFeature = false
      if (isSquareGrid && drawingState?.features) {
        for (const feature of drawingState.features) {
          if (hitTestFeature(mapPos.x, mapPos.y, feature, map.cellSize)) {
            overFeature = true
            break
          }
        }
      }

      setIsOverPath(overPath)
      setIsOverLabel(overLabel)
      setIsOverVertex(overVertex)
      setIsOverFeature(overFeature)

      // Handle square grid cell hover for wall/feature tools
      if (isSquareGrid && (tool === 'wall' || tool === 'feature' || tool === 'erase')) {
        const cell = getWallAtPosition(mapPos.x, mapPos.y, map.cellSize)
        if (cell.col >= 0 && cell.col < map.width && cell.row >= 0 && cell.row < map.height) {
          setHoveredCell(cell)
          onHoveredCellChange?.(cell)

          // Paint walls while dragging (wall tool)
          if (isPaintingRef.current && tool === 'wall') {
            const cellKey = `${cell.col},${cell.row}`
            if (cellKey !== lastPaintedHexRef.current) {
              lastPaintedHexRef.current = cellKey
              onPaintWall?.(cell.col, cell.row)
            }
          }

          // Erase walls while dragging (erase tool)
          if (isPaintingRef.current && tool === 'erase') {
            const cellKey = `${cell.col},${cell.row}`
            if (cellKey !== lastPaintedHexRef.current) {
              lastPaintedHexRef.current = cellKey
              onEraseWall?.(cell.col, cell.row)
            }
          }
        } else {
          setHoveredCell(null)
          onHoveredCellChange?.(null)
        }
      } else if (isSquareGrid) {
        // Clear hovered cell when not using wall/feature/erase tools
        setHoveredCell(null)
        onHoveredCellChange?.(null)
      }

      // Handle hex hover for terrain/erase tools
      if (isHexGrid && (tool === 'terrain' || tool === 'erase')) {
        const hex = pixelToHex(mapPos.x, mapPos.y, map.cellSize)
        if (isHexInBounds(hex, map)) {
          if (onHexHover) {
            onHexHover(hex)
          }
          // Paint while dragging
          if (isPaintingRef.current && onHexClick) {
            const hexKeyStr = `${hex.col},${hex.row}`
            if (hexKeyStr !== lastPaintedHexRef.current) {
              lastPaintedHexRef.current = hexKeyStr
              onHexClick(hex)
            }
          }
        } else {
          if (onHexHover) {
            onHexHover(null)
          }
        }
      }
    },
    [
      scheduleRender,
      isHexGrid,
      isSquareGrid,
      onHexHover,
      onHexClick,
      tool,
      screenToMap,
      map,
      drawingState,
      onUpdatePathVertex,
      onUpdateLabelPosition,
      onUpdateFeaturePosition,
      onHoveredCellChange,
      onPaintWall,
      onEraseWall,
      sessionTool,
      onCellClick,
    ]
  )

  const handleMouseUp = React.useCallback(() => {
    isPanningRef.current = false
    isPaintingRef.current = false
    lastPaintedHexRef.current = null
    setIsPanningState(false)

    if (drawingState?.draggingVertexIndex !== null && drawingState?.draggingVertexIndex !== undefined) {
      onStopDraggingVertex?.()
    }
    if (drawingState?.draggingLabel) {
      onStopDraggingLabel?.()
    }
    if (drawingState?.draggingFeature) {
      onStopDraggingFeature?.()
    }
  }, [drawingState, onStopDraggingVertex, onStopDraggingLabel, onStopDraggingFeature])

  const handleMouseLeave = React.useCallback(() => {
    isPanningRef.current = false
    isPaintingRef.current = false
    lastPaintedHexRef.current = null
    setIsPanningState(false)
    setCursorMapPos(null)
    setSnapPoint(null)
    setHoveredCell(null)
    if (onHexHover) {
      onHexHover(null)
    }
    onHoveredCellChange?.(null)
  }, [onHexHover, onHoveredCellChange])

  // Touch handlers
  const touchStateRef = React.useRef<{
    x: number
    y: number
    distance?: number
    initialZoom?: number
  }>({ x: 0, y: 0 })

  const handleTouchStart = React.useCallback((e: React.TouchEvent) => {
    const viewport = viewportRef.current
    if (e.touches.length === 1) {
      isPanningRef.current = true
      touchStateRef.current = {
        x: e.touches[0].clientX - viewport.offsetX,
        y: e.touches[0].clientY - viewport.offsetY,
      }
    } else if (e.touches.length === 2) {
      isPanningRef.current = false
      const distance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )
      touchStateRef.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2 - viewport.offsetX,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2 - viewport.offsetY,
        distance,
        initialZoom: viewport.zoom,
      }
    }
  }, [])

  // Handle touch move - stored in ref so we can attach with { passive: false }
  const handleTouchMoveRef = React.useRef((e: TouchEvent) => {
    e.preventDefault()
    const viewport = viewportRef.current

    if (e.touches.length === 1 && isPanningRef.current) {
      viewport.offsetX = e.touches[0].clientX - touchStateRef.current.x
      viewport.offsetY = e.touches[0].clientY - touchStateRef.current.y
      scheduleRender()
    } else if (
      e.touches.length === 2 &&
      touchStateRef.current.distance &&
      touchStateRef.current.initialZoom
    ) {
      const newDistance = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      )

      const scale = newDistance / touchStateRef.current.distance
      const newZoom = Math.max(
        MIN_ZOOM,
        Math.min(MAX_ZOOM, touchStateRef.current.initialZoom * scale)
      )

      const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2
      const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2

      const zoomRatio = newZoom / viewport.zoom
      viewport.offsetX = centerX - (centerX - viewport.offsetX) * zoomRatio
      viewport.offsetY = centerY - (centerY - viewport.offsetY) * zoomRatio
      viewport.zoom = newZoom

      setZoomDisplay(Math.round(newZoom * 100))
      scheduleRender()
    }
  })

  // Update the ref when scheduleRender changes
  React.useEffect(() => {
    handleTouchMoveRef.current = (e: TouchEvent) => {
      e.preventDefault()
      const viewport = viewportRef.current

      if (e.touches.length === 1 && isPanningRef.current) {
        viewport.offsetX = e.touches[0].clientX - touchStateRef.current.x
        viewport.offsetY = e.touches[0].clientY - touchStateRef.current.y
        scheduleRender()
      } else if (
        e.touches.length === 2 &&
        touchStateRef.current.distance &&
        touchStateRef.current.initialZoom
      ) {
        const newDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        )

        const scale = newDistance / touchStateRef.current.distance
        const newZoom = Math.max(
          MIN_ZOOM,
          Math.min(MAX_ZOOM, touchStateRef.current.initialZoom * scale)
        )

        const centerX = (e.touches[0].clientX + e.touches[1].clientX) / 2
        const centerY = (e.touches[0].clientY + e.touches[1].clientY) / 2

        const zoomRatio = newZoom / viewport.zoom
        viewport.offsetX = centerX - (centerX - viewport.offsetX) * zoomRatio
        viewport.offsetY = centerY - (centerY - viewport.offsetY) * zoomRatio
        viewport.zoom = newZoom

        setZoomDisplay(Math.round(newZoom * 100))
        scheduleRender()
      }
    }
  }, [scheduleRender])

  // Attach touchmove listener with { passive: false } to allow preventDefault
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const handler = (e: TouchEvent) => handleTouchMoveRef.current(e)
    canvas.addEventListener('touchmove', handler, { passive: false })

    return () => {
      canvas.removeEventListener('touchmove', handler)
    }
  }, [])

  const handleTouchEnd = React.useCallback(() => {
    isPanningRef.current = false
    touchStateRef.current = { x: 0, y: 0 }
  }, [])

  // Handle new label creation
  const handleLabelConfirm = React.useCallback(
    (text: string) => {
      if (newLabelPosition && text.trim()) {
        onCreateLabel?.(newLabelPosition, text)
      }
      setNewLabelPosition(null)
    },
    [newLabelPosition, onCreateLabel]
  )

  const handleLabelCancel = React.useCallback(() => {
    setNewLabelPosition(null)
  }, [])

  // Handle editing existing label
  const handleEditLabelConfirm = React.useCallback(
    (text: string) => {
      onFinishEditingLabel?.(text)
    },
    [onFinishEditingLabel]
  )

  const handleEditLabelCancel = React.useCallback(() => {
    onCancelEditingLabel?.()
  }, [onCancelEditingLabel])

  const cursor = getCursorForTool(tool, isPanningState, isOverPath, isOverLabel, isOverVertex, isOverFeature, sessionTool, isSpaceHeld)
  const viewport = viewportRef.current

  // Get editing label data
  const editingLabel = drawingState?.labelEditingId
    ? drawingState.labels.find((l) => l.id === drawingState.labelEditingId)
    : null

  return (
    <div className={`relative overflow-hidden ${className}`}>
      <div
        ref={containerRef}
        className={`h-full w-full overflow-hidden bg-white ${showBorder ? 'border-3 border-ink' : ''}`}
        style={{ cursor }}
      >
        <canvas
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchEnd={handleTouchEnd}
          className="touch-none"
        />
        {/* Label editor for new label */}
        {newLabelPosition && drawingState && (
          <LabelEditor
            position={newLabelPosition}
            initialText=""
            size={drawingState.selectedLabelSize}
            zoom={viewport.zoom}
            offset={{ x: viewport.offsetX, y: viewport.offsetY }}
            onConfirm={handleLabelConfirm}
            onCancel={handleLabelCancel}
          />
        )}
        {/* Label editor for editing existing label */}
        {editingLabel && drawingState && (
          <LabelEditor
            position={editingLabel.position}
            initialText={editingLabel.text}
            size={editingLabel.size}
            zoom={viewport.zoom}
            offset={{ x: viewport.offsetX, y: viewport.offsetY }}
            onConfirm={handleEditLabelConfirm}
            onCancel={handleEditLabelCancel}
          />
        )}
      </div>
      <div className="absolute bottom-3 left-3 flex items-stretch border-2 border-ink bg-parchment-100 font-body text-xs text-ink shadow-brutal md:bottom-4 md:left-4">
        <button
          onClick={handleZoomOut}
          className="flex w-7 items-center justify-center border-r border-ink transition-colors hover:bg-ink hover:text-parchment-100"
          aria-label="Zoom out"
        >
          &minus;
        </button>
        <button
          onClick={handleZoomReset}
          className="flex cursor-pointer items-center px-2 transition-colors hover:bg-ink hover:text-parchment-100"
          aria-label="Reset zoom to 100%"
        >
          {zoomDisplay}%
        </button>
        <button
          onClick={handleZoomIn}
          className="flex w-7 items-center justify-center border-l border-ink transition-colors hover:bg-ink hover:text-parchment-100"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
    </div>
  )
}
