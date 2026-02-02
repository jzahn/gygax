import * as React from 'react'
import type { Map, Backdrop, SessionStatus } from '@gygax/shared'
import { Button } from './ui'

interface DMControlsProps {
  maps: Map[]
  backdrops: Backdrop[]
  activeMapId: string | null
  activeBackdropId: string | null
  sessionStatus: SessionStatus
  onSelectMap: (mapId: string | null) => void
  onSelectBackdrop: (backdropId: string | null) => void
  onClearDisplay: () => void
  onPause: () => void
  onResume: () => void
  onEnd: () => void
  isUpdating?: boolean
  className?: string
}

export function DMControls({
  maps,
  backdrops,
  activeMapId,
  activeBackdropId,
  sessionStatus,
  onSelectMap,
  onSelectBackdrop,
  onClearDisplay,
  onPause,
  onResume,
  onEnd,
  isUpdating = false,
  className = '',
}: DMControlsProps) {
  const [showEndConfirm, setShowEndConfirm] = React.useState(false)

  const handleMapChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    onSelectMap(value === '' ? null : value)
  }

  const handleBackdropChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    onSelectBackdrop(value === '' ? null : value)
  }

  const handleEndClick = () => {
    if (showEndConfirm) {
      onEnd()
      setShowEndConfirm(false)
    } else {
      setShowEndConfirm(true)
    }
  }

  // Hide cancel confirmation after 3 seconds
  React.useEffect(() => {
    if (showEndConfirm) {
      const timeout = setTimeout(() => setShowEndConfirm(false), 3000)
      return () => clearTimeout(timeout)
    }
  }, [showEndConfirm])

  return (
    <div
      className={`px-4 py-3 ${className}`}
    >
      {/* Mobile/tablet layout: two rows */}
      <div className="flex flex-col gap-3 md:hidden">
        {/* Dropdowns row */}
        <div className="flex flex-col gap-2">
          <label className="flex items-center gap-2">
            <span className="font-body text-sm text-ink">&#128220;</span>
            <select
              value={activeMapId || ''}
              onChange={handleMapChange}
              className="min-w-0 flex-1 border-2 border-ink bg-parchment-100 px-2 py-1 font-body text-sm text-ink"
            >
              <option value="">Select Map...</option>
              {maps.map((map) => (
                <option key={map.id} value={map.id}>
                  {map.name} ({map.gridType === 'HEX' ? 'Hex' : 'Sq'})
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2">
            <span className="font-body text-sm text-ink">&#128444;</span>
            <select
              value={activeBackdropId || ''}
              onChange={handleBackdropChange}
              className="min-w-0 flex-1 border-2 border-ink bg-parchment-100 px-2 py-1 font-body text-sm text-ink"
            >
              <option value="">Select Backdrop...</option>
              {backdrops.map((backdrop) => (
                <option key={backdrop.id} value={backdrop.id}>
                  {backdrop.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {/* Buttons row */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearDisplay}
            disabled={!activeMapId && !activeBackdropId}
            className="text-ink hover:bg-ink hover:text-parchment-100"
          >
            &#10005; Clear
          </Button>
          <div className="flex items-center gap-2">
            {sessionStatus === 'ACTIVE' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onPause}
                disabled={isUpdating}
                className="text-ink hover:bg-ink hover:text-parchment-100"
              >
                &#9208; Pause
              </Button>
            )}
            {sessionStatus === 'PAUSED' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onResume}
                disabled={isUpdating}
                className="text-ink hover:bg-ink hover:text-parchment-100"
              >
                &#9654; Resume
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEndClick}
              disabled={isUpdating}
              className={
                showEndConfirm
                  ? 'bg-blood-red text-parchment-100 hover:bg-blood-red/80'
                  : 'text-blood-red hover:bg-blood-red hover:text-parchment-100'
              }
            >
              {showEndConfirm ? 'Click to Confirm' : '■ End'}
            </Button>
          </div>
        </div>
      </div>

      {/* Desktop layout: two rows */}
      <div className="hidden flex-col gap-3 md:flex">
        {/* Top row: Display selectors */}
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2">
            <span className="font-body text-sm text-ink">&#128220;</span>
            <select
              value={activeMapId || ''}
              onChange={handleMapChange}
              className="border-2 border-ink bg-parchment-100 px-2 py-1 font-body text-sm text-ink"
            >
              <option value="">Select Map...</option>
              {maps.map((map) => (
                <option key={map.id} value={map.id}>
                  {map.name} ({map.gridType === 'HEX' ? 'Hex' : 'Sq'})
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2">
            <span className="font-body text-sm text-ink">&#128444;</span>
            <select
              value={activeBackdropId || ''}
              onChange={handleBackdropChange}
              className="border-2 border-ink bg-parchment-100 px-2 py-1 font-body text-sm text-ink"
            >
              <option value="">Select Backdrop...</option>
              {backdrops.map((backdrop) => (
                <option key={backdrop.id} value={backdrop.id}>
                  {backdrop.name}
                </option>
              ))}
            </select>
          </label>

          <Button
            variant="ghost"
            size="sm"
            onClick={onClearDisplay}
            disabled={!activeMapId && !activeBackdropId}
            className="text-ink hover:bg-ink hover:text-parchment-100"
          >
            &#10005; Clear
          </Button>
        </div>

        {/* Bottom row: Session controls */}
        <div className="flex items-center gap-2 border-t border-ink/20 pt-3">
          {sessionStatus === 'ACTIVE' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onPause}
              disabled={isUpdating}
              className="text-ink hover:bg-ink hover:text-parchment-100"
            >
              &#9208; Pause
            </Button>
          )}
          {sessionStatus === 'PAUSED' && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onResume}
              disabled={isUpdating}
              className="text-ink hover:bg-ink hover:text-parchment-100"
            >
              &#9654; Resume
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            onClick={handleEndClick}
            disabled={isUpdating}
            className={
              showEndConfirm
                ? 'bg-blood-red text-parchment-100 hover:bg-blood-red/80'
                : 'text-blood-red hover:bg-blood-red hover:text-parchment-100'
            }
          >
            {showEndConfirm ? 'Click to Confirm' : '■ End'}
          </Button>
        </div>
      </div>
    </div>
  )
}
