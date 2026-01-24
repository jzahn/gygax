import * as React from 'react'
import type { TerrainType, GridType } from '@gygax/shared'
import type { DrawingTool } from '../hooks/useMapDrawing'
import { TerrainPalette } from './TerrainPalette'

interface MapToolbarProps {
  tool: DrawingTool
  selectedTerrain: TerrainType
  gridType: GridType
  onToolChange: (tool: DrawingTool) => void
  onTerrainChange: (terrain: TerrainType) => void
}

interface ToolButtonProps {
  tool: DrawingTool
  currentTool: DrawingTool
  onClick: () => void
  disabled?: boolean
  shortcut: string
  children: React.ReactNode
}

function ToolButton({ tool, currentTool, onClick, disabled, shortcut, children }: ToolButtonProps) {
  const isActive = tool === currentTool
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={`${tool.charAt(0).toUpperCase() + tool.slice(1)} (${shortcut})`}
      className={`
        flex h-9 w-9 items-center justify-center rounded border-2 transition-colors
        ${
          isActive
            ? 'border-ink bg-ink text-parchment-100'
            : disabled
              ? 'cursor-not-allowed border-ink-faded bg-parchment-100 text-ink-faded'
              : 'border-ink bg-parchment-100 text-ink hover:bg-parchment-200'
        }
      `}
    >
      {children}
    </button>
  )
}

// Hand icon for Pan tool
function PanIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
      <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
      <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
      <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
    </svg>
  )
}

// Stamp icon for Terrain tool
function TerrainIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 3L4 9v12h16V9l-8-6z" />
      <path d="M12 3v6" />
      <path d="M9 14h6" />
      <path d="M9 18h6" />
    </svg>
  )
}

// Eraser icon
function EraserIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="m7 21-4.3-4.3c-1-1-1-2.5 0-3.4l9.6-9.6c1-1 2.5-1 3.4 0l5.6 5.6c1 1 1 2.5 0 3.4L13 21" />
      <path d="M22 21H7" />
      <path d="m5 11 9 9" />
    </svg>
  )
}

export function MapToolbar({
  tool,
  selectedTerrain,
  gridType,
  onToolChange,
  onTerrainChange,
}: MapToolbarProps) {
  const isHexGrid = gridType === 'HEX'
  const terrainDisabled = !isHexGrid

  return (
    <div className="flex w-[88px] flex-shrink-0 flex-col border-l-3 border-ink bg-parchment-100">
      {/* Tool buttons */}
      <div className="flex flex-col items-center gap-1 border-b-2 border-ink-faded p-2">
        <ToolButton tool="pan" currentTool={tool} onClick={() => onToolChange('pan')} shortcut="P">
          <PanIcon />
        </ToolButton>
        <ToolButton
          tool="terrain"
          currentTool={tool}
          onClick={() => onToolChange('terrain')}
          disabled={terrainDisabled}
          shortcut="T"
        >
          <TerrainIcon />
        </ToolButton>
        <ToolButton
          tool="erase"
          currentTool={tool}
          onClick={() => onToolChange('erase')}
          disabled={terrainDisabled}
          shortcut="E"
        >
          <EraserIcon />
        </ToolButton>
      </div>

      {/* Terrain palette - only show for hex grids when terrain tool selected */}
      {isHexGrid && tool === 'terrain' && (
        <TerrainPalette selectedTerrain={selectedTerrain} onTerrainChange={onTerrainChange} />
      )}

      {/* Message for non-hex grids */}
      {!isHexGrid && (
        <div className="flex-1 p-2">
          <p className="text-center font-body text-xs text-ink-soft">
            Terrain stamping requires hex grid
          </p>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Space hint */}
      <div className="border-t-2 border-ink-faded p-2">
        <p className="text-center font-body text-xs text-ink-soft">Space: Pan</p>
      </div>
    </div>
  )
}
