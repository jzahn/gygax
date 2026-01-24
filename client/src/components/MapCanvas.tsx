import * as React from 'react'
import type { Map, HexCoord, TerrainType, MapPoint } from '@gygax/shared'
import type { DrawingState, DrawingTool, StoredTerrain } from '../hooks/useMapDrawing'
import { hexToPixel, pixelToHex, isHexInBounds, findNearestSnapPoint } from '../utils/hexUtils'
import { renderTerrainIcon } from '../utils/terrainIcons'
import {
  renderPath,
  renderPathHandles,
  renderPathPreview,
  renderSnapIndicator,
  hitTestPath,
  hitTestPathVertex,
} from '../utils/pathUtils'
import { renderLabel, hitTestLabel } from '../utils/labelUtils'
import { LabelEditor } from './LabelEditor'

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
  // Selection
  onClearSelection?: () => void
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

// Draw hex grid (flat-top orientation, odd-q offset)
function drawHexGrid(ctx: CanvasRenderingContext2D, map: Map) {
  const { width, height, cellSize } = map

  const size = cellSize / 2
  const hexHeight = Math.sqrt(3) * size
  const horizSpacing = size * 1.5
  const vertSpacing = hexHeight

  ctx.beginPath()

  function hexCorner(cx: number, cy: number, i: number) {
    const angleDeg = 60 * i
    const angleRad = (Math.PI / 180) * angleDeg
    return {
      x: cx + size * Math.cos(angleRad),
      y: cy + size * Math.sin(angleRad),
    }
  }

  for (let col = 0; col < width; col++) {
    for (let row = 0; row < height; row++) {
      const cx = size + col * horizSpacing
      const cy = hexHeight / 2 + row * vertSpacing + (col % 2 === 1 ? vertSpacing / 2 : 0)

      const start = hexCorner(cx, cy, 0)
      ctx.moveTo(start.x, start.y)
      for (let i = 1; i <= 6; i++) {
        const corner = hexCorner(cx, cy, i % 6)
        ctx.lineTo(corner.x, corner.y)
      }
    }
  }

  ctx.stroke()
}

