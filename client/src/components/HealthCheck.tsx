import { useEffect, useState } from 'react'
import type { HealthCheckResponse } from '@gygax/shared'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function HealthCheck() {
  const [health, setHealth] = useState<HealthCheckResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const fetchHealth = async () => {
    try {
      setLoading(true)
      const response = await fetch(`${API_URL}/api/health`)
      if (!response.ok) {
        throw new Error(`HTTP error: ${response.status}`)
      }
      const data: HealthCheckResponse = await response.json()
      setHealth(data)
      setError(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch health status')
      setHealth(null)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchHealth()

    const interval = setInterval(fetchHealth, 30000)

    return () => clearInterval(interval)
  }, [])

  if (loading && !health) {
    return (
      <div className="font-body text-ink-soft italic">
        <span className="animate-quill-scratch inline-block mr-2">&#9998;</span>
        Checking realm status...
      </div>
    )
  }

  if (error) {
    return (
      <div className="font-body text-sm space-y-1">
        <h3 className="font-medium text-ink uppercase tracking-wider text-xs">Realm Status</h3>
        <p className="text-blood-red">
          <span className="mr-1">&#9876;</span>
          The realm is unreachable: {error}
        </p>
      </div>
    )
  }

  if (!health) {
    return <div className="font-body text-ink-faded italic">No status available</div>
  }

  return (
    <div className="font-body text-sm space-y-2">
      <h3 className="font-medium text-ink uppercase tracking-wider text-xs">Realm Status</h3>
      <div className="space-y-1 text-ink-soft">
        <p>
          <span className="text-ink">Status:</span>{' '}
          <span className={health.status === 'healthy' ? 'text-ink' : 'text-blood-red'}>
            {health.status === 'healthy' ? 'All is well' : 'Trouble brewing'}
          </span>
        </p>
        <p>
          <span className="text-ink">API:</span>{' '}
          {health.services.api.status === 'up' ? (
            <span>Responding ({health.services.api.responseTime}ms)</span>
          ) : (
            <span className="text-blood-red">Unreachable</span>
          )}
        </p>
        <p>
          <span className="text-ink">Database:</span>{' '}
          {health.services.database.status === 'up' ? (
            <span>Connected ({health.services.database.responseTime}ms)</span>
          ) : (
            <span className="text-blood-red">
              Disconnected
              {health.services.database.error && ` - ${health.services.database.error}`}
            </span>
          )}
        </p>
      </div>
    </div>
  )
}
