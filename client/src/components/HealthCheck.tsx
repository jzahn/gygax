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
    return <div>Loading health status...</div>
  }

  if (error) {
    return (
      <div>
        <h2>Health Check</h2>
        <p>
          <strong>API reachable:</strong> ✗
        </p>
        <p>
          <strong>Error:</strong> {error}
        </p>
      </div>
    )
  }

  if (!health) {
    return <div>No health data available</div>
  }

  return (
    <div>
      <h2>Health Check</h2>
      <p>
        <strong>Status:</strong> {health.status}
      </p>
      <p>
        <strong>Last checked:</strong> {new Date(health.timestamp).toLocaleString()}
      </p>

      <h3>Services</h3>
      <p>
        <strong>API reachable:</strong> {health.services.api.status === 'up' ? '✓' : '✗'} (
        {health.services.api.responseTime}ms)
      </p>
      <p>
        <strong>Database connected:</strong> {health.services.database.status === 'up' ? '✓' : '✗'}{' '}
        ({health.services.database.responseTime}ms)
        {health.services.database.error && (
          <span style={{ color: 'red' }}> - {health.services.database.error}</span>
        )}
      </p>
    </div>
  )
}
