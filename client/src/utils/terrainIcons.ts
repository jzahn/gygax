import type { TerrainType, NaturalTerrain, SettlementTerrain } from '@gygax/shared'

export const NATURAL_TERRAIN_TYPES: NaturalTerrain[] = [
  'clear',
  'grasslands',
  'forest',
  'jungle',
  'hills',
  'mountains',
  'desert',
  'swamp',
  'water',
  'volcano',
  'barren',
]

export const SETTLEMENT_TERRAIN_TYPES: SettlementTerrain[] = [
  'castle',
  'ruins',
  'capitol',
  'city',
  'town',
  'caves',
]

export const TERRAIN_INFO: Record<TerrainType, { name: string; group: 'natural' | 'settlement' }> = {
  clear: { name: 'Clear', group: 'natural' },
  grasslands: { name: 'Grasslands', group: 'natural' },
  forest: { name: 'Forest', group: 'natural' },
  jungle: { name: 'Jungle', group: 'natural' },
  hills: { name: 'Hills', group: 'natural' },
  mountains: { name: 'Mountains', group: 'natural' },
  desert: { name: 'Desert', group: 'natural' },
  swamp: { name: 'Swamp', group: 'natural' },
  water: { name: 'Water', group: 'natural' },
  volcano: { name: 'Volcano', group: 'natural' },
  barren: { name: 'Barren', group: 'natural' },
  castle: { name: 'Castle', group: 'settlement' },
  ruins: { name: 'Ruins', group: 'settlement' },
  capitol: { name: 'Capitol', group: 'settlement' },
  city: { name: 'City', group: 'settlement' },
  town: { name: 'Town', group: 'settlement' },
  caves: { name: 'Caves', group: 'settlement' },
}

// Grasslands: Short vertical grass tufts in groups
function drawGrasslands(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  ctx.beginPath()
  // Left tuft
  const tuftWidth = scale * 0.08
  const tuftHeight = scale * 0.25
  const baseY = cy + scale * 0.15

  // Left group
  ctx.moveTo(cx - scale * 0.25 - tuftWidth, baseY)
  ctx.lineTo(cx - scale * 0.25, baseY - tuftHeight)
  ctx.moveTo(cx - scale * 0.25, baseY)
  ctx.lineTo(cx - scale * 0.25 + tuftWidth * 0.5, baseY - tuftHeight * 0.9)
  ctx.moveTo(cx - scale * 0.25 + tuftWidth, baseY)
  ctx.lineTo(cx - scale * 0.25 + tuftWidth * 1.5, baseY - tuftHeight * 0.8)

  // Center group
  ctx.moveTo(cx - tuftWidth, baseY + scale * 0.05)
  ctx.lineTo(cx - tuftWidth * 0.5, baseY - tuftHeight * 1.1)
  ctx.moveTo(cx, baseY + scale * 0.05)
  ctx.lineTo(cx, baseY - tuftHeight)
  ctx.moveTo(cx + tuftWidth, baseY + scale * 0.05)
  ctx.lineTo(cx + tuftWidth * 0.5, baseY - tuftHeight * 0.95)

  // Right group
  ctx.moveTo(cx + scale * 0.2, baseY)
  ctx.lineTo(cx + scale * 0.2 + tuftWidth * 0.5, baseY - tuftHeight * 0.85)
  ctx.moveTo(cx + scale * 0.25, baseY)
  ctx.lineTo(cx + scale * 0.25, baseY - tuftHeight * 0.9)
  ctx.moveTo(cx + scale * 0.3, baseY)
  ctx.lineTo(cx + scale * 0.28, baseY - tuftHeight * 0.75)

  ctx.stroke()
}

