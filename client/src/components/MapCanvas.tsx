import * as React from 'react'
import type { Map } from '@gygax/shared'

interface MapCanvasProps {
  map: Map
  className?: string
}

interface ViewportState {
  offsetX: number
  offsetY: number
  zoom: number
}

const MIN_ZOOM = 0.5
const MAX_ZOOM = 5
const ZOOM_STEP_SMALL = 0.1  // 10% when below 100%
const ZOOM_STEP_LARGE = 0.25 // 25% when at or above 100%

// Draw square grid
function drawSquareGrid(ctx: CanvasRenderingContext2D, map: Map) {
  const { width, height, cellSize } = map

  ctx.beginPath()

  // Vertical lines
  for (let x = 0; x <= width; x++) {
    ctx.moveTo(x * cellSize, 0)
    ctx.lineTo(x * cellSize, height * cellSize)
  }

  // Horizontal lines
  for (let y = 0; y <= height; y++) {
    ctx.moveTo(0, y * cellSize)
    ctx.lineTo(width * cellSize, y * cellSize)
  }

  ctx.stroke()
}

// Draw hex grid (flat-top orientation, odd-q offset)
// Reference: https://www.redblobgames.com/grids/hexagons/
function drawHexGrid(ctx: CanvasRenderingContext2D, map: Map) {
  const { width, height, cellSize } = map

  // For flat-top hexagons:
  // - size = distance from center to corner (circumradius)
  // - width (point-to-point) = 2 * size
  // - height (flat-to-flat) = sqrt(3) * size
  const size = cellSize / 2
  const hexHeight = Math.sqrt(3) * size

  // Spacing between hex centers (flat-top, odd-q offset)
  const horizSpacing = size * 1.5 // 3/4 of width
  const vertSpacing = hexHeight

  ctx.beginPath()

  // Get hex corner position (flat-top: corner 0 points right at angle 0)
  function hexCorner(cx: number, cy: number, i: number) {
    const angleDeg = 60 * i
    const angleRad = (Math.PI / 180) * angleDeg
    return {
      x: cx + size * Math.cos(angleRad),
      y: cy + size * Math.sin(angleRad),
    }
  }

  // Draw each hex - we draw all 6 edges but structure it to minimize overdraw
  // For a proper tessellation, each edge is shared by two hexes
  // We'll draw each hex completely - canvas handles overlapping lines fine
  for (let col = 0; col < width; col++) {
    for (let row = 0; row < height; row++) {
      // Calculate hex center (odd-q offset: odd columns shifted down)
      const cx = size + col * horizSpacing
      const cy = hexHeight / 2 + row * vertSpacing + (col % 2 === 1 ? vertSpacing / 2 : 0)

      // Draw hexagon outline
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

export function MapCanvas({ map, className = '' }: MapCanvasProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 })
  const [zoomDisplay, setZoomDisplay] = React.useState(100)

  // Use refs for viewport state to avoid re-renders during pan/zoom
  const viewportRef = React.useRef<ViewportState>({
    offsetX: 0,
    offsetY: 0,
    zoom: 1,
  })
  const isPanningRef = React.useRef(false)
  const panStartRef = React.useRef({ x: 0, y: 0 })
  const rafIdRef = React.useRef<number | null>(null)

  // Calculate map dimensions in pixels
  const getMapDimensions = React.useCallback(() => {
    if (map.gridType === 'SQUARE') {
      return {
        width: map.width * map.cellSize,
        height: map.height * map.cellSize,
      }
    } else {
      // Flat-top hex grid dimensions
      const size = map.cellSize / 2
      const hexHeight = Math.sqrt(3) * size
      const horizSpacing = size * 1.5
      // Width: first hex is full width (2*size), subsequent hexes add 1.5*size each
      // Height: depends on whether last column is odd (extends down by half)
      const totalWidth = size * 2 + (map.width - 1) * horizSpacing
      const hasOddLastCol = (map.width - 1) % 2 === 1
      const totalHeight = map.height * hexHeight + (hasOddLastCol ? hexHeight / 2 : 0)
      return {
        width: totalWidth,
        height: totalHeight,
      }
    }
  }, [map])

  // Render function
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

    // Set canvas size accounting for device pixel ratio
    if (canvas.width !== displayWidth * dpr || canvas.height !== displayHeight * dpr) {
      canvas.width = displayWidth * dpr
      canvas.height = displayHeight * dpr
      canvas.style.width = `${displayWidth}px`
      canvas.style.height = `${displayHeight}px`
    }

    // Reset transform and clear
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)

    // Clear canvas
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, displayWidth, displayHeight)

    // Apply viewport transform
    ctx.save()
    ctx.translate(viewport.offsetX, viewport.offsetY)
    ctx.scale(viewport.zoom, viewport.zoom)

    // Draw grid
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 1 / viewport.zoom

    if (map.gridType === 'SQUARE') {
      drawSquareGrid(ctx, map)
    } else {
      drawHexGrid(ctx, map)
    }

    ctx.restore()
  }, [map, containerSize])

  // Schedule a render
  const scheduleRender = React.useCallback(() => {
    if (rafIdRef.current !== null) {
      cancelAnimationFrame(rafIdRef.current)
    }
    rafIdRef.current = requestAnimationFrame(() => {
      render()
      rafIdRef.current = null
    })
  }, [render])

  // Observe container size changes
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

  // Center map initially when container size changes
  React.useEffect(() => {
    if (containerSize.width > 0 && containerSize.height > 0) {
      const dims = getMapDimensions()
      const viewport = viewportRef.current
      viewport.offsetX = (containerSize.width - dims.width * viewport.zoom) / 2
      viewport.offsetY = (containerSize.height - dims.height * viewport.zoom) / 2
      scheduleRender()
    }
  }, [containerSize.width, containerSize.height, getMapDimensions, scheduleRender])

  // Initial render when map changes
  React.useEffect(() => {
    scheduleRender()
  }, [map, scheduleRender])

  // Cleanup RAF on unmount
  React.useEffect(() => {
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current)
      }
    }
  }, [])

  // Get zoom step based on current zoom level and direction
  const getZoomStep = React.useCallback((currentZoom: number, zoomingIn: boolean) => {
    // Use larger steps (25%) at or above 100%, smaller steps (10%) below 100%
    // Use rounded percentage to avoid floating point issues
    const zoomPercent = Math.round(currentZoom * 100)
    if (zoomingIn) {
      return zoomPercent >= 100 ? ZOOM_STEP_LARGE : ZOOM_STEP_SMALL
    } else {
      // When zooming out, use large step if above 100%
      return zoomPercent > 100 ? ZOOM_STEP_LARGE : ZOOM_STEP_SMALL
    }
  }, [])

  // Zoom toward a point (used by wheel and button zoom)
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

  // Handle mouse wheel zoom
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

  // Handle button zoom (zooms toward center of canvas)
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

  // Handle pan start
  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    isPanningRef.current = true
    const viewport = viewportRef.current
    panStartRef.current = {
      x: e.clientX - viewport.offsetX,
      y: e.clientY - viewport.offsetY,
    }
  }, [])

  // Handle pan move
  const handleMouseMove = React.useCallback(
    (e: React.MouseEvent) => {
      if (!isPanningRef.current) return
      const viewport = viewportRef.current
      viewport.offsetX = e.clientX - panStartRef.current.x
      viewport.offsetY = e.clientY - panStartRef.current.y
      scheduleRender()
    },
    [scheduleRender]
  )

  // Handle pan end
  const handleMouseUp = React.useCallback(() => {
    isPanningRef.current = false
  }, [])

  // Handle touch events for mobile
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
      } else if (e.touches.length === 2 && touchStateRef.current.distance && touchStateRef.current.initialZoom) {
        const newDistance = Math.hypot(
          e.touches[0].clientX - e.touches[1].clientX,
          e.touches[0].clientY - e.touches[1].clientY
        )

        const scale = newDistance / touchStateRef.current.distance
        const newZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, touchStateRef.current.initialZoom * scale))

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

  // Track panning state for cursor
  const [isPanningState, setIsPanningState] = React.useState(false)

  const handleMouseDownWithState = React.useCallback(
    (e: React.MouseEvent) => {
      handleMouseDown(e)
      if (e.button === 0) setIsPanningState(true)
    },
    [handleMouseDown]
  )

  const handleMouseUpWithState = React.useCallback(() => {
    handleMouseUp()
    setIsPanningState(false)
  }, [handleMouseUp])

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        className="h-full w-full overflow-hidden border-3 border-ink bg-white"
        style={{ cursor: isPanningState ? 'grabbing' : 'grab' }}
      >
        <canvas
          ref={canvasRef}
          onWheel={handleWheel}
          onMouseDown={handleMouseDownWithState}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUpWithState}
          onMouseLeave={handleMouseUpWithState}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className="touch-none"
        />
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
