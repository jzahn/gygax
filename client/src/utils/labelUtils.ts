import type { MapLabel, MapPoint, TextSize } from '@gygax/shared'

// Font family for B/X aesthetic
const LABEL_FONT_FAMILY = '"IM Fell English", "Times New Roman", serif'

// Font sizes in pixels at 100% zoom
const FONT_SIZES: Record<TextSize, number> = {
  small: 12,
  medium: 16,
  large: 24,
  xlarge: 32,
}

/**
 * Get the font size in pixels for a label size
 */
export function getLabelFontSize(size: TextSize): number {
  return FONT_SIZES[size]
}

/**
 * Get the CSS font string for a label
 */
export function getLabelFont(size: TextSize): string {
  const fontSize = getLabelFontSize(size)
  return `${fontSize}px ${LABEL_FONT_FAMILY}`
}

/**
 * Render a label with white outline on the canvas
 * Note: Canvas is already scaled by zoom, so we use base font sizes
 * Supports multi-line labels (lines separated by \n)
 */
export function renderLabel(
  ctx: CanvasRenderingContext2D,
  label: MapLabel,
  zoom: number,
  isSelected: boolean
): void {
  const fontSize = getLabelFontSize(label.size)
  const lineHeight = fontSize * 1.2
  const lines = label.text.split('\n')

  ctx.save()

  ctx.font = `${fontSize}px ${LABEL_FONT_FAMILY}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // Calculate vertical offset to center all lines
  const totalHeight = lines.length * lineHeight
  const startY = label.position.y - totalHeight / 2 + lineHeight / 2

  // White outline using strokeText for clean, thick border
  ctx.strokeStyle = '#FFFFFF'
  ctx.lineWidth = Math.max(3, fontSize * 0.25)
  ctx.lineJoin = 'round'
  ctx.miterLimit = 2

  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * lineHeight
    ctx.strokeText(lines[i], label.position.x, y)
  }

  // Black fill
  ctx.fillStyle = '#1a1a1a'
  for (let i = 0; i < lines.length; i++) {
    const y = startY + i * lineHeight
    ctx.fillText(lines[i], label.position.x, y)
  }

  // Selection indicator
  if (isSelected) {
    const bounds = getLabelBounds(label, ctx)
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 1 / zoom
    ctx.setLineDash([4 / zoom, 4 / zoom])
    ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height)
    ctx.setLineDash([])
  }

  ctx.restore()
}

/**
 * Render a preview label (during placement)
 * Note: Canvas is already scaled by zoom, so we use base font sizes
 */
export function renderLabelPreview(
  ctx: CanvasRenderingContext2D,
  position: MapPoint,
  size: TextSize
): void {
  const fontSize = getLabelFontSize(size)

  ctx.save()

  ctx.font = `${fontSize}px ${LABEL_FONT_FAMILY}`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.globalAlpha = 0.5

  // Preview text
  ctx.fillStyle = '#1a1a1a'
  ctx.fillText('Label', position.x, position.y)

  ctx.restore()
}

/**
 * Get the bounding box of a label in map coordinates
 * Note: Uses base font sizes since canvas handles zoom scaling
 * Supports multi-line labels (lines separated by \n)
 */
export function getLabelBounds(
  label: MapLabel,
  ctx: CanvasRenderingContext2D
): {
  x: number
  y: number
  width: number
  height: number
} {
  const fontSize = getLabelFontSize(label.size)
  const lineHeight = fontSize * 1.2
  const lines = label.text.split('\n')

  ctx.save()
  ctx.font = `${fontSize}px ${LABEL_FONT_FAMILY}`

  // Find the widest line
  let maxWidth = 0
  for (const line of lines) {
    const metrics = ctx.measureText(line)
    maxWidth = Math.max(maxWidth, metrics.width)
  }

  const totalHeight = lines.length * lineHeight

  ctx.restore()

  // Add padding around the text
  const padding = fontSize * 0.2

  return {
    x: label.position.x - maxWidth / 2 - padding,
    y: label.position.y - totalHeight / 2 - padding,
    width: maxWidth + padding * 2,
    height: totalHeight + padding * 2,
  }
}

/**
 * Check if a point is within the label's bounding box
 */
export function hitTestLabel(
  point: MapPoint,
  label: MapLabel,
  ctx: CanvasRenderingContext2D
): boolean {
  const bounds = getLabelBounds(label, ctx)

  return (
    point.x >= bounds.x &&
    point.x <= bounds.x + bounds.width &&
    point.y >= bounds.y &&
    point.y <= bounds.y + bounds.height
  )
}
