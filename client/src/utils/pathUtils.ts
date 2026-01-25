import type { MapPath, MapPoint, PathType } from '@gygax/shared'

/**
 * Style configuration for each path type
 */
export interface PathStyle {
  color: string
  width: number
  dash: number[]
}

const PATH_STYLES: Record<PathType, PathStyle> = {
  road: {
    color: '#1a1a1a',
    width: 4,
    dash: [12, 6], // Long dashes - major routes
  },
  river: {
    color: '#808080', // Match water terrain grey
    width: 5,
    dash: [], // Solid - thickest line
  },
  stream: {
    color: '#808080', // Match water terrain grey
    width: 2.5,
    dash: [], // Solid - narrower than river
  },
  border: {
    color: '#1a1a1a',
    width: 1.5,
    dash: [2, 2], // Short dots - territory boundaries
  },
  trail: {
    color: '#1a1a1a',
    width: 2,
    dash: [6, 4], // Short dashes - minor paths
  },
}

/**
 * Get the style configuration for a path type
 */
export function getPathStyle(type: PathType): PathStyle {
  return PATH_STYLES[type]
}

/**
 * Generate points along a Catmull-Rom spline curve.
 * Returns an array of points that form a smooth curve through all input points.
 *
 * @param points - Array of control points the curve passes through
 * @param tension - Curve tension (0 = sharp, 0.5 = standard, 1 = loose)
 * @param segments - Number of line segments between each pair of points
 */
export function catmullRomSpline(
  points: MapPoint[],
  tension: number = 0.5,
  segments: number = 12
): MapPoint[] {
  if (points.length < 2) {
    return [...points]
  }

  if (points.length === 2) {
    return [...points]
  }

  const result: MapPoint[] = []

  // For each segment between control points
  for (let i = 0; i < points.length - 1; i++) {
    // Get 4 control points (mirror endpoints for smooth ends)
    const p0 = i === 0 ? { x: 2 * points[0].x - points[1].x, y: 2 * points[0].y - points[1].y } : points[i - 1]
    const p1 = points[i]
    const p2 = points[i + 1]
    const p3 = i + 2 < points.length
      ? points[i + 2]
      : { x: 2 * points[points.length - 1].x - points[points.length - 2].x,
          y: 2 * points[points.length - 1].y - points[points.length - 2].y }

    // Add the first point of the first segment
    if (i === 0) {
      result.push({ x: p1.x, y: p1.y })
    }

    // Generate intermediate points using Catmull-Rom formula
    for (let t = 1; t <= segments; t++) {
      const s = t / segments
      const s2 = s * s
      const s3 = s2 * s

      // Standard Catmull-Rom with tension parameter
      // tension = 0.5 gives standard Catmull-Rom
      const t0 = tension

      const x =
        p1.x +
        (-t0 * p0.x + t0 * p2.x) * s +
        (2 * t0 * p0.x + (t0 - 3) * p1.x + (3 - 2 * t0) * p2.x - t0 * p3.x) * s2 +
        (-t0 * p0.x + (2 - t0) * p1.x + (t0 - 2) * p2.x + t0 * p3.x) * s3

      const y =
        p1.y +
        (-t0 * p0.y + t0 * p2.y) * s +
        (2 * t0 * p0.y + (t0 - 3) * p1.y + (3 - 2 * t0) * p2.y - t0 * p3.y) * s2 +
        (-t0 * p0.y + (2 - t0) * p1.y + (t0 - 2) * p2.y + t0 * p3.y) * s3

      result.push({ x, y })
    }
  }

  return result
}

// Cache type for spline calculations
type SplineCache = Map<string, { points: string; spline: MapPoint[] }>

/**
 * Get cached spline or compute and cache it
 */
function getCachedSpline(
  path: MapPath,
  cache?: SplineCache
): MapPoint[] {
  // Borders don't use splines
  if (path.type === 'border') {
    return path.points
  }

  // If no cache, just compute
  if (!cache) {
    return catmullRomSpline(path.points)
  }

  // Create a key from points for cache invalidation
  const pointsKey = JSON.stringify(path.points)
  const cached = cache.get(path.id)

  if (cached && cached.points === pointsKey) {
    return cached.spline
  }

  // Compute and cache
  const spline = catmullRomSpline(path.points)
  cache.set(path.id, { points: pointsKey, spline })
  return spline
}

// Light blue color for water paths when color tint is enabled
const WATER_PATH_TINT_COLOR = '#a8c8f0'

/**
 * Render a path on the canvas
 */
export function renderPath(
  ctx: CanvasRenderingContext2D,
  path: MapPath,
  zoom: number,
  splineCache?: SplineCache,
  useColorTint: boolean = false
): void {
  if (path.points.length < 2) return

  const style = getPathStyle(path.type)

  // Get cached spline (or straight segments for borders)
  const drawPoints = getCachedSpline(path, splineCache)

  ctx.save()

  // Scale line width with zoom (but keep it visible)
  const scaledWidth = Math.max(style.width * Math.min(zoom, 1.5), 1)

  // Use blue tint for water paths (river/stream) when color mode is on
  const isWaterPath = path.type === 'river' || path.type === 'stream'
  ctx.strokeStyle = useColorTint && isWaterPath ? WATER_PATH_TINT_COLOR : style.color
  ctx.lineWidth = scaledWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  // Scale dash pattern with zoom
  if (style.dash.length > 0) {
    ctx.setLineDash(style.dash.map((d) => d * Math.min(zoom, 1.5)))
  } else {
    ctx.setLineDash([])
  }

  // Draw the path
  ctx.beginPath()
  ctx.moveTo(drawPoints[0].x, drawPoints[0].y)
  for (let i = 1; i < drawPoints.length; i++) {
    ctx.lineTo(drawPoints[i].x, drawPoints[i].y)
  }

  if (path.closed) {
    ctx.closePath()
  }

  ctx.stroke()

  ctx.restore()
}

