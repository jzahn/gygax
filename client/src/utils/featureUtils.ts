import type { DungeonFeature, FeatureType, FeatureSize, WallCell } from '@gygax/shared'
import { FEATURE_SIZES } from '@gygax/shared'

// Feature display names
export const FEATURE_NAMES: Record<FeatureType, string> = {
  door: 'Door',
  'door-double': 'Double Door',
  'door-secret': 'Secret Door',
  'door-locked': 'Locked Door',
  'stairs-up': 'Stairs Up',
  'stairs-down': 'Stairs Down',
  pillar: 'Pillar',
  statue: 'Statue',
  altar: 'Altar',
  fountain: 'Fountain',
  chest: 'Chest',
  throne: 'Throne',
  trap: 'Trap',
  pit: 'Pit',
  lever: 'Lever',
  fireplace: 'Fireplace',
  table: 'Table',
  bed: 'Bed',
}

// Feature categories for the palette
export const FEATURE_CATEGORIES: { name: string; types: FeatureType[] }[] = [
  { name: 'Doors', types: ['door', 'door-double', 'door-secret', 'door-locked'] },
  { name: 'Stairs', types: ['stairs-up', 'stairs-down'] },
  { name: 'Furnishings', types: ['pillar', 'statue', 'altar', 'fountain', 'chest', 'throne', 'bed', 'table', 'fireplace'] },
  { name: 'Hazards', types: ['trap', 'pit'] },
  { name: 'Misc', types: ['lever'] },
]

// Parse size string to dimensions [width, height]
export function parseSize(size: FeatureSize): [number, number] {
  const [w, h] = size.split('x').map(Number)
  return [w, h]
}

// Get feature dimensions considering rotation
export function getFeatureDimensions(
  type: FeatureType,
  rotation: 0 | 90 | 180 | 270
): [number, number] {
  const size = FEATURE_SIZES[type]
  const [baseW, baseH] = parseSize(size)
  return rotation === 90 || rotation === 270 ? [baseH, baseW] : [baseW, baseH]
}

// Check if a feature fits within map bounds
export function featureFitsInBounds(
  col: number,
  row: number,
  type: FeatureType,
  rotation: 0 | 90 | 180 | 270,
  mapWidth: number,
  mapHeight: number
): boolean {
  const [w, h] = getFeatureDimensions(type, rotation)
  return col >= 0 && col + w <= mapWidth && row >= 0 && row + h <= mapHeight
}

// Hit test a point against a feature
export function hitTestFeature(
  mapX: number,
  mapY: number,
  feature: DungeonFeature,
  cellSize: number
): boolean {
  const [w, h] = getFeatureDimensions(feature.type, feature.rotation)
  const x = feature.position.col * cellSize
  const y = feature.position.row * cellSize
  const width = w * cellSize
  const height = h * cellSize

  return mapX >= x && mapX < x + width && mapY >= y && mapY < y + height
}

// Convert wall set key to coords
export function parseWallKey(key: string): { col: number; row: number } {
  const [col, row] = key.split(',').map(Number)
  return { col, row }
}

// Create wall set key from coords
export function wallKey(col: number, row: number): string {
  return `${col},${row}`
}

// Convert walls Set to array for saving
export function wallsToArray(walls: Set<string>): WallCell[] {
  return Array.from(walls).map((key) => parseWallKey(key))
}

// Convert walls array to Set for state
export function wallsToSet(walls: WallCell[]): Set<string> {
  return new Set(walls.map((w) => wallKey(w.col, w.row)))
}

// Render a wall cell
export function renderWall(
  ctx: CanvasRenderingContext2D,
  col: number,
  row: number,
  cellSize: number
): void {
  ctx.fillStyle = '#1a1a1a'
  ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize)
}

// Render all walls
export function renderWalls(
  ctx: CanvasRenderingContext2D,
  walls: Set<string>,
  cellSize: number
): void {
  ctx.fillStyle = '#1a1a1a'
  walls.forEach((key) => {
    const { col, row } = parseWallKey(key)
    ctx.fillRect(col * cellSize, row * cellSize, cellSize, cellSize)
  })
}