// Forest: Cloud-like deciduous tree shapes (3 grouped)
function drawForest(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  // Draw cloud-like tree canopy shapes
  function drawTreeCanopy(x: number, y: number, size: number) {
    ctx.beginPath()
    // Bumpy cloud shape for tree canopy
    ctx.moveTo(x - size * 0.8, y + size * 0.3)
    ctx.quadraticCurveTo(x - size, y - size * 0.2, x - size * 0.5, y - size * 0.5)
    ctx.quadraticCurveTo(x - size * 0.2, y - size * 0.8, x + size * 0.2, y - size * 0.5)
    ctx.quadraticCurveTo(x + size * 0.6, y - size * 0.7, x + size * 0.8, y - size * 0.3)
    ctx.quadraticCurveTo(x + size, y + size * 0.1, x + size * 0.6, y + size * 0.4)
    ctx.quadraticCurveTo(x, y + size * 0.5, x - size * 0.8, y + size * 0.3)
    ctx.stroke()
  }

  // Three trees in triangular arrangement
  drawTreeCanopy(cx - scale * 0.22, cy + scale * 0.12, scale * 0.22)
  drawTreeCanopy(cx + scale * 0.22, cy + scale * 0.12, scale * 0.22)
  drawTreeCanopy(cx, cy - scale * 0.15, scale * 0.25)
}

// Jungle: Ring of palm tree silhouettes
function drawJungle(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  const palmCount = 6
  const radius = scale * 0.32

  for (let i = 0; i < palmCount; i++) {
    const angle = (i / palmCount) * Math.PI * 2 - Math.PI / 2
    const px = cx + Math.cos(angle) * radius
    const py = cy + Math.sin(angle) * radius

    // Palm tree: trunk and fronds pointing outward
    ctx.beginPath()
    // Short trunk
    ctx.moveTo(px, py)
    const trunkAngle = angle + Math.PI // Point toward center
    const trunkLen = scale * 0.08
    const trunkEndX = px + Math.cos(trunkAngle) * trunkLen
    const trunkEndY = py + Math.sin(trunkAngle) * trunkLen
    ctx.lineTo(trunkEndX, trunkEndY)
    ctx.stroke()

    // Fronds (3-4 radiating outward from trunk end)
    const frondLen = scale * 0.15
    for (let f = -1; f <= 1; f++) {
      const frondAngle = angle + f * 0.5
      ctx.beginPath()
      ctx.moveTo(px, py)
      ctx.lineTo(px + Math.cos(frondAngle) * frondLen, py + Math.sin(frondAngle) * frondLen)
      ctx.stroke()
    }
  }
}

// Hills: Curved "seagull" or bird-wing shapes
function drawHills(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  ctx.beginPath()

  // Draw hill shape (curved hump)
  function drawHill(x: number, y: number, width: number) {
    ctx.moveTo(x - width, y)
    ctx.quadraticCurveTo(x - width * 0.3, y - width * 0.6, x, y - width * 0.15)
    ctx.quadraticCurveTo(x + width * 0.3, y - width * 0.6, x + width, y)
  }

  // Multiple hills at different positions
  drawHill(cx - scale * 0.15, cy + scale * 0.2, scale * 0.25)
  drawHill(cx + scale * 0.2, cy + scale * 0.15, scale * 0.2)
  drawHill(cx - scale * 0.05, cy - scale * 0.05, scale * 0.22)
  drawHill(cx + scale * 0.25, cy - scale * 0.1, scale * 0.15)

  ctx.stroke()
}

