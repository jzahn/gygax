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
  WSRtcOfferRelayed,
  WSRtcAnswerRelayed,
  WSRtcIceCandidateRelayed,
  WSRtcMuteStateRelayed,
  WSFogState,
  WSTokenState,
} from '@gygax/shared'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'
const WS_URL = API_URL.replace(/^http/, 'ws')

interface UseSessionSocketOptions {
  sessionId: string
  enabled?: boolean
  onRtcOffer?: (fromUserId: string, sdp: RTCSessionDescriptionInit) => void
  onRtcAnswer?: (fromUserId: string, sdp: RTCSessionDescriptionInit) => void
  onRtcIceCandidate?: (fromUserId: string, candidate: RTCIceCandidateInit) => void
}

interface UseSessionSocketReturn {
  isConnected: boolean
  connectedUsers: WSConnectedUser[]
  sessionState: WSSessionState | null
  lastMessage: WSMessage | null
  fogState: WSFogState | null
  tokenState: WSTokenState | null
  error: string | null
  mutedUsers: Set<string>
  sendMessage: (type: string, payload: unknown) => void
}

export function useSessionSocket({
  sessionId,
  enabled = true,
  onRtcOffer,
  onRtcAnswer,
  onRtcIceCandidate,
}: UseSessionSocketOptions): UseSessionSocketReturn {
  const [isConnected, setIsConnected] = useState(false)
  const [connectedUsers, setConnectedUsers] = useState<WSConnectedUser[]>([])
  const [sessionState, setSessionState] = useState<WSSessionState | null>(null)
  const [lastMessage, setLastMessage] = useState<WSMessage | null>(null)
  const [fogState, setFogState] = useState<WSFogState | null>(null)
  const [tokenState, setTokenState] = useState<WSTokenState | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [mutedUsers, setMutedUsers] = useState<Set<string>>(new Set())

  const socketRef = useRef<WebSocket | null>(null)
  const reconnectTimeoutRef = useRef<number | null>(null)
  const reconnectAttemptRef = useRef(0)
  const pingIntervalRef = useRef<number | null>(null)
  const mountedRef = useRef(true)
  const enabledRef = useRef(enabled)

  // Store callbacks in refs to avoid dependency issues
  const onRtcOfferRef = useRef(onRtcOffer)
  const onRtcAnswerRef = useRef(onRtcAnswer)
  const onRtcIceCandidateRef = useRef(onRtcIceCandidate)

  useEffect(() => {
    onRtcOfferRef.current = onRtcOffer
    onRtcAnswerRef.current = onRtcAnswer
    onRtcIceCandidateRef.current = onRtcIceCandidate
  }, [onRtcOffer, onRtcAnswer, onRtcIceCandidate])

  // Keep enabledRef in sync with enabled prop
  useEffect(() => {
    enabledRef.current = enabled
  }, [enabled])

  const sendMessage = useCallback((type: string, payload: unknown) => {
    if (socketRef.current?.readyState === WebSocket.OPEN) {
      socketRef.current.send(JSON.stringify({ type, payload }))
    }
  }, [])

  const connect = useCallback(async () => {
    if (!enabled || !sessionId || !mountedRef.current) return

    // Close existing socket before creating a new one
    if (socketRef.current) {
      socketRef.current.onclose = null // Prevent onclose from firing during cleanup
      socketRef.current.close()
      socketRef.current = null
    }

    // Clear any existing ping interval
    if (pingIntervalRef.current) {
      clearInterval(pingIntervalRef.current)
      pingIntervalRef.current = null
    }

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
            case 'rtc:offer': {
              const payload = message.payload as WSRtcOfferRelayed
              onRtcOfferRef.current?.(payload.fromUserId, payload.sdp)
              break
            }
            case 'rtc:answer': {
              const payload = message.payload as WSRtcAnswerRelayed
              onRtcAnswerRef.current?.(payload.fromUserId, payload.sdp)
              break
            }
            case 'rtc:ice-candidate': {
              const payload = message.payload as WSRtcIceCandidateRelayed
              onRtcIceCandidateRef.current?.(payload.fromUserId, payload.candidate)
              break
            }
            case 'rtc:mute-state': {
              const payload = message.payload as WSRtcMuteStateRelayed
              setMutedUsers((prev) => {
                const next = new Set(prev)
                if (payload.muted) {
                  next.add(payload.userId)
                } else {
                  next.delete(payload.userId)
                }
                return next
              })
              break
            }
            // Handle fog and token state directly to avoid message batching issues
            case 'fog:state': {
              const payload = message.payload as WSFogState
              setFogState(payload)
              break
            }
            case 'token:state': {
              const payload = message.payload as WSTokenState
              setTokenState(payload)
              break
            }
          }
        } catch {
          // Invalid JSON - ignore
        }
      }

      ws.onclose = () => {
        // Clear ping interval
        if (pingIntervalRef.current) {
          clearInterval(pingIntervalRef.current)
          pingIntervalRef.current = null
        }

        if (!mountedRef.current) return

        setIsConnected(false)

        // Schedule reconnect with exponential backoff (only if still mounted and enabled)
        // Use enabledRef.current to get current value, not stale closure value
        if (enabledRef.current && mountedRef.current) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptRef.current), 30000)
          reconnectAttemptRef.current += 1

          reconnectTimeoutRef.current = window.setTimeout(() => {
            if (mountedRef.current && enabledRef.current) {
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
        reconnectTimeoutRef.current = null
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
        pingIntervalRef.current = null
      }

      // Close socket - null out handlers first to prevent any callbacks
      if (socketRef.current) {
        socketRef.current.onopen = null
        socketRef.current.onmessage = null
        socketRef.current.onclose = null
        socketRef.current.onerror = null
        socketRef.current.close(1000, 'Component unmounting')
        socketRef.current = null
      }
    }
  }, [connect])

  // Disconnect when enabled becomes false (e.g., navigating away from session)
  useEffect(() => {
    if (!enabled && socketRef.current) {
      // Clear any pending reconnect
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current)
        reconnectTimeoutRef.current = null
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current)
        pingIntervalRef.current = null
      }

      // Close socket cleanly
      socketRef.current.onopen = null
      socketRef.current.onmessage = null
      socketRef.current.onclose = null
      socketRef.current.onerror = null
      socketRef.current.close(1000, 'Session disabled')
      socketRef.current = null
      setIsConnected(false)
    }
  }, [enabled])

  return {
    isConnected,
    connectedUsers,
    sessionState,
    lastMessage,
    fogState,
    tokenState,
    error,
    mutedUsers,
    sendMessage,
  }
}
