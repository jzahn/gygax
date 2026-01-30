import { Link } from 'react-router'
import type { SessionStatus } from '@gygax/shared'
import { Button } from './ui'

interface SessionStatusBannerProps {
  status: SessionStatus
  isDm: boolean
  adventureId: string
  onResume?: () => void
  className?: string
}

export function SessionStatusBanner({
  status,
  isDm,
  adventureId,
  onResume,
  className = '',
}: SessionStatusBannerProps) {
  if (status === 'ACTIVE' || status === 'FORMING') {
    return null
  }

  if (status === 'PAUSED') {
    return (
      <div
        className={`border-b-3 border-dashed border-ink bg-parchment-200 px-4 py-3 text-center ${className}`}
      >
        <div className="flex items-center justify-center gap-3">
          <span className="font-display text-sm uppercase tracking-wide text-ink">
            &#9208; SESSION PAUSED
          </span>
          {isDm ? (
            <Button variant="primary" size="sm" onClick={onResume}>
              Resume
            </Button>
          ) : (
            <span className="font-body text-sm text-ink-faded">
              — The Dungeon Master has paused the session
            </span>
          )}
        </div>
      </div>
    )
  }

  // ENDED
  return (
    <div
      className={`border-b-3 border-ink bg-parchment-300 px-4 py-4 text-center ${className}`}
    >
      <p className="mb-3 font-display text-sm uppercase tracking-wide text-ink">
        SESSION ENDED — The adventure concludes... for now.
      </p>
      <Link to={isDm ? `/adventures/${adventureId}` : '/adventure/sessions'}>
        <Button variant="default" size="sm">
          {isDm ? 'Return to Adventure' : 'Return to Sessions'}
        </Button>
      </Link>
    </div>
  )
}