// Mountains: Triangular peaks with one side filled (shaded)
function drawMountains(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  // Large center mountain
  ctx.beginPath()
  ctx.moveTo(cx - scale * 0.35, cy + scale * 0.3)
  ctx.lineTo(cx, cy - scale * 0.35)
  ctx.lineTo(cx + scale * 0.35, cy + scale * 0.3)
  ctx.stroke()

  // Fill right side of center mountain
  ctx.beginPath()
  ctx.moveTo(cx, cy - scale * 0.35)
  ctx.lineTo(cx + scale * 0.35, cy + scale * 0.3)
  ctx.lineTo(cx, cy + scale * 0.3)
  ctx.closePath()
  ctx.fill()

  // Small left mountain
  ctx.beginPath()
  ctx.moveTo(cx - scale * 0.45, cy + scale * 0.3)
  ctx.lineTo(cx - scale * 0.25, cy)
  ctx.lineTo(cx - scale * 0.05, cy + scale * 0.3)
  ctx.stroke()

  // Fill right side
  ctx.beginPath()
  ctx.moveTo(cx - scale * 0.25, cy)
  ctx.lineTo(cx - scale * 0.05, cy + scale * 0.3)
  ctx.lineTo(cx - scale * 0.25, cy + scale * 0.3)
  ctx.closePath()
  ctx.fill()

  // Small right mountain
  ctx.beginPath()
  ctx.moveTo(cx + scale * 0.15, cy + scale * 0.3)
  ctx.lineTo(cx + scale * 0.32, cy + scale * 0.05)
  ctx.lineTo(cx + scale * 0.5, cy + scale * 0.3)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(cx + scale * 0.32, cy + scale * 0.05)
  ctx.lineTo(cx + scale * 0.5, cy + scale * 0.3)
  ctx.lineTo(cx + scale * 0.32, cy + scale * 0.3)
  ctx.closePath()
  ctx.fill()
}

// Desert: Scattered dots
function drawDesert(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  const dots = [
    { x: -0.25, y: -0.2 },
    { x: 0.1, y: -0.25 },
    { x: 0.3, y: -0.1 },
    { x: -0.15, y: 0 },
    { x: 0.15, y: 0.05 },
    { x: -0.3, y: 0.15 },
    { x: 0, y: 0.2 },
    { x: 0.25, y: 0.22 },
    { x: -0.1, y: -0.12 },
  ]
  ctx.beginPath()
  for (const dot of dots) {
    ctx.moveTo(cx + dot.x * scale + 1.5, cy + dot.y * scale)
    ctx.arc(cx + dot.x * scale, cy + dot.y * scale, 1.5, 0, Math.PI * 2)
  }
  ctx.fill()
}

// Swamp: Vertical cattail/reed tufts with water lines at base
function drawSwamp(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  const baseY = cy + scale * 0.25

  // Cattails - vertical lines with oval tops
  const cattails = [
    { x: -0.2, h: 0.5 },
    { x: -0.05, h: 0.6 },
    { x: 0.1, h: 0.45 },
    { x: 0.22, h: 0.55 },
  ]

  for (const c of cattails) {
    const rx = cx + c.x * scale
    // Stem
    ctx.beginPath()
    ctx.moveTo(rx, baseY)
    ctx.lineTo(rx, baseY - c.h * scale)
    ctx.stroke()

    // Cattail head (filled oval)
    ctx.beginPath()
    ctx.ellipse(rx, baseY - c.h * scale - scale * 0.06, scale * 0.025, scale * 0.07, 0, 0, Math.PI * 2)
    ctx.fill()
  }

  // Water lines at base
  ctx.beginPath()
  ctx.moveTo(cx - scale * 0.35, baseY + scale * 0.05)
  ctx.lineTo(cx - scale * 0.15, baseY + scale * 0.05)
  ctx.moveTo(cx - scale * 0.05, baseY + scale * 0.08)
  ctx.lineTo(cx + scale * 0.15, baseY + scale * 0.08)
  ctx.moveTo(cx + scale * 0.2, baseY + scale * 0.05)
  ctx.lineTo(cx + scale * 0.35, baseY + scale * 0.05)
  ctx.stroke()
}

// Water: Dense stippled dot pattern
function drawWater(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  // Create a denser dot pattern
  const spacing = scale * 0.12
  const rows = 5
  const cols = 6

  ctx.beginPath()
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const x = cx + (col - cols / 2 + 0.5) * spacing + (row % 2) * spacing * 0.5
      const y = cy + (row - rows / 2 + 0.5) * spacing
      // Only draw if within hex bounds (roughly)
      const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2)
      if (dist < scale * 0.4) {
        ctx.moveTo(x + 1, y)
        ctx.arc(x, y, 1, 0, Math.PI * 2)
      }
    }
  }
  ctx.fill()
}

