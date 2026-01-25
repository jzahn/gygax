import * as React from 'react'
import { useNavigate } from 'react-router'
import type { Map } from '@gygax/shared'
import { MapPreview } from './MapPreview'

interface MapCardProps {
  map: Map
  onEdit: () => void
  onDelete: () => void
}

export function MapCard({ map, onEdit, onDelete }: MapCardProps) {
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  // Close menu when clicking outside
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  const handleCardClick = () => {
    navigate(`/maps/${map.id}`)
  }

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpen(!menuOpen)
  }

  const handleEditClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpen(false)
    onEdit()
  }

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    setMenuOpen(false)
    onDelete()
  }

  return (
    <div
      onClick={handleCardClick}
      className="group cursor-pointer border-3 border-ink bg-parchment-100 shadow-brutal transition-all hover:-translate-y-1 hover:shadow-brutal-lg"
    >
      {/* Map Preview */}
      <div className="border-b-3 border-ink bg-white">
        <div className="aspect-video w-full">
          <MapPreview map={map} />
        </div>
      </div>

      {/* Info */}
      <div className="p-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 font-display text-sm uppercase tracking-wide text-ink">
            {map.name}
          </h3>
          <div className="relative" ref={menuRef}>
            <button
              onClick={handleMenuClick}
              className="p-1 text-ink-soft opacity-0 transition-opacity hover:text-ink group-hover:opacity-100"
              aria-label="Map options"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                className="rotate-90"
              >
                <circle cx="3" cy="8" r="1.5" />
                <circle cx="8" cy="8" r="1.5" />
                <circle cx="13" cy="8" r="1.5" />
              </svg>
            </button>

            {menuOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 min-w-[120px] rounded border-2 border-ink bg-parchment-100 py-1 shadow-brutal">
                <button
                  onClick={handleEditClick}
                  className="block w-full px-3 py-1.5 text-left font-body text-sm text-ink hover:bg-parchment-200"
                >
                  Edit
                </button>
                <button
                  onClick={handleDeleteClick}
                  className="block w-full px-3 py-1.5 text-left font-body text-sm text-blood-red hover:bg-parchment-200"
                >
                  Delete
                </button>
              </div>
            )}
          </div>
        </div>
        <p className="mt-1 font-body text-xs text-ink-soft">
          {map.width}&times;{map.height} &bull; {map.gridType === 'SQUARE' ? 'Square' : 'Hex'} grid
        </p>
      </div>
    </div>
  )
}
