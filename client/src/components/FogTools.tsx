import * as React from 'react'
import { Button } from './ui'

export type FogTool = 'brush' | 'rect'
export type FogBrushSize = 'small' | 'medium' | 'large'

interface FogToolsProps {
  activeTool: FogTool | null
  brushSize: FogBrushSize
  onToolChange: (tool: FogTool | null) => void
  onBrushSizeChange: (size: FogBrushSize) => void
  onRevealAll: () => void
  onHideAll: () => void
  disabled?: boolean
}

export function FogTools({
  activeTool,
  brushSize,
  onToolChange,
  onBrushSizeChange,
  onRevealAll,
  onHideAll,
  disabled = false,
}: FogToolsProps) {
  return (
    <div className="flex flex-col gap-2">
      {/* Tool buttons */}
      <div className="flex items-center gap-1">
        <Button
          variant={activeTool === 'brush' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => onToolChange(activeTool === 'brush' ? null : 'brush')}
          disabled={disabled}
          className="flex-1"
          title="Brush tool - click/drag to reveal cells"
        >
          &#128396; Brush
        </Button>
        <Button
          variant={activeTool === 'rect' ? 'primary' : 'ghost'}
          size="sm"
          onClick={() => onToolChange(activeTool === 'rect' ? null : 'rect')}
          disabled={disabled}
          className="flex-1"
          title="Rectangle tool - drag to reveal area"
        >
          &#9634; Rect
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRevealAll}
          disabled={disabled}
          className="flex-1"
          title="Reveal entire map"
        >
          &#9788; All
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={onHideAll}
          disabled={disabled}
          className="flex-1 text-blood-red hover:bg-blood-red hover:text-parchment-100"
          title="Reset fog - hide entire map"
        >
          &#9724; Reset
        </Button>
      </div>

      {/* Brush size (only when brush tool is active) */}
      {activeTool === 'brush' && (
        <div className="flex items-center gap-1">
          <span className="font-body text-xs text-ink-soft">Size:</span>
          <div className="flex gap-1">
            {(['small', 'medium', 'large'] as const).map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onBrushSizeChange(size)}
                disabled={disabled}
                className={`flex h-6 w-6 items-center justify-center border-2 font-body text-xs ${
                  brushSize === size
                    ? 'border-ink bg-ink text-parchment-100'
                    : 'border-ink bg-parchment-100 text-ink hover:bg-parchment-200'
                }`}
                title={`${size.charAt(0).toUpperCase() + size.slice(1)} brush (${size === 'small' ? '1' : size === 'medium' ? '3x3' : '5x5'})`}
              >
                {size === 'small' ? 'S' : size === 'medium' ? 'M' : 'L'}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