// Volcano: Mountain with eruption/lava flow (filled black)
function drawVolcano(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  // Mountain outline
  ctx.beginPath()
  ctx.moveTo(cx - scale * 0.4, cy + scale * 0.35)
  ctx.lineTo(cx - scale * 0.08, cy - scale * 0.2)
  ctx.lineTo(cx + scale * 0.08, cy - scale * 0.2)
  ctx.lineTo(cx + scale * 0.4, cy + scale * 0.35)
  ctx.stroke()

  // Crater opening
  ctx.beginPath()
  ctx.moveTo(cx - scale * 0.08, cy - scale * 0.2)
  ctx.lineTo(cx - scale * 0.03, cy - scale * 0.1)
  ctx.lineTo(cx + scale * 0.03, cy - scale * 0.1)
  ctx.lineTo(cx + scale * 0.08, cy - scale * 0.2)
  ctx.stroke()

  // Eruption cloud (filled)
  ctx.beginPath()
  ctx.arc(cx, cy - scale * 0.35, scale * 0.12, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx - scale * 0.08, cy - scale * 0.45, scale * 0.08, 0, Math.PI * 2)
  ctx.fill()
  ctx.beginPath()
  ctx.arc(cx + scale * 0.1, cy - scale * 0.48, scale * 0.06, 0, Math.PI * 2)
  ctx.fill()

  // Lava flow (filled shape down the side)
  ctx.beginPath()
  ctx.moveTo(cx, cy - scale * 0.1)
  ctx.lineTo(cx - scale * 0.08, cy + scale * 0.2)
  ctx.lineTo(cx + scale * 0.05, cy + scale * 0.15)
  ctx.lineTo(cx + scale * 0.12, cy + scale * 0.3)
  ctx.lineTo(cx + scale * 0.18, cy + scale * 0.25)
  ctx.lineTo(cx + scale * 0.08, cy + scale * 0.05)
  ctx.closePath()
  ctx.fill()
}

// Barren: Small zigzag "M" shapes scattered
function drawBarren(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  // Draw small M/zigzag shapes
  function drawZigzag(x: number, y: number, size: number) {
    ctx.beginPath()
    ctx.moveTo(x - size, y)
    ctx.lineTo(x - size * 0.5, y - size * 0.8)
    ctx.lineTo(x, y - size * 0.2)
    ctx.lineTo(x + size * 0.5, y - size * 0.8)
    ctx.lineTo(x + size, y)
    ctx.stroke()
  }

  drawZigzag(cx - scale * 0.2, cy - scale * 0.15, scale * 0.12)
  drawZigzag(cx + scale * 0.15, cy - scale * 0.1, scale * 0.1)
  drawZigzag(cx - scale * 0.1, cy + scale * 0.15, scale * 0.14)
  drawZigzag(cx + scale * 0.2, cy + scale * 0.2, scale * 0.11)
  drawZigzag(cx + scale * 0.05, cy + scale * 0.05, scale * 0.08)
}