/**
 * Render vertex handles for a selected path
 */
export function renderPathHandles(
  ctx: CanvasRenderingContext2D,
  path: MapPath,
  zoom: number
): void {
  const handleSize = 8 / zoom

  ctx.save()

  for (const point of path.points) {
    ctx.beginPath()
    ctx.arc(point.x, point.y, handleSize / 2, 0, Math.PI * 2)
    ctx.fillStyle = '#FFFFFF'
    ctx.fill()
    ctx.strokeStyle = '#1a1a1a'
    ctx.lineWidth = 2 / zoom
    ctx.stroke()
  }

  ctx.restore()
}

/**
 * Render a preview of a path being drawn
 */
export function renderPathPreview(
  ctx: CanvasRenderingContext2D,
  points: MapPoint[],
  pathType: PathType,
  zoom: number,
  cursorPoint?: MapPoint
): void {
  if (points.length === 0 && !cursorPoint) return

  const allPoints = cursorPoint ? [...points, cursorPoint] : points
  if (allPoints.length < 1) return

  const style = getPathStyle(pathType)

  ctx.save()

  const scaledWidth = Math.max(style.width * Math.min(zoom, 1.5), 1)

  ctx.strokeStyle = style.color
  ctx.lineWidth = scaledWidth
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  ctx.globalAlpha = 0.6

  if (style.dash.length > 0) {
    ctx.setLineDash(style.dash.map((d) => d * Math.min(zoom, 1.5)))
  } else {
    ctx.setLineDash([])
  }

  if (allPoints.length >= 2) {
    // Borders use straight line segments, other paths use smooth curves
    const drawPoints = pathType === 'border' ? allPoints : catmullRomSpline(allPoints)

    ctx.beginPath()
    ctx.moveTo(drawPoints[0].x, drawPoints[0].y)
    for (let i = 1; i < drawPoints.length; i++) {
      ctx.lineTo(drawPoints[i].x, drawPoints[i].y)
    }
    ctx.stroke()
  }

  // Draw vertex markers for existing points
  ctx.globalAlpha = 1
  ctx.fillStyle = '#FFFFFF'
  ctx.strokeStyle = '#1a1a1a'
  ctx.lineWidth = 2 / zoom
  const markerSize = 6 / zoom

  for (const point of points) {
    ctx.beginPath()
    ctx.arc(point.x, point.y, markerSize / 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.stroke()
  }

  ctx.restore()
}

/**
 * Render a snap point indicator
 */
export function renderSnapIndicator(
  ctx: CanvasRenderingContext2D,
  point: MapPoint,
  zoom: number
): void {
  const size = 6 / zoom

  ctx.save()

  ctx.beginPath()
  ctx.arc(point.x, point.y, size, 0, Math.PI * 2)
  ctx.fillStyle = '#FFFFFF'
  ctx.fill()
  ctx.strokeStyle = '#1a1a1a'
  ctx.lineWidth = 1.5 / zoom
  ctx.stroke()

  ctx.restore()
}

/**
 * Calculate the minimum distance from a point to a line segment
 */
function pointToSegmentDistance(point: MapPoint, a: MapPoint, b: MapPoint): number {
  const dx = b.x - a.x
  const dy = b.y - a.y
  const lengthSq = dx * dx + dy * dy

  if (lengthSq === 0) {
    return Math.hypot(point.x - a.x, point.y - a.y)
  }

  // Project point onto line, clamped to segment
  let t = ((point.x - a.x) * dx + (point.y - a.y) * dy) / lengthSq
  t = Math.max(0, Math.min(1, t))

  const projX = a.x + t * dx
  const projY = a.y + t * dy

  return Math.hypot(point.x - projX, point.y - projY)
}

/**
 * Check if a point is within hitDistance of any path segment.
 * Tests against the smoothed curve, not just the control points.
 */
export function hitTestPath(point: MapPoint, path: MapPath, hitDistance: number): boolean {
  if (path.points.length < 2) return false

  // Borders use straight line segments, other paths use smooth curves
  const testPoints = path.type === 'border' ? path.points : catmullRomSpline(path.points)

  for (let i = 0; i < testPoints.length - 1; i++) {
    const dist = pointToSegmentDistance(point, testPoints[i], testPoints[i + 1])
    if (dist <= hitDistance) {
      return true
    }
  }

  return false
}

/**
 * Check if a point is near a path vertex and return its index
 */
export function hitTestPathVertex(
  point: MapPoint,
  path: MapPath,
  hitDistance: number
): number | null {
  for (let i = 0; i < path.points.length; i++) {
    const dist = Math.hypot(point.x - path.points[i].x, point.y - path.points[i].y)
    if (dist <= hitDistance) {
      return i
    }
  }
  return null
}

/**
 * Get the bounding box of a path
 */
export function getPathBounds(path: MapPath): {
  minX: number
  minY: number
  maxX: number
  maxY: number
} {
  if (path.points.length === 0) {
    return { minX: 0, minY: 0, maxX: 0, maxY: 0 }
  }

  let minX = path.points[0].x
  let minY = path.points[0].y
  let maxX = path.points[0].x
  let maxY = path.points[0].y

  for (const point of path.points) {
    minX = Math.min(minX, point.x)
    minY = Math.min(minY, point.y)
    maxX = Math.max(maxX, point.x)
    maxY = Math.max(maxY, point.y)
  }

  return { minX, minY, maxX, maxY }
}
