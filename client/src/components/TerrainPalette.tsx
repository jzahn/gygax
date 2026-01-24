import * as React from 'react'
import type { TerrainType } from '@gygax/shared'
import {
  NATURAL_TERRAIN_TYPES,
  SETTLEMENT_TERRAIN_TYPES,
  renderTerrainIcon,
} from '../utils/terrainIcons'

interface TerrainPaletteProps {
  selectedTerrain: TerrainType
  onTerrainChange: (terrain: TerrainType) => void
  onHover?: (terrain: TerrainType | null) => void
}

interface TerrainButtonProps {
  terrain: TerrainType
  isSelected: boolean
  onClick: () => void
  onHover?: (terrain: TerrainType | null) => void
}

function TerrainButton({ terrain, isSelected, onClick, onHover }: TerrainButtonProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)

  // Draw terrain icon on canvas
  React.useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    const size = 28

    canvas.width = size * dpr
    canvas.height = size * dpr
    canvas.style.width = `${size}px`
    canvas.style.height = `${size}px`

    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.scale(dpr, dpr)

    // Clear
    ctx.fillStyle = isSelected ? '#ffffff' : '#faf5eb'
    ctx.fillRect(0, 0, size, size)

    // Draw icon (always black)
    renderTerrainIcon(ctx, size / 2, size / 2, terrain, size * 0.8)
  }, [terrain, isSelected])

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => onHover?.(terrain)}
      onMouseLeave={() => onHover?.(null)}
      className={`
        flex items-center justify-center border-2 transition-all
        ${
          isSelected
            ? '-translate-y-0.5 border-ink bg-white shadow-brutal'
            : 'border-ink bg-parchment-100 shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal'
        }
      `}
    >
      <canvas ref={canvasRef} className="block" />
    </button>
  )
}

export function TerrainPalette({ selectedTerrain, onTerrainChange, onHover }: TerrainPaletteProps) {
  return (
    <div className="flex max-h-[400px] flex-col overflow-y-auto">
      {/* Natural terrain section */}
      <div className="border-b-2 border-ink-faded p-2">
        <div className="grid grid-cols-2 gap-1">
          {NATURAL_TERRAIN_TYPES.map((terrain) => (
            <TerrainButton
              key={terrain}
              terrain={terrain}
              isSelected={selectedTerrain === terrain}
              onClick={() => onTerrainChange(terrain)}
              onHover={onHover}
            />
          ))}
        </div>
      </div>

      {/* Settlements section */}
      <div className="p-2">
        <div className="grid grid-cols-2 gap-1">
          {SETTLEMENT_TERRAIN_TYPES.map((terrain) => (
            <TerrainButton
              key={terrain}
              terrain={terrain}
              isSelected={selectedTerrain === terrain}
              onClick={() => onTerrainChange(terrain)}
              onHover={onHover}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
