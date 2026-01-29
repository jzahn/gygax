import { useState, useEffect, useRef, useCallback } from 'react'
import type {
  WSMessage,
  WSSessionState,
  WSConnectedUser,
  WSUserConnected,
  WSUserDisconnected,
  WSSessionUpdated,
  WSParticipantJoined,
  WSParticipantLeft,
} from '@gygax/shared'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const WS_URL = API_URL.replace(/^http/, 'ws')

interface UseSessionSocketOptions {
  sessionId: string
  enabled?: boolean
}

interface UseSessionSocketReturn {
  isConnected: boolean
  connectedUsers: WSConnectedUser[]
  sessionState: WSSessionState | null
  lastMessage: WSMessage | null
  error: string | null
}

export function useSessionSocket({
  sessionId,
  enabled = true,
}: UseSessionSocketOptions): UseSessionSocketReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [connectedUsers, setConnectedUsers] = useState<WSConnectedUser[]>([])
  const [sessionState, setSessionState] = useState<WSSessionState | null>(null)
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null)
  const [error, setError] = useState<string | null>(null)

  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const pingIntervalRef = useRef<number | null>(null)
  const mountedRef = useRef(true)

  const connect = useCallback(async () => {
    if (!enabled || !sessionId) return

    try {
      // Get WS token from REST API
      const tokenResponse = await fetch(`${API_URL}/api/sessions/${sessionId}/ws-token`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!tokenResponse.ok) {
        const data = await tokenResponse.json()
        setError(data.message || 'Failed to get connection token')
        return
      }

      const { token } = await tokenResponse.json()

      // Connect to WebSocket
      const ws = new WebSocket(`${WS_URL}/ws/sessions/${sessionId}?token=${token}`)

      ws.onopen = () => {
        if (!mountedRef.current) {
          ws.close()
          return
        }
        setIsConnected(true)
        setError(null)
        reconnectAttemptRef.current = 0

        // Start ping interval
        pingIntervalRef.current = window.setInterval(() => {
          if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({ type: 'ping', payload: {} }))
          }
        }, 30000)
      }

      ws.onmessage = (event) => {
        if (!mountedRef.current) return

        try {
          const message: WSMessage = JSON.parse(event.data)
          setLastMessage(message)

          switch (message.type) {
            case 'session:state': {
              const payload = message.payload as WSSessionState
              setSessionState(payload)
              setConnectedUsers(payload.connectedUsers)
              break
            }
            case 'session:updated': {
              const payload = message.payload as WSSessionUpdated
              setSessionState((prev) =>
                prev
                  ? {
                      ...prev,
                      session: {
                        ...prev.session,
                        status: payload.status,
                        activeMapId: payload.activeMapId,
                        activeBackdropId: payload.activeBackdropId,
                        pausedAt: payload.pausedAt,
                        endedAt: payload.endedAt,
                      },
                    }
                  : null
              )
              break
            }
            case 'user:connected': {
              const payload = message.payload as WSUserConnected
              setConnectedUsers((prev) => {
                // Remove if already exists (reconnect case)
                const filtered = prev.filter((u) => u.userId !== payload.userId)
                return [...filtered, payload]
              })
              break
            }
            case 'user:disconnected': {
              const payload = message.payload as WSUserDisconnected
              setConnectedUsers((prev) => prev.filter((u) => u.userId !== payload.userId))
              break
            }
            case 'participant:joined': {
              const payload = message.payload as WSParticipantJoined
              setSessionState((prev) =>
                prev
                  ? {
                      ...prev,
                      session: {
                        ...prev.session,
                        participants: [...prev.session.participants, payload.participant],
                      },
                    }
                  : null
              )
              break
            }
            case 'participant:left': {
              const payload = message.payload as WSParticipantLeft
              setSessionState((prev) =>
                prev
                  ? {
                      ...prev,
                      session: {
                        ...prev.session,
                        participants: prev.session.participants.filter(
                          (p) => p.userId !== payload.userId
                        ),
                      },
                    }
                  : null
              )
              break
            }
            case 'error': {
              const payload = message.payload as { message: string }
              setError(payload.message)
              break
            }
          }
        } catch {
          // Invalid JSON - ignore
        }
      }

      ws.onclose = () => {
        if (!mountedRef.current) return

        setIsConnected(false)

        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = null
        }

        // Schedule reconnect with exponential backoff
        if (enabled) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000)
          reconnectAttemptRef.current += 1

          reconnectTimeoutRef.current = window.setTimeout(() => {
            if (mountedRef.current && enabled) {
              connect()
            }
          }, delay)
        }
      }

      ws.onerror = () => {
        // Error event is always followed by close, handle reconnect there
      }

      socketRef.current = ws
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    }
  }, [sessionId, enabled])

  // Connect on mount, cleanup on unmount
  useEffect(() => {
    mountedRef.current = true
    connect()

    return () => {
      mountedRef.current = false

      // Clear timers
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
      }

      // Close socket
      if (socketRef.current) {
        socketRef.current.close()
        socketRef.current = null
      }
    }
  }, [connect])

  return {
    isConnected,
    connectedUsers,
    sessionState,
    lastMessage,
    error,
  }
}