// Draw a simple feature icon (canvas-based, no image loading)
export function renderFeatureIcon(
  ctx: CanvasRenderingContext2D,
  type: FeatureType,
  x: number,
  y: number,
  width: number,
  height: number,
  rotation: 0 | 90 | 180 | 270 = 0
): void {
  ctx.save()

  // Translate to center, rotate, translate back
  ctx.translate(x + width / 2, y + height / 2)
  ctx.rotate((rotation * Math.PI) / 180)
  ctx.translate(-width / 2, -height / 2)

  ctx.strokeStyle = '#1a1a1a'
  ctx.fillStyle = '#1a1a1a'
  ctx.lineWidth = 2
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  const pad = Math.min(width, height) * 0.1
  const w = width - pad * 2
  const h = height - pad * 2

  switch (type) {
    case 'door':
      // Simple door arc
      ctx.beginPath()
      ctx.rect(pad, pad + h * 0.6, w, h * 0.4)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(pad, pad + h * 0.6, w * 0.9, 0, -Math.PI / 2, true)
      ctx.stroke()
      break

    case 'door-double':
      // Double door (two arcs)
      ctx.beginPath()
      ctx.rect(pad, pad + h * 0.6, w, h * 0.4)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(pad, pad + h * 0.6, w * 0.4, 0, -Math.PI / 2, true)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(pad + w, pad + h * 0.6, w * 0.4, Math.PI, Math.PI * 1.5)
      ctx.stroke()
      break

    case 'door-secret':
      // Secret door with S
      ctx.beginPath()
      ctx.rect(pad, pad + h * 0.3, w, h * 0.7)
      ctx.stroke()
      ctx.font = `bold ${Math.min(w, h) * 0.5}px serif`
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('S', pad + w / 2, pad + h * 0.65)
      break

    case 'door-locked':
      // Locked door with lock symbol
      ctx.beginPath()
      ctx.rect(pad, pad + h * 0.6, w, h * 0.4)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(pad, pad + h * 0.6, w * 0.9, 0, -Math.PI / 2, true)
      ctx.stroke()
      // Lock circle
      ctx.beginPath()
      ctx.arc(pad + w * 0.5, pad + h * 0.75, w * 0.15, 0, Math.PI * 2)
      ctx.fill()
      break

    case 'stairs-up': {
      // Stairs with up arrow
      const stepsUp = 4
      for (let i = 0; i < stepsUp; i++) {
        const stepY = pad + (h / stepsUp) * i
        const stepH = h / stepsUp
        ctx.beginPath()
        ctx.moveTo(pad, stepY + stepH)
        ctx.lineTo(pad + w, stepY + stepH)
        ctx.stroke()
      }
      // Arrow up
      ctx.beginPath()
      ctx.moveTo(pad + w / 2, pad + h * 0.2)
      ctx.lineTo(pad + w / 2 - w * 0.2, pad + h * 0.4)
      ctx.moveTo(pad + w / 2, pad + h * 0.2)
      ctx.lineTo(pad + w / 2 + w * 0.2, pad + h * 0.4)
      ctx.stroke()
      break
    }

    case 'stairs-down': {
      // Stairs with down arrow
      const stepsDown = 4
      for (let i = 0; i < stepsDown; i++) {
        const stepY = pad + (h / stepsDown) * i
        const stepH = h / stepsDown
        ctx.beginPath()
        ctx.moveTo(pad, stepY + stepH)
        ctx.lineTo(pad + w, stepY + stepH)
        ctx.stroke()
      }
      // Arrow down
      ctx.beginPath()
      ctx.moveTo(pad + w / 2, pad + h * 0.8)
      ctx.lineTo(pad + w / 2 - w * 0.2, pad + h * 0.6)
      ctx.moveTo(pad + w / 2, pad + h * 0.8)
      ctx.lineTo(pad + w / 2 + w * 0.2, pad + h * 0.6)
      ctx.stroke()
      break
    }

    case 'pillar':
      // Circle pillar
      ctx.beginPath()
      ctx.arc(pad + w / 2, pad + h / 2, Math.min(w, h) * 0.35, 0, Math.PI * 2)
      ctx.fill()
      break

    case 'statue':
      // Simple statue shape (figure on pedestal)
      ctx.beginPath()
      // Pedestal
      ctx.rect(pad + w * 0.2, pad + h * 0.7, w * 0.6, h * 0.25)
      ctx.fill()
      // Figure circle (head)
      ctx.beginPath()
      ctx.arc(pad + w / 2, pad + h * 0.3, w * 0.15, 0, Math.PI * 2)
      ctx.fill()
      // Body
      ctx.beginPath()
      ctx.moveTo(pad + w / 2, pad + h * 0.45)
      ctx.lineTo(pad + w / 2, pad + h * 0.7)
      ctx.stroke()
      break

    case 'altar':
      // Altar shape (table with cross or decoration)
      ctx.beginPath()
      ctx.rect(pad + w * 0.1, pad + h * 0.5, w * 0.8, h * 0.4)
      ctx.stroke()
      // Cross on top
      ctx.beginPath()
      ctx.moveTo(pad + w / 2, pad + h * 0.15)
      ctx.lineTo(pad + w / 2, pad + h * 0.45)
      ctx.moveTo(pad + w * 0.3, pad + h * 0.3)
      ctx.lineTo(pad + w * 0.7, pad + h * 0.3)
      ctx.stroke()
      break

    case 'fountain':
      // Concentric circles
      ctx.beginPath()
      ctx.arc(pad + w / 2, pad + h / 2, Math.min(w, h) * 0.4, 0, Math.PI * 2)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(pad + w / 2, pad + h / 2, Math.min(w, h) * 0.2, 0, Math.PI * 2)
      ctx.fill()
      break

    case 'chest':
      // Chest shape
      ctx.beginPath()
      ctx.rect(pad + w * 0.1, pad + h * 0.3, w * 0.8, h * 0.5)
      ctx.stroke()
      // Lid
      ctx.beginPath()
      ctx.moveTo(pad + w * 0.1, pad + h * 0.3)
      ctx.lineTo(pad + w * 0.1, pad + h * 0.2)
      ctx.lineTo(pad + w * 0.9, pad + h * 0.2)
      ctx.lineTo(pad + w * 0.9, pad + h * 0.3)
      ctx.stroke()
      // Lock
      ctx.beginPath()
      ctx.rect(pad + w * 0.4, pad + h * 0.45, w * 0.2, h * 0.15)
      ctx.fill()
      break

    case 'throne':
      // Throne shape
      ctx.beginPath()
      // Seat
      ctx.rect(pad + w * 0.15, pad + h * 0.5, w * 0.7, h * 0.35)
      ctx.stroke()
      // Back
      ctx.rect(pad + w * 0.2, pad + h * 0.1, w * 0.6, h * 0.4)
      ctx.stroke()
      break

    case 'trap':
      // Warning triangle
      ctx.beginPath()
      ctx.moveTo(pad + w / 2, pad + h * 0.15)
      ctx.lineTo(pad + w * 0.15, pad + h * 0.85)
      ctx.lineTo(pad + w * 0.85, pad + h * 0.85)
      ctx.closePath()
      ctx.stroke()
      // Exclamation
      ctx.beginPath()
      ctx.moveTo(pad + w / 2, pad + h * 0.35)
      ctx.lineTo(pad + w / 2, pad + h * 0.6)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(pad + w / 2, pad + h * 0.72, w * 0.05, 0, Math.PI * 2)
      ctx.fill()
      break

    case 'pit':
      // Dark circle (hole)
      ctx.beginPath()
      ctx.arc(pad + w / 2, pad + h / 2, Math.min(w, h) * 0.4, 0, Math.PI * 2)
      ctx.stroke()
      // Hatching for depth
      for (let i = 0; i < 3; i++) {
        const offset = (i - 1) * Math.min(w, h) * 0.15
        ctx.beginPath()
        ctx.moveTo(pad + w * 0.3 + offset, pad + h * 0.3)
        ctx.lineTo(pad + w * 0.7 + offset, pad + h * 0.7)
        ctx.stroke()
      }
      break

    case 'lever':
      // Lever on base
      ctx.beginPath()
      ctx.rect(pad + w * 0.3, pad + h * 0.7, w * 0.4, h * 0.2)
      ctx.fill()
      ctx.beginPath()
      ctx.moveTo(pad + w / 2, pad + h * 0.7)
      ctx.lineTo(pad + w * 0.7, pad + h * 0.25)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(pad + w * 0.7, pad + h * 0.25, w * 0.08, 0, Math.PI * 2)
      ctx.fill()
      break

    case 'fireplace':
      // Fireplace (arch with flames)
      ctx.beginPath()
      ctx.rect(pad, pad + h * 0.4, w, h * 0.6)
      ctx.stroke()
      ctx.beginPath()
      ctx.arc(pad + w / 2, pad + h * 0.4, w * 0.35, Math.PI, 0)
      ctx.stroke()
      // Simple flames
      ctx.beginPath()
      ctx.moveTo(pad + w * 0.3, pad + h * 0.7)
      ctx.lineTo(pad + w * 0.4, pad + h * 0.5)
      ctx.lineTo(pad + w * 0.5, pad + h * 0.7)
      ctx.lineTo(pad + w * 0.6, pad + h * 0.5)
      ctx.lineTo(pad + w * 0.7, pad + h * 0.7)
      ctx.stroke()
      break

    case 'table':
      // Table (rectangle with legs suggestion)
      ctx.beginPath()
      ctx.rect(pad + w * 0.1, pad + h * 0.1, w * 0.8, h * 0.8)
      ctx.stroke()
      // Inner rectangle
      ctx.beginPath()
      ctx.rect(pad + w * 0.2, pad + h * 0.2, w * 0.6, h * 0.6)
      ctx.stroke()
      break

    case 'bed':
      // Bed shape
      ctx.beginPath()
      ctx.rect(pad, pad + h * 0.1, w, h * 0.8)
      ctx.stroke()
      // Pillow area
      ctx.beginPath()
      ctx.rect(pad + w * 0.05, pad + h * 0.15, w * 0.9, h * 0.25)
      ctx.stroke()
      break
  }

  ctx.restore()
}

