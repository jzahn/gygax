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

      {/* Title overlay */}
      {backdrop.title && (
        <div
          className="pointer-events-none absolute font-display uppercase tracking-wide text-parchment-100 text-center"
          style={{
            left: `${backdrop.titleX}%`,
            top: `${backdrop.titleY}%`,
            transform: 'translate(-50%, -50%)',
            fontSize: 'clamp(1rem, 3vw, 3rem)',
            maxWidth: '90%',
            padding: '0.3em 0.6em',
            backgroundColor: 'rgba(0,0,0,0.7)',
            textShadow: '0 0 6px rgba(0,0,0,1), 2px 3px 8px rgba(0,0,0,1)',
          }}
        >
          {backdrop.title}
        </div>
      )}

      {/* Backdrop name in corner */}
      <div className="absolute left-4 top-4 z-10 rounded border-2 border-ink bg-parchment-100 px-3 py-1 shadow-brutal">
        <span className="font-display text-sm uppercase tracking-wide text-ink">
          {backdrop.name}
        </span>
      </div>

      {/* Parchment border frame */}
      <div
        className="pointer-events-none absolute inset-0 border-8 border-parchment-200/50"
        style={{
          boxShadow: 'inset 0 0 20px rgba(139, 90, 43, 0.3)',
        }}
      />
    </div>
  )
}
