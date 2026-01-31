import { Link } from 'react-router'
import type { SessionStatus } from '@gygax/shared'
import { Button } from './ui'

interface SessionStatusBannerProps {
  status: SessionStatus
  isDm: boolean
  adventureId: string
  className?: string
}

export function SessionStatusBanner({
  status,
  isDm,
  adventureId,
  className = '',
}: SessionStatusBannerProps) {
  if (status !== 'ENDED') {
    return null
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
