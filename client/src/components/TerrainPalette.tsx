import * as React from 'react'
import type { TerrainType } from '@gygax/shared'
import {
  NATURAL_TERRAIN_TYPES,
  SETTLEMENT_TERRAIN_TYPES,
  TERRAIN_INFO,
  renderTerrainIcon,
} from '../utils/terrainIcons'

interface TerrainPaletteProps {
  selectedTerrain: TerrainType
  onTerrainChange: (terrain: TerrainType) => void
}

interface TerrainButtonProps {
  terrain: TerrainType
  isSelected: boolean
  onClick: () => void
}

function TerrainButton({ terrain, isSelected, onClick }: TerrainButtonProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const info = TERRAIN_INFO[terrain]

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
    ctx.fillStyle = isSelected ? '#1a1a1a' : '#faf5eb'
    ctx.fillRect(0, 0, size, size)

    // Draw icon
    ctx.save()
    if (isSelected) {
      ctx.strokeStyle = '#faf5eb'
      ctx.fillStyle = '#faf5eb'
    }
    renderTerrainIcon(ctx, size / 2, size / 2, terrain, size * 0.8)
    ctx.restore()
  }, [terrain, isSelected])

  return (
    <button
      onClick={onClick}
      title={info.name}
      className={`
        flex items-center justify-center rounded border-2 transition-colors
        ${
          isSelected
            ? 'border-ink bg-ink'
            : 'border-ink bg-parchment-100 hover:bg-parchment-200'
        }
      `}
    >
      <canvas ref={canvasRef} className="block" />
    </button>
  )
}

export function TerrainPalette({ selectedTerrain, onTerrainChange }: TerrainPaletteProps) {
  return (
    <div className="flex max-h-[400px] flex-col overflow-y-auto">
      {/* Natural terrain section */}
      <div className="border-b-2 border-ink-faded p-2">
        <p className="mb-1 text-center font-body text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Natural
        </p>
        <div className="grid grid-cols-2 gap-1">
          {NATURAL_TERRAIN_TYPES.map((terrain) => (
            <TerrainButton
              key={terrain}
              terrain={terrain}
              isSelected={selectedTerrain === terrain}
              onClick={() => onTerrainChange(terrain)}
            />
          ))}
        </div>
      </div>

      {/* Settlements section */}
      <div className="p-2">
        <p className="mb-1 text-center font-body text-xs font-semibold uppercase tracking-wide text-ink-soft">
          Settlements
        </p>
        <div className="grid grid-cols-2 gap-1">
          {SETTLEMENT_TERRAIN_TYPES.map((terrain) => (
            <TerrainButton
              key={terrain}
              terrain={terrain}
              isSelected={selectedTerrain === terrain}
              onClick={() => onTerrainChange(terrain)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}