// Draw terrain icons for hex grids
function drawTerrain(
  ctx: CanvasRenderingContext2D,
  terrain: Map<string, StoredTerrain>,
  cellSize: number
) {
  terrain.forEach((stored, key) => {
    const [col, row] = key.split(',').map(Number)
    const { x, y } = hexToPixel({ col, row }, cellSize)
    renderTerrainIcon(ctx, x, y, stored.terrain, cellSize, stored.variant)
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
  isOverVertex: boolean
): string {
  if (isPanning) return 'grabbing'
  if (isOverVertex) return 'move'
  if (isOverPath || isOverLabel) return 'pointer'
  switch (tool) {
    case 'pan':
      return 'grab'
    case 'terrain':
    case 'erase':
    case 'path':
    case 'label':
      return 'crosshair'
    default:
      return 'default'
  }
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
  onClearSelection,
}: MapCanvasProps) {
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
  const [newLabelPosition, setNewLabelPosition] = React.useState<MapPoint | null>(null)

  const tool = drawingState?.tool ?? 'pan'
  const isHexGrid = map.gridType === 'HEX'

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

    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, displayWidth, displayHeight)

    ctx.save()
    ctx.translate(viewport.offsetX, viewport.offsetY)
    ctx.scale(viewport.zoom, viewport.zoom)

    // 1. Draw grid lines (lowest layer)
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 1 / viewport.zoom

    if (map.gridType === 'SQUARE') {
      drawSquareGrid(ctx, map)
    } else {
      drawHexGrid(ctx, map)
    }

    // 2. Draw all paths
    if (drawingState?.paths) {
      for (const path of drawingState.paths) {
        renderPath(ctx, path, viewport.zoom)
      }
    }

    // 3. Draw terrain icons (on top of paths)
    if (isHexGrid && drawingState?.terrain) {
      drawTerrain(ctx, drawingState.terrain, map.cellSize)
    }

    // 4. Draw labels
    if (drawingState?.labels) {
      for (const label of drawingState.labels) {
        // Don't render label being edited (it will be shown as input)
        if (label.id !== drawingState.labelEditingId) {
          renderLabel(ctx, label, viewport.zoom, label.id === drawingState.selectedLabelId)
        }
      }
    }

    // 5. Draw path preview (while drawing)
    if (drawingState?.pathInProgress && tool === 'path') {
      renderPathPreview(
        ctx,
        drawingState.pathInProgress,
        drawingState.selectedPathType,
        viewport.zoom,
        cursorMapPos ?? undefined
      )
    }

    // 6. Draw snap indicator
    if (tool === 'path' && snapPoint) {
      renderSnapIndicator(ctx, snapPoint, viewport.zoom)
    }

    // 7. Draw hover preview for terrain/erase (but not when over a path/label in erase mode)
    const showErasePreview = tool === 'erase' && !isOverPath && !isOverLabel
    if (isHexGrid && drawingState?.hoveredHex && (tool === 'terrain' || showErasePreview)) {
      drawHoverPreview(ctx, drawingState.hoveredHex, tool, drawingState.selectedTerrain, map.cellSize)
    }

    // 8. Draw selected path handles
    if (drawingState?.selectedPathId) {
      const selectedPath = drawingState.paths.find((p) => p.id === drawingState.selectedPathId)
      if (selectedPath) {
        renderPathHandles(ctx, selectedPath, viewport.zoom)
      }
    }

    ctx.restore()
  }, [map, containerSize, drawingState, tool, isHexGrid, cursorMapPos, snapPoint, isOverPath, isOverLabel])

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
    cursorMapPos,
    snapPoint,
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

      // Check if we should pan
      if (tool === 'pan' || drawingState?.isSpaceHeld) {
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
        const snapResult = findNearestSnapPoint(
          mapPos,
          map.cellSize,
          map.width,
          map.height,
          SNAP_THRESHOLD / viewport.zoom
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

    },
    [
      tool,
      drawingState,
      isHexGrid,
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
      onClearSelection,
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

      // Handle vertex dragging
      if (
        drawingState?.draggingVertexIndex !== null &&
        drawingState?.draggingVertexIndex !== undefined &&
        drawingState?.selectedPathId
      ) {
        const snapResult = findNearestSnapPoint(
          mapPos,
          map.cellSize,
          map.width,
          map.height,
          SNAP_THRESHOLD / viewport.zoom
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

      // Update snap point for path tool
      if (tool === 'path' && isHexGrid) {
        const snapResult = findNearestSnapPoint(
          mapPos,
          map.cellSize,
          map.width,
          map.height,
          SNAP_THRESHOLD / viewport.zoom
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

      setIsOverPath(overPath)
      setIsOverLabel(overLabel)
      setIsOverVertex(overVertex)

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
      onHexHover,
      onHexClick,
      tool,
      screenToMap,
      map,
      drawingState,
      onUpdatePathVertex,
      onUpdateLabelPosition,
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
  }, [drawingState, onStopDraggingVertex, onStopDraggingLabel])

  const handleMouseLeave = React.useCallback(() => {
    isPanningRef.current = false
    isPaintingRef.current = false
    lastPaintedHexRef.current = null
    setIsPanningState(false)
    setCursorMapPos(null)
    setSnapPoint(null)
    if (onHexHover) {
      onHexHover(null)
    }
  }, [onHexHover])

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

  const handleTouchMove = React.useCallback(
    (e: React.TouchEvent) => {
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
    },
    [scheduleRender]
  )

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

  const cursor = getCursorForTool(tool, isPanningState, isOverPath, isOverLabel, isOverVertex)
  const viewport = viewportRef.current

  // Get editing label data
  const editingLabel = drawingState?.labelEditingId
    ? drawingState.labels.find((l) => l.id === drawingState.labelEditingId)
    : null

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        className="h-full w-full overflow-hidden border-3 border-ink bg-white"
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
          onTouchMove={handleTouchMove}
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
      <div className="absolute bottom-2 left-2 flex items-stretch rounded border-2 border-ink bg-parchment-100 font-body text-xs text-ink">
        <button
          onClick={handleZoomOut}
          className="flex w-7 items-center justify-center border-r border-ink hover:bg-parchment-200"
          aria-label="Zoom out"
        >
          &minus;
        </button>
        <span className="flex items-center px-2">{zoomDisplay}%</span>
        <button
          onClick={handleZoomIn}
          className="flex w-7 items-center justify-center border-l border-ink hover:bg-parchment-200"
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
    </div>
  )
}
