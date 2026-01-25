import * as React from 'react'
import type { FeatureType } from '@gygax/shared'
import { FEATURE_CATEGORIES, renderFeatureIcon } from '../utils/featureUtils'

interface FeaturePaletteProps {
  selectedFeature: FeatureType
  onFeatureChange: (feature: FeatureType) => void
  onRotate: (direction: 'cw' | 'ccw') => void
  onHover?: (feature: FeatureType | null) => void
}

interface FeatureButtonProps {
  featureType: FeatureType
  isSelected: boolean
  onClick: () => void
  onHover?: (feature: FeatureType | null) => void
}

function FeatureButton({ featureType, isSelected, onClick, onHover }: FeatureButtonProps) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)

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

    // Draw feature icon
    renderFeatureIcon(ctx, featureType, 2, 2, size - 4, size - 4)
  }, [featureType, isSelected])

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => onHover?.(featureType)}
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

// Rotate counter-clockwise icon
function RotateCCWIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </svg>
  )
}

// Rotate clockwise icon
function RotateCWIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 12a9 9 0 1 1-9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  )
}

export function FeaturePalette({
  selectedFeature,
  onFeatureChange,
  onRotate,
  onHover,
}: FeaturePaletteProps) {
  return (
    <div className="flex max-h-[400px] flex-col overflow-y-auto">
      {/* Rotation controls */}
      <div className="flex items-center justify-center gap-2 border-b-2 border-ink-faded p-2">
        <button
          onClick={() => onRotate('ccw')}
          className="flex h-7 w-7 items-center justify-center border-2 border-ink bg-parchment-100 shadow-brutal-sm transition-all hover:-translate-y-0.5 hover:shadow-brutal"
          title="Rotate counter-clockwise (Shift+Z)"
        >
          <RotateCCWIcon />
        </button>
        <span className="font-mono text-xs text-ink-faded">Z</span>
        <button
          onClick={() => onRotate('cw')}
          className="flex h-7 w-7 items-center justify-center border-2 border-ink bg-parchment-100 shadow-brutal-sm transition-all hover:-translate-y-0.5 hover:shadow-brutal"
          title="Rotate clockwise (Z)"
        >
          <RotateCWIcon />
        </button>
      </div>

      {/* Feature categories */}
      {FEATURE_CATEGORIES.map((category, idx) => (
        <div
          key={category.name}
          className={`p-2 ${idx < FEATURE_CATEGORIES.length - 1 ? 'border-b-2 border-ink-faded' : ''}`}
        >
          <div className="mb-1 font-body text-xs text-ink-soft">{category.name}</div>
          <div className="grid grid-cols-2 gap-1">
            {category.types.map((type) => (
              <FeatureButton
                key={type}
                featureType={type}
                isSelected={selectedFeature === type}
                onClick={() => onFeatureChange(type)}
                onHover={onHover}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
