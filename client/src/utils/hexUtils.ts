import type { HexCoord, Map, MapPoint } from '@gygax/shared'

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

/**
 * Get the center point of a hex as MapPoint
 */
export function getHexCenter(col: number, row: number, cellSize: number): MapPoint {
  const { x, y } = hexToPixel({ col, row }, cellSize)
  return { x, y }
}

/**
 * Get the 6 corner vertices of a flat-top hex at the given column/row
 * Corners are returned starting from the right corner, going counter-clockwise
 */
export function getHexCorners(col: number, row: number, cellSize: number): MapPoint[] {
  const center = hexToPixel({ col, row }, cellSize)
  const size = cellSize / 2
  const corners: MapPoint[] = []

  // Flat-top hex: corners at 0°, 60°, 120°, 180°, 240°, 300°
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i
    const angleRad = (Math.PI / 180) * angleDeg
    corners.push({
      x: center.x + size * Math.cos(angleRad),
      y: center.y + size * Math.sin(angleRad),
    })
  }

  return corners
}

/**
 * Get the 6 edge midpoints of a flat-top hex at the given column/row
 * Midpoints are returned starting from the top-right edge, going counter-clockwise
 */
export function getHexEdgeMidpoints(col: number, row: number, cellSize: number): MapPoint[] {
  const corners = getHexCorners(col, row, cellSize)
  const midpoints: MapPoint[] = []

  for (let i = 0; i < 6; i++) {
    const next = (i + 1) % 6
    midpoints.push({
      x: (corners[i].x + corners[next].x) / 2,
      y: (corners[i].y + corners[next].y) / 2,
    })
  }

  return midpoints
}

/**
 * Find the nearest snap point (center, corner, or edge midpoint) to a given position.
 * Searches hexes near the given position.
 * Returns the snap point and its distance, or null if no snap point within threshold.
 */
export function findNearestSnapPoint(
  position: MapPoint,
  cellSize: number,
  mapWidth: number,
  mapHeight: number,
  snapThreshold: number
): { point: MapPoint; distance: number } | null {
  // Find the hex at the current position
  const centerHex = pixelToHex(position.x, position.y, cellSize)

  // Collect all snap points from center hex and its 6 neighbors
  const hexesToCheck: HexCoord[] = [
    centerHex,
    { col: centerHex.col - 1, row: centerHex.row },
    { col: centerHex.col + 1, row: centerHex.row },
    { col: centerHex.col, row: centerHex.row - 1 },
    { col: centerHex.col, row: centerHex.row + 1 },
    // For odd-q offset, diagonal neighbors depend on column parity
    { col: centerHex.col - 1, row: centerHex.row + (centerHex.col % 2 === 0 ? -1 : 1) },
    { col: centerHex.col + 1, row: centerHex.row + (centerHex.col % 2 === 0 ? -1 : 1) },
  ]

  let nearestPoint: MapPoint | null = null
  let nearestDistance = Infinity

  for (const hex of hexesToCheck) {
    // Skip out-of-bounds hexes
    if (hex.col < 0 || hex.col >= mapWidth || hex.row < 0 || hex.row >= mapHeight) {
      continue
    }

    // Check hex center
    const center = getHexCenter(hex.col, hex.row, cellSize)
    const centerDist = Math.hypot(position.x - center.x, position.y - center.y)
    if (centerDist < nearestDistance) {
      nearestDistance = centerDist
      nearestPoint = center
    }

    // Check corners
    const corners = getHexCorners(hex.col, hex.row, cellSize)
    for (const corner of corners) {
      const dist = Math.hypot(position.x - corner.x, position.y - corner.y)
      if (dist < nearestDistance) {
        nearestDistance = dist
        nearestPoint = corner
      }
    }

    // Check edge midpoints
    const midpoints = getHexEdgeMidpoints(hex.col, hex.row, cellSize)
    for (const midpoint of midpoints) {
      const dist = Math.hypot(position.x - midpoint.x, position.y - midpoint.y)
      if (dist < nearestDistance) {
        nearestDistance = dist
        nearestPoint = midpoint
      }
    }
  }

  if (nearestPoint && nearestDistance <= snapThreshold) {
    return { point: nearestPoint, distance: nearestDistance }
  }

  return null
}
