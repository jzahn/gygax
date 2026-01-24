import type { HexCoord, Map } from '@gygax/shared'

/**
 * Convert hex coordinates to pixel position (center of hex)
 * Uses flat-top hexagon orientation with odd-q offset
 */
export function hexToPixel(hex: HexCoord, cellSize: number): { x: number; y: number } {
  const size = cellSize / 2
  const hexHeight = Math.sqrt(3) * size
  const horizSpacing = size * 1.5

  const x = size + hex.col * horizSpacing
  const y = hexHeight / 2 + hex.row * hexHeight + (hex.col % 2 === 1 ? hexHeight / 2 : 0)

  return { x, y }
}

/**
 * Convert pixel position to hex coordinates
 * Uses flat-top hexagon orientation with odd-q offset
 */
export function pixelToHex(px: number, py: number, cellSize: number): HexCoord {
  const size = cellSize / 2
  const hexHeight = Math.sqrt(3) * size
  const horizSpacing = size * 1.5

  // Estimate column first
  const col = Math.round((px - size) / horizSpacing)

  // Adjust y for odd-q offset
  const adjustedY = py - (col % 2 === 1 ? hexHeight / 2 : 0)
  const row = Math.round((adjustedY - hexHeight / 2) / hexHeight)

  // We have an estimate, but we need to check nearby hexes due to hex geometry
  // Check the estimated hex and its neighbors to find the closest
  const candidates: HexCoord[] = [
    { col, row },
    { col, row: row - 1 },
    { col, row: row + 1 },
    { col: col - 1, row },
    { col: col + 1, row },
  ]

  let closest = candidates[0]
  let minDist = Infinity

  for (const candidate of candidates) {
    const center = hexToPixel(candidate, cellSize)
    const dist = Math.hypot(px - center.x, py - center.y)
    if (dist < minDist) {
      minDist = dist
      closest = candidate
    }
  }

  return closest
}

/**
 * Check if hex coordinates are within map bounds
 */
export function isHexInBounds(hex: HexCoord, map: Map): boolean {
  return hex.col >= 0 && hex.col < map.width && hex.row >= 0 && hex.row < map.height
}

/**
 * Convert hex coordinates to a string key
 */
export function hexKey(hex: HexCoord): string {
  return `${hex.col},${hex.row}`
}

/**
 * Parse a string key back to hex coordinates
 */
export function parseHexKey(key: string): HexCoord {
  const [col, row] = key.split(',').map(Number)
  return { col, row }
}