// Castle: Black silhouette with two towers and crenellated wall
function drawCastle(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  ctx.beginPath()

  const baseY = cy + scale * 0.3
  const wallTop = cy - scale * 0.05
  const towerTop = cy - scale * 0.3

  // Left tower
  ctx.moveTo(cx - scale * 0.35, baseY)
  ctx.lineTo(cx - scale * 0.35, towerTop)
  ctx.lineTo(cx - scale * 0.38, towerTop)
  ctx.lineTo(cx - scale * 0.38, towerTop - scale * 0.08)
  ctx.lineTo(cx - scale * 0.32, towerTop - scale * 0.08)
  ctx.lineTo(cx - scale * 0.32, towerTop)
  ctx.lineTo(cx - scale * 0.26, towerTop)
  ctx.lineTo(cx - scale * 0.26, towerTop - scale * 0.08)
  ctx.lineTo(cx - scale * 0.2, towerTop - scale * 0.08)
  ctx.lineTo(cx - scale * 0.2, towerTop)
  ctx.lineTo(cx - scale * 0.18, towerTop)

  // Wall with crenellations
  ctx.lineTo(cx - scale * 0.18, wallTop)
  ctx.lineTo(cx - scale * 0.12, wallTop - scale * 0.08)
  ctx.lineTo(cx - scale * 0.12, wallTop)
  ctx.lineTo(cx - scale * 0.04, wallTop)
  ctx.lineTo(cx - scale * 0.04, wallTop - scale * 0.08)
  ctx.lineTo(cx + scale * 0.04, wallTop - scale * 0.08)
  ctx.lineTo(cx + scale * 0.04, wallTop)
  ctx.lineTo(cx + scale * 0.12, wallTop)
  ctx.lineTo(cx + scale * 0.12, wallTop - scale * 0.08)
  ctx.lineTo(cx + scale * 0.18, wallTop)

  // Right tower
  ctx.lineTo(cx + scale * 0.18, towerTop)
  ctx.lineTo(cx + scale * 0.2, towerTop)
  ctx.lineTo(cx + scale * 0.2, towerTop - scale * 0.08)
  ctx.lineTo(cx + scale * 0.26, towerTop - scale * 0.08)
  ctx.lineTo(cx + scale * 0.26, towerTop)
  ctx.lineTo(cx + scale * 0.32, towerTop)
  ctx.lineTo(cx + scale * 0.32, towerTop - scale * 0.08)
  ctx.lineTo(cx + scale * 0.38, towerTop - scale * 0.08)
  ctx.lineTo(cx + scale * 0.38, towerTop)
  ctx.lineTo(cx + scale * 0.35, towerTop)
  ctx.lineTo(cx + scale * 0.35, baseY)

  ctx.closePath()
  ctx.fill()
}

// Ruins: Broken castle silhouette with gaps
function drawRuins(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  const baseY = cy + scale * 0.3

  // Left broken tower
  ctx.beginPath()
  ctx.moveTo(cx - scale * 0.35, baseY)
  ctx.lineTo(cx - scale * 0.35, cy - scale * 0.15)
  ctx.lineTo(cx - scale * 0.32, cy - scale * 0.2)
  ctx.lineTo(cx - scale * 0.28, cy - scale * 0.12)
  ctx.lineTo(cx - scale * 0.22, cy - scale * 0.25)
  ctx.lineTo(cx - scale * 0.18, cy - scale * 0.1)
  ctx.lineTo(cx - scale * 0.18, baseY)
  ctx.closePath()
  ctx.fill()

  // Right broken section
  ctx.beginPath()
  ctx.moveTo(cx + scale * 0.1, baseY)
  ctx.lineTo(cx + scale * 0.1, cy)
  ctx.lineTo(cx + scale * 0.15, cy - scale * 0.15)
  ctx.lineTo(cx + scale * 0.22, cy - scale * 0.05)
  ctx.lineTo(cx + scale * 0.28, cy - scale * 0.2)
  ctx.lineTo(cx + scale * 0.35, cy - scale * 0.08)
  ctx.lineTo(cx + scale * 0.35, baseY)
  ctx.closePath()
  ctx.fill()
}

