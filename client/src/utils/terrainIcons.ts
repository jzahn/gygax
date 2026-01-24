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
  'caves',
]

export const SETTLEMENT_TERRAIN_TYPES: SettlementTerrain[] = [
  'castle',
  'ruins',
  'capitol',
  'city',
  'town',
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
  caves: { name: 'Caves', group: 'natural' },
}

// Terrains with 3 variants (images)
const MULTI_VARIANT_TERRAINS: TerrainType[] = [
  'forest',
  'jungle',
  'desert',
  'mountains',
  'hills',
  'swamp',
  'volcano',
  'grasslands',
  'barren',
  'caves',
]

// Terrains with single variant
const SINGLE_VARIANT_TERRAINS: TerrainType[] = ['castle', 'ruins', 'capitol', 'city', 'town']

// Image cache
const imageCache: Map<string, HTMLImageElement> = new Map()
let imagesLoaded = false
let loadPromise: Promise<void> | null = null

/**
 * Get the image key for a terrain type and variant
 */
function getImageKey(terrain: TerrainType, variant: 0 | 1 | 2): string {
  if (terrain === 'clear') {
    return 'clear' // No image needed, but key for consistency
  }
  if (SINGLE_VARIANT_TERRAINS.includes(terrain)) {
    return terrain
  }
  return `${terrain}-${variant}`
}

/**
 * Get the image path for a terrain type and variant
 */
function getImagePath(terrain: TerrainType, variant: 0 | 1 | 2): string {
  if (SINGLE_VARIANT_TERRAINS.includes(terrain)) {
    return `/terrain/${terrain}.png`
  }
  return `/terrain/${terrain}-${variant}.png`
}

/**
 * Load a single image and return a promise
 */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(`Failed to load image: ${src}`))
    img.src = src
  })
}

/**
 * Preload all terrain images. Call this at app startup.
 * Returns a promise that resolves when all images are loaded.
 */
export async function preloadTerrainImages(): Promise<void> {
  if (imagesLoaded) return
  if (loadPromise) return loadPromise

  loadPromise = (async () => {
    const loadPromises: Promise<void>[] = []

    // Load multi-variant terrain images
    for (const terrain of MULTI_VARIANT_TERRAINS) {
      for (const variant of [0, 1, 2] as const) {
        const key = getImageKey(terrain, variant)
        const path = getImagePath(terrain, variant)

        loadPromises.push(
          loadImage(path)
            .then((img) => {
              imageCache.set(key, img)
            })
            .catch((err) => {
              console.warn(`Could not load terrain image: ${path}`, err)
            })
        )
      }
    }

    // Load single-variant terrain images
    for (const terrain of SINGLE_VARIANT_TERRAINS) {
      const key = getImageKey(terrain, 0)
      const path = getImagePath(terrain, 0)

      loadPromises.push(
        loadImage(path)
          .then((img) => {
            imageCache.set(key, img)
          })
          .catch((err) => {
            console.warn(`Could not load terrain image: ${path}`, err)
          })
      )
    }

    await Promise.all(loadPromises)
    imagesLoaded = true
  })()

  return loadPromise
}

/**
 * Check if terrain images have been loaded
 */
export function areTerrainImagesLoaded(): boolean {
  return imagesLoaded
}

/**
 * Render a terrain icon at the specified position with a specific variant.
 * Uses preloaded PNG images if available, falls back to nothing if not loaded.
 */
export function renderTerrainIcon(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  terrain: TerrainType,
  hexSize: number,
  variant: 0 | 1 | 2 = 0
) {
  // Clear terrain has no icon
  if (terrain === 'clear') {
    return
  }

  // Water is just a 50% grey fill (no image needed)
  if (terrain === 'water') {
    drawWaterFill(ctx, cx, cy, hexSize)
    return
  }

  const key = getImageKey(terrain, variant)
  const img = imageCache.get(key)

  if (!img) {
    // Image not loaded yet, draw a placeholder
    drawPlaceholder(ctx, cx, cy, hexSize, terrain)
    return
  }

  // Calculate size to fit within hex (with some padding)
  const drawSize = hexSize * 0.7

  ctx.save()
  ctx.drawImage(img, cx - drawSize / 2, cy - drawSize / 2, drawSize, drawSize)
  ctx.restore()
}

/**
 * Draw water as a 50% grey hexagon fill
 */
function drawWaterFill(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  hexSize: number
) {
  const size = hexSize / 2

  ctx.save()
  ctx.fillStyle = '#808080' // 50% grey
  ctx.beginPath()

  // Draw hexagon path (flat-top)
  for (let i = 0; i < 6; i++) {
    const angleDeg = 60 * i
    const angleRad = (Math.PI / 180) * angleDeg
    const x = cx + size * Math.cos(angleRad)
    const y = cy + size * Math.sin(angleRad)
    if (i === 0) {
      ctx.moveTo(x, y)
    } else {
      ctx.lineTo(x, y)
    }
  }
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

/**
 * Draw a simple placeholder when image isn't loaded
 */
function drawPlaceholder(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  hexSize: number,
  terrain: TerrainType
) {
  ctx.save()
  ctx.fillStyle = '#999'
  ctx.font = `${hexSize * 0.2}px sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(terrain.charAt(0).toUpperCase(), cx, cy)
  ctx.restore()
}

/**
 * Get a random variant for stamping
 */
export function getRandomVariant(): 0 | 1 | 2 {
  return Math.floor(Math.random() * 3) as 0 | 1 | 2
}