// Render a feature on the map
export function renderFeature(
  ctx: CanvasRenderingContext2D,
  feature: DungeonFeature,
  cellSize: number,
  selected: boolean = false
): void {
  const [w, h] = getFeatureDimensions(feature.type, feature.rotation)
  const x = feature.position.col * cellSize
  const y = feature.position.row * cellSize
  const width = w * cellSize
  const height = h * cellSize

  // Draw selection highlight
  if (selected) {
    ctx.save()
    ctx.strokeStyle = '#2563eb'
    ctx.lineWidth = 3
    ctx.setLineDash([5, 5])
    ctx.strokeRect(x - 2, y - 2, width + 4, height + 4)
    ctx.restore()
  }

  // Draw feature background (white) - inset by 1px to preserve grid lines
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(x + 1, y + 1, width - 2, height - 2)

  // Draw the feature icon
  renderFeatureIcon(ctx, feature.type, x, y, width, height, feature.rotation)
}

// Render a feature preview (semi-transparent, follows cursor)
export function renderFeaturePreview(
  ctx: CanvasRenderingContext2D,
  type: FeatureType,
  col: number,
  row: number,
  rotation: 0 | 90 | 180 | 270,
  cellSize: number,
  isValid: boolean
): void {
  const [w, h] = getFeatureDimensions(type, rotation)
  const x = col * cellSize
  const y = row * cellSize
  const width = w * cellSize
  const height = h * cellSize

  ctx.save()
  ctx.globalAlpha = 0.5

  // Red tint for invalid placement - inset by 1px to preserve grid lines
  if (!isValid) {
    ctx.fillStyle = 'rgba(220, 38, 38, 0.3)'
    ctx.fillRect(x + 1, y + 1, width - 2, height - 2)
  } else {
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(x + 1, y + 1, width - 2, height - 2)
  }

  renderFeatureIcon(ctx, type, x, y, width, height, rotation)

  ctx.restore()
}

// Get wall at screen position
export function getWallAtPosition(
  mapX: number,
  mapY: number,
  cellSize: number
): { col: number; row: number } {
  return {
    col: Math.floor(mapX / cellSize),
    row: Math.floor(mapY / cellSize),
  }
}
