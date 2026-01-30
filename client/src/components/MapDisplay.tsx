import type { Map } from '@gygax/shared'
import { MapCanvas } from './MapCanvas'

interface MapDisplayProps {
  map: Map
  className?: string
}

export function MapDisplay({ map, className = '' }: MapDisplayProps) {
  return (
    <div className={`relative h-full w-full ${className}`}>
      {/* Map name header */}
      <div className="absolute left-4 top-4 z-10 rounded border-2 border-ink bg-parchment-100 px-3 py-1 shadow-brutal">
        <span className="font-display text-sm uppercase tracking-wide text-ink">{map.name}</span>
        <span className="ml-2 font-body text-xs text-ink-faded">
          ({map.gridType === 'HEX' ? 'Hex' : 'Square'})
        </span>
      </div>

      {/* Read-only MapCanvas - no callbacks means no editing */}
      <MapCanvas map={map} className="h-full w-full" />
    </div>
  )
}
