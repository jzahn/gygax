import type { Backdrop } from '@gygax/shared'

interface BackdropDisplayProps {
  backdrop: Backdrop
  className?: string
}

export function BackdropDisplay({ backdrop, className = '' }: BackdropDisplayProps) {
  return (
    <div className={`relative h-full w-full overflow-hidden ${className}`}>
      {/* Backdrop image */}
      <img
        src={backdrop.imageUrl}
        alt={backdrop.name}
        className="h-full w-full object-cover"
        style={{
          objectPosition: `${backdrop.focusX}% ${backdrop.focusY}%`,
        }}
        draggable={false}
      />

      {/* Backdrop name in corner */}
      <div className="absolute left-4 top-4 z-10 border-2 border-ink bg-parchment-100 px-3 py-1 shadow-brutal">
        <span className="font-display text-sm uppercase tracking-wide text-ink">
          {backdrop.name}
        </span>
      </div>
    </div>
  )
}