// Capitol: Large city silhouette with star marker
function drawCapitol(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  const baseY = cy + scale * 0.3

  // City silhouette (multiple spires)
  ctx.beginPath()
  ctx.moveTo(cx - scale * 0.4, baseY)
  ctx.lineTo(cx - scale * 0.4, cy + scale * 0.1)
  ctx.lineTo(cx - scale * 0.32, cy + scale * 0.1)
  ctx.lineTo(cx - scale * 0.32, cy - scale * 0.1)
  ctx.lineTo(cx - scale * 0.28, cy - scale * 0.1)
  ctx.lineTo(cx - scale * 0.28, cy - scale * 0.25)
  ctx.lineTo(cx - scale * 0.24, cy - scale * 0.25)
  ctx.lineTo(cx - scale * 0.24, cy)
  ctx.lineTo(cx - scale * 0.15, cy)
  ctx.lineTo(cx - scale * 0.15, cy - scale * 0.35)
  ctx.lineTo(cx - scale * 0.1, cy - scale * 0.35)
  ctx.lineTo(cx - scale * 0.1, cy - scale * 0.15)
  ctx.lineTo(cx - scale * 0.02, cy - scale * 0.15)
  ctx.lineTo(cx - scale * 0.02, cy - scale * 0.3)
  ctx.lineTo(cx + scale * 0.05, cy - scale * 0.3)
  ctx.lineTo(cx + scale * 0.05, cy - scale * 0.05)
  ctx.lineTo(cx + scale * 0.15, cy - scale * 0.05)
  ctx.lineTo(cx + scale * 0.15, cy - scale * 0.2)
  ctx.lineTo(cx + scale * 0.22, cy - scale * 0.2)
  ctx.lineTo(cx + scale * 0.22, cy + scale * 0.05)
  ctx.lineTo(cx + scale * 0.3, cy + scale * 0.05)
  ctx.lineTo(cx + scale * 0.3, baseY)
  ctx.closePath()
  ctx.fill()

  // Star marker (to the right)
  drawStar(ctx, cx + scale * 0.45, cy, scale * 0.08)
}

// City: Medium city silhouette with circle marker
function drawCity(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  const baseY = cy + scale * 0.3

  ctx.beginPath()
  ctx.moveTo(cx - scale * 0.32, baseY)
  ctx.lineTo(cx - scale * 0.32, cy + scale * 0.1)
  ctx.lineTo(cx - scale * 0.22, cy + scale * 0.1)
  ctx.lineTo(cx - scale * 0.22, cy - scale * 0.1)
  ctx.lineTo(cx - scale * 0.15, cy - scale * 0.1)
  ctx.lineTo(cx - scale * 0.15, cy - scale * 0.25)
  ctx.lineTo(cx - scale * 0.08, cy - scale * 0.25)
  ctx.lineTo(cx - scale * 0.08, cy - scale * 0.05)
  ctx.lineTo(cx + scale * 0.05, cy - scale * 0.05)
  ctx.lineTo(cx + scale * 0.05, cy - scale * 0.18)
  ctx.lineTo(cx + scale * 0.12, cy - scale * 0.18)
  ctx.lineTo(cx + scale * 0.12, cy + scale * 0.05)
  ctx.lineTo(cx + scale * 0.22, cy + scale * 0.05)
  ctx.lineTo(cx + scale * 0.22, baseY)
  ctx.closePath()
  ctx.fill()

  // Circle marker
  ctx.beginPath()
  ctx.arc(cx + scale * 0.38, cy, scale * 0.07, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx + scale * 0.38, cy, scale * 0.025, 0, Math.PI * 2)
  ctx.fill()
}

// Town: Small city silhouette with circle marker
function drawTown(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  const baseY = cy + scale * 0.3

  ctx.beginPath()
  ctx.moveTo(cx - scale * 0.25, baseY)
  ctx.lineTo(cx - scale * 0.25, cy + scale * 0.1)
  ctx.lineTo(cx - scale * 0.15, cy + scale * 0.1)
  ctx.lineTo(cx - scale * 0.15, cy - scale * 0.05)
  ctx.lineTo(cx - scale * 0.08, cy - scale * 0.05)
  ctx.lineTo(cx - scale * 0.08, cy - scale * 0.18)
  ctx.lineTo(cx, cy - scale * 0.18)
  ctx.lineTo(cx, cy + scale * 0.05)
  ctx.lineTo(cx + scale * 0.1, cy + scale * 0.05)
  ctx.lineTo(cx + scale * 0.1, baseY)
  ctx.closePath()
  ctx.fill()

  // Circle marker
  ctx.beginPath()
  ctx.arc(cx + scale * 0.28, cy, scale * 0.06, 0, Math.PI * 2)
  ctx.stroke()
  ctx.beginPath()
  ctx.arc(cx + scale * 0.28, cy, scale * 0.02, 0, Math.PI * 2)
  ctx.fill()
}

