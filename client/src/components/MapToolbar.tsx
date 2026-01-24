import * as React from 'react'
import type { TerrainType, GridType, PathType, TextSize } from '@gygax/shared'
import type { DrawingTool } from '../hooks/useMapDrawing'
import { TerrainPalette } from './TerrainPalette'
import { PathPalette } from './PathPalette'
import { TextSizeSelector } from './TextSizeSelector'
import { TERRAIN_INFO } from '../utils/terrainIcons'

interface MapToolbarProps {
  tool: DrawingTool
  selectedTerrain: TerrainType
  selectedPathType: PathType
  selectedLabelSize: TextSize
  gridType: GridType
  onToolChange: (tool: DrawingTool) => void
  onTerrainChange: (terrain: TerrainType) => void
  onPathTypeChange: (pathType: PathType) => void
  onLabelSizeChange: (size: TextSize) => void
}

interface ToolButtonProps {
  tool: DrawingTool
  currentTool: DrawingTool
  shortcut?: string
  onClick: () => void
  disabled?: boolean
  onHover?: (tool: DrawingTool | null) => void
  children: React.ReactNode
}

function ToolButton({ tool, currentTool, shortcut, onClick, disabled, onHover, children }: ToolButtonProps) {
  const isActive = tool === currentTool
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      onMouseEnter={() => onHover?.(tool)}
      onMouseLeave={() => onHover?.(null)}
      title={shortcut ? `Shortcut: ${shortcut}` : undefined}
      className={`
        flex h-9 w-9 items-center justify-center border-2 transition-all
        ${
          isActive
            ? '-translate-y-0.5 border-ink bg-white text-ink shadow-brutal'
            : disabled
              ? 'cursor-not-allowed border-ink-faded bg-parchment-100 text-ink-faded shadow-brutal-sm'
              : 'border-ink bg-parchment-100 text-ink shadow-brutal-sm hover:-translate-y-0.5 hover:shadow-brutal'
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

// Hex icon for Terrain/Stamp tool
function TerrainIcon() {
  // Flat-top hexagon centered at (12,12) with radius 9
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12 L16.5 19.8 L7.5 19.8 L3 12 L7.5 4.2 L16.5 4.2 Z" strokeLinejoin="round" />
    </svg>
  )
}

// Path icon (curved line)
function PathIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 17C5.5 17 6 14 8 14s2.5 3 5 3 3-4 5.5-4" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="3" cy="17" r="1.5" fill="currentColor" />
      <circle cx="21" cy="13" r="1.5" fill="currentColor" />
    </svg>
  )
}

// Label icon (uppercase T from map font)
function LabelIcon() {
  return <span className="font-fell text-xl leading-none">T</span>
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

const PATH_TYPE_NAMES: Record<PathType, string> = {
  road: 'Road',
  river: 'River',
  stream: 'Stream',
  border: 'Border',
  trail: 'Trail',
}

const LABEL_SIZE_NAMES: Record<TextSize, string> = {
  small: 'Small',
  medium: 'Medium',
  large: 'Large',
  xlarge: 'Extra Large',
}

export function MapToolbar({
  tool,
  selectedTerrain,
  selectedPathType,
  selectedLabelSize,
  gridType,
  onToolChange,
  onTerrainChange,
  onPathTypeChange,
  onLabelSizeChange,
}: MapToolbarProps) {
  const [hoveredTerrain, setHoveredTerrain] = React.useState<TerrainType | null>(null)
  const [hoveredPathType, setHoveredPathType] = React.useState<PathType | null>(null)
  const [hoveredLabelSize, setHoveredLabelSize] = React.useState<TextSize | null>(null)
  const [hoveredTool, setHoveredTool] = React.useState<DrawingTool | null>(null)
  const isHexGrid = gridType === 'HEX'
  const terrainDisabled = !isHexGrid

  const toolNames: Record<DrawingTool, string> = {
    pan: 'Pan (P)',
    terrain: 'Terrain (T)',
    path: 'Path (R)',
    label: 'Label (L)',
    erase: 'Erase (E)',
  }

  const getHintText = (): string => {
    if (hoveredTool) return toolNames[hoveredTool]
    if (hoveredTerrain) return TERRAIN_INFO[hoveredTerrain].name
    if (hoveredPathType) return PATH_TYPE_NAMES[hoveredPathType]
    if (hoveredLabelSize) return LABEL_SIZE_NAMES[hoveredLabelSize]
    return '\u00A0'
  }

  return (
    <div className="flex w-[88px] flex-shrink-0 flex-col border-l-3 border-ink bg-parchment-100">
      {/* Tool buttons */}
      <div className="flex flex-col items-center gap-1 border-b-2 border-ink-faded p-2">
        <ToolButton
          tool="pan"
          currentTool={tool}
          shortcut="P"
          onClick={() => onToolChange('pan')}
          onHover={setHoveredTool}
        >
          <PanIcon />
        </ToolButton>
        <ToolButton
          tool="terrain"
          currentTool={tool}
          shortcut="T"
          onClick={() => onToolChange('terrain')}
          disabled={terrainDisabled}
          onHover={setHoveredTool}
        >
          <TerrainIcon />
        </ToolButton>
        <ToolButton
          tool="path"
          currentTool={tool}
          shortcut="R"
          onClick={() => onToolChange('path')}
          disabled={terrainDisabled}
          onHover={setHoveredTool}
        >
          <PathIcon />
        </ToolButton>
        <ToolButton
          tool="label"
          currentTool={tool}
          shortcut="L"
          onClick={() => onToolChange('label')}
          disabled={terrainDisabled}
          onHover={setHoveredTool}
        >
          <LabelIcon />
        </ToolButton>
        <ToolButton
          tool="erase"
          currentTool={tool}
          shortcut="E"
          onClick={() => onToolChange('erase')}
          disabled={terrainDisabled}
          onHover={setHoveredTool}
        >
          <EraserIcon />
        </ToolButton>
      </div>

      {/* Terrain palette - only show for hex grids when terrain tool selected */}
      {isHexGrid && tool === 'terrain' && (
        <TerrainPalette
          selectedTerrain={selectedTerrain}
          onTerrainChange={onTerrainChange}
          onHover={setHoveredTerrain}
        />
      )}

      {/* Path palette - show when path tool selected */}
      {isHexGrid && tool === 'path' && (
        <PathPalette
          selectedPath={selectedPathType}
          onPathChange={onPathTypeChange}
          onHover={setHoveredPathType}
        />
      )}

      {/* Text size selector - show when label tool selected */}
      {isHexGrid && tool === 'label' && (
        <TextSizeSelector
          selectedSize={selectedLabelSize}
          onSizeChange={onLabelSizeChange}
          onHover={setHoveredLabelSize}
        />
      )}

      {/* Message for non-hex grids */}
      {!isHexGrid && (
        <div className="flex-1 p-2">
          <p className="text-center font-body text-xs text-ink-soft">
            Drawing tools require hex grid
          </p>
        </div>
      )}

      {/* Spacer */}
      <div className="flex-1" />

      {/* Hover hint */}
      <div className="border-t-2 border-ink-faded p-2">
        <p className="text-center font-body text-xs text-ink-soft">{getHintText()}</p>
      </div>
    </div>
  )
}
