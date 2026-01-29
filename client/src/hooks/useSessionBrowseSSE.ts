import { useEffect, useRef, useCallback } from 'react'
import type { SessionListItem } from '@gygax/shared'

const API_URL = import.meta.env.VITE_API_URL || ''

interface SessionEvent {
  event: 'session:created' | 'session:updated' | 'session:ended'
  session?: SessionListItem
  sessionId?: string
}

interface UseSessionBrowseSSEOptions {
  enabled?: boolean
  onSessionCreated?: (session: SessionListItem) => void
  onSessionUpdated?: (session: SessionListItem) => void
  onSessionEnded?: (sessionId: string) => void
}

export function useSessionBrowseSSE({
  enabled = true,
  onSessionCreated,
  onSessionUpdated,
  onSessionEnded,
}: UseSessionBrowseSSEOptions) {
  const eventSourceRef = useRef<EventSource | null>(null)
  const mountedRef = useRef(true)

  const connect = useCallback(() => {
    if (!enabled || eventSourceRef.current) return

    const eventSource = new EventSource(`${API_URL}/api/sessions/browse/events`, {
      withCredentials: true,
    })

    eventSource.addEventListener('session:created', (event) => {
      if (!mountedRef.current) return
      try {
        const data: SessionEvent = JSON.parse(event.data)
        if (data.session && onSessionCreated) {
          onSessionCreated(data.session)
        }
      } catch {
        // Invalid JSON - ignore
      }
    })

    eventSource.addEventListener('session:updated', (event) => {
      if (!mountedRef.current) return
      try {
        const data: SessionEvent = JSON.parse(event.data)
        if (data.session && onSessionUpdated) {
          onSessionUpdated(data.session)
        }
      } catch {
        // Invalid JSON - ignore
      }
    })

    eventSource.addEventListener('session:ended', (event) => {
      if (!mountedRef.current) return
      try {
        const data: SessionEvent = JSON.parse(event.data)
        if (data.sessionId && onSessionEnded) {
          onSessionEnded(data.sessionId)
        }
      } catch {
        // Invalid JSON - ignore
      }
    })

    eventSource.onerror = () => {
      // EventSource will automatically reconnect
      // We don't need to do anything here
    }

    eventSourceRef.current = eventSource
  }, [enabled, onSessionCreated, onSessionUpdated, onSessionEnded])

  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
      eventSourceRef.current = null
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true

    if (enabled) {
      connect()
    }

    return () => {
      mountedRef.current = false
      disconnect()
    }
  }, [enabled, connect, disconnect])

  return { disconnect }
}
