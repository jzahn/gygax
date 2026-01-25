import type { Map, MapExportFile, MapContent, GridType } from '@gygax/shared'

/**
 * Sanitize a filename by removing invalid characters
 */
function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*]/g, '') // Remove invalid chars
    .replace(/\s+/g, '-') // Spaces to hyphens
    .toLowerCase()
    .slice(0, 100) // Limit length
}

/**
 * Export a map to a JSON file and trigger download
 */
export function exportMap(map: Map): void {
  const exportData: MapExportFile = {
    version: 1,
    exportedAt: new Date().toISOString(),
    map: {
      name: map.name,
      description: map.description,
      gridType: map.gridType,
      width: map.width,
      height: map.height,
      cellSize: map.cellSize,
      content: map.content,
    },
  }

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: 'application/json',
  })
  const url = URL.createObjectURL(blob)

  const a = document.createElement('a')
  a.href = url
  a.download = `${sanitizeFilename(map.name)}.gygax.json`
  a.click()

  URL.revokeObjectURL(url)
}

export interface ImportedMapData {
  name: string
  description: string | null
  gridType: GridType
  width: number
  height: number
  cellSize: number
  content: MapContent | null
}

export interface ImportResult {
  success: true
  data: ImportedMapData
}

export interface ImportError {
  success: false
  error: string
}

/**
 * Parse and validate a map export file
 */
export function parseMapExportFile(fileContent: string): ImportResult | ImportError {
  let parsed: unknown

  try {
    parsed = JSON.parse(fileContent)
  } catch {
    return { success: false, error: 'Invalid JSON file' }
  }

  if (typeof parsed !== 'object' || parsed === null) {
    return { success: false, error: 'Invalid map file format' }
  }

  const file = parsed as Record<string, unknown>

  // Validate version
  if (file.version !== 1) {
    return { success: false, error: 'Unsupported map file version' }
  }

  // Validate map object
  if (typeof file.map !== 'object' || file.map === null) {
    return { success: false, error: 'Map file is missing map data' }
  }

  const map = file.map as Record<string, unknown>

  // Validate required fields
  if (typeof map.name !== 'string' || map.name.trim().length === 0) {
    return { success: false, error: 'Map file is missing name' }
  }

  if (map.gridType !== 'SQUARE' && map.gridType !== 'HEX') {
    return { success: false, error: 'Invalid grid type in map file' }
  }

  if (typeof map.width !== 'number' || map.width < 5 || map.width > 100) {
    return { success: false, error: 'Invalid width in map file (must be 5-100)' }
  }

  if (typeof map.height !== 'number' || map.height < 5 || map.height > 100) {
    return { success: false, error: 'Invalid height in map file (must be 5-100)' }
  }

  // Description is optional
  const description = typeof map.description === 'string' ? map.description : null

  // cellSize defaults to 40 if not present
  const cellSize = typeof map.cellSize === 'number' ? map.cellSize : 40

  // Content is optional (null for empty maps)
  const content = map.content as MapContent | null

  return {
    success: true,
    data: {
      name: map.name,
      description,
      gridType: map.gridType as GridType,
      width: map.width,
      height: map.height,
      cellSize,
      content,
    },
  }
}

/**
 * Read a file and parse it as a map export
 */
export function readMapExportFile(file: File): Promise<ImportResult | ImportError> {
  return new Promise((resolve) => {
    const reader = new FileReader()

    reader.onload = () => {
      if (typeof reader.result === 'string') {
        resolve(parseMapExportFile(reader.result))
      } else {
        resolve({ success: false, error: 'Failed to read file' })
      }
    }

    reader.onerror = () => {
      resolve({ success: false, error: 'Failed to read file' })
    }

    reader.readAsText(file)
  })
}
