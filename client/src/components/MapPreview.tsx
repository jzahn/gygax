import * as React from 'react'
import type { Map, MapContent } from '@gygax/shared'
import { hexToPixel } from '../utils/hexUtils'
import { renderTerrainIcon, preloadTerrainImages, areTerrainImagesLoaded } from '../utils/terrainIcons'
import { renderPath } from '../utils/pathUtils'
import { renderLabel } from '../utils/labelUtils'
import { renderWalls, renderFeature, wallsToSet } from '../utils/featureUtils'

interface MapPreviewProps {
  map: Map
  className?: string
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

function getMapDimensions(map: Map) {
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
}

export function MapPreview({ map, className = '' }: MapPreviewProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [containerSize, setContainerSize] = React.useState({ width: 0, height: 0 })
  const [imagesReady, setImagesReady] = React.useState(areTerrainImagesLoaded())

  // Preload terrain images
  React.useEffect(() => {
    if (!imagesReady) {
      preloadTerrainImages().then(() => {
        setImagesReady(true)
      })
    }
  }, [imagesReady])

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

  // Render the map preview
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || containerSize.width === 0 || containerSize.height === 0) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const displayWidth = containerSize.width
    const displayHeight = containerSize.height

    canvas.width = displayWidth * dpr
    canvas.height = displayHeight * dpr
    canvas.style.width = `${displayWidth}px`
    canvas.style.height = `${displayHeight}px`

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)

    // Fill background
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, displayWidth, displayHeight)

    // Zoom level: 50% for square grids, 100% for hex grids
    const zoom = map.gridType === 'SQUARE' ? 0.5 : 1
    const mapDims = getMapDimensions(map)

    // Calculate offset to center the map in the viewport
    const mapCenterX = mapDims.width / 2
    const mapCenterY = mapDims.height / 2
    const viewCenterX = displayWidth / 2
    const viewCenterY = displayHeight / 2

    // Offset so map center aligns with view center
    const offsetX = viewCenterX - mapCenterX * zoom
    const offsetY = viewCenterY - mapCenterY * zoom

    ctx.save()
    ctx.translate(offsetX, offsetY)
    ctx.scale(zoom, zoom)

    const content: MapContent | null = map.content

    // 1. For square grids, draw walls before grid lines
    if (map.gridType === 'SQUARE' && content?.walls && content.walls.length > 0) {
      const wallsSet = wallsToSet(content.walls)
      renderWalls(ctx, wallsSet, map.cellSize)
    }

    // 2. Draw grid
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 1 / zoom

    if (map.gridType === 'SQUARE') {
      drawSquareGrid(ctx, map)
    } else {
      drawHexGrid(ctx, map)
    }

    // 3. Draw paths (hex maps)
    // Render order: rivers/streams first (below), then roads/borders/trails (above)
    if (content?.paths) {
      const waterPaths = content.paths.filter(p => p.type === 'river' || p.type === 'stream')
      const otherPaths = content.paths.filter(p => p.type !== 'river' && p.type !== 'stream')
      for (const path of [...waterPaths, ...otherPaths]) {
        renderPath(ctx, path, zoom)
      }
    }

    // 4. Draw terrain icons (hex maps)
    if (map.gridType === 'HEX' && content?.terrain) {
      for (const stamp of content.terrain) {
        const { x, y } = hexToPixel(stamp.hex, map.cellSize)
        renderTerrainIcon(ctx, x, y, stamp.terrain, map.cellSize, stamp.variant)
      }
    }

    // 5. Draw features (square maps)
    if (map.gridType === 'SQUARE' && content?.features) {
      for (const feature of content.features) {
        renderFeature(ctx, feature, map.cellSize, false)
      }
    }

    // 6. Draw labels
    if (content?.labels) {
      for (const label of content.labels) {
        renderLabel(ctx, label, zoom, false)
      }
    }

    ctx.restore()
  }, [map, containerSize, imagesReady])

  return (
    <div ref={containerRef} className={`h-full w-full ${className}`}>
      <canvas ref={canvasRef} className="block h-full w-full" />
    </div>
  )
}