// Caves: Eye-shaped opening with concentric arcs inside
function drawCaves(ctx: CanvasRenderingContext2D, cx: number, cy: number, scale: number) {
  // Outer eye shape
  ctx.beginPath()
  ctx.moveTo(cx - scale * 0.4, cy)
  ctx.quadraticCurveTo(cx, cy - scale * 0.35, cx + scale * 0.4, cy)
  ctx.quadraticCurveTo(cx, cy + scale * 0.35, cx - scale * 0.4, cy)
  ctx.stroke()

  // Inner arcs (concentric, showing depth)
  ctx.beginPath()
  ctx.moveTo(cx - scale * 0.25, cy)
  ctx.quadraticCurveTo(cx, cy - scale * 0.2, cx + scale * 0.25, cy)
  ctx.quadraticCurveTo(cx, cy + scale * 0.2, cx - scale * 0.25, cy)
  ctx.stroke()

  // Innermost dark area
  ctx.beginPath()
  ctx.moveTo(cx - scale * 0.12, cy)
  ctx.quadraticCurveTo(cx, cy - scale * 0.08, cx + scale * 0.12, cy)
  ctx.quadraticCurveTo(cx, cy + scale * 0.08, cx - scale * 0.12, cy)
  ctx.fill()
}

function drawStar(ctx: CanvasRenderingContext2D, cx: number, cy: number, radius: number) {
  ctx.beginPath()
  for (let i = 0; i < 5; i++) {
    const angle = (i * 4 * Math.PI) / 5 - Math.PI / 2
    const x = cx + radius * Math.cos(angle)
    const y = cy + radius * Math.sin(angle)
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.closePath()
  ctx.fill()
}

function drawClear(_ctx: CanvasRenderingContext2D, _cx: number, _cy: number, _scale: number) {
  // Clear terrain shows nothing - empty hex
}

/**
 * Render a terrain icon at the specified position
 */
export function renderTerrainIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  terrain: TerrainType,
  hexSize: number
) {
  const scale = hexSize * 0.6

  ctx.save()
  ctx.strokeStyle = '#1a1a1a'
  ctx.fillStyle = '#1a1a1a'
  ctx.lineWidth = 1.5
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'

  switch (terrain) {
    case 'clear':
      drawClear(ctx, cx, cy, scale)
      break
    case 'grasslands':
      drawGrasslands(ctx, cx, cy, scale)
      break
    case 'forest':
      drawForest(ctx, cx, cy, scale)
      break
    case 'jungle':
      drawJungle(ctx, cx, cy, scale)
      break
    case 'hills':
      drawHills(ctx, cx, cy, scale)
      break
    case 'mountains':
      drawMountains(ctx, cx, cy, scale)
      break
    case 'desert':
      drawDesert(ctx, cx, cy, scale)
      break
    case 'swamp':
      drawSwamp(ctx, cx, cy, scale)
      break
    case 'water':
      drawWater(ctx, cx, cy, scale)
      break
    case 'volcano':
      drawVolcano(ctx, cx, cy, scale)
      break
    case 'barren':
      drawBarren(ctx, cx, cy, scale)
      break
    case 'castle':
      drawCastle(ctx, cx, cy, scale)
      break
    case 'ruins':
      drawRuins(ctx, cx, cy, scale)
      break
    case 'capitol':
      drawCapitol(ctx, cx, cy, scale)
      break
    case 'city':
      drawCity(ctx, cx, cy, scale)
      break
    case 'town':
      drawTown(ctx, cx, cy, scale)
      break
    case 'caves':
      drawCaves(ctx, cx, cy, scale)
      break
  }

  ctx.restore()
}
