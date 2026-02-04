import * as React from 'react'
import { useParams, Link, useNavigate } from 'react-router'
import type {
  SessionWithDetails,
  SessionResponse,
  SessionStatus,
  SessionInviteResponse,
} from '@gygax/shared'
import { Button } from '../components/ui'
import { SessionTypeChip } from '../components/SessionTypeChip'
import { InvitePlayerModal } from '../components/InvitePlayerModal'
import { SessionGameView } from './SessionGameView'
import { useSessionSocket } from '../hooks/useSessionSocket'
import { useAuth } from '../hooks/useAuth'

const API_URL = import.meta.env.VITE_API_URL || ''

const STATUS_ICONS: Record<SessionStatus, string> = {
  FORMING: '○',
  ACTIVE: '●',
  PAUSED: '◐',
  ENDED: '✕',
}

const STATUS_LABELS: Record<SessionStatus, string> = {
  FORMING: 'FORMING',
  ACTIVE: 'ACTIVE',
  PAUSED: 'PAUSED',
  ENDED: 'ENDED',
}

export function SessionPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [session, setSession] = React.useState<SessionWithDetails | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isUpdating, setIsUpdating] = React.useState(false)
  const [isInviteModalOpen, setIsInviteModalOpen] = React.useState(false)
  const [cancellingInviteId, setCancellingInviteId] = React.useState<string | null>(null)

  // RTC callback refs (will be set by SessionGameView)
  const rtcOfferRef = React.useRef<(fromUserId: string, sdp: RTCSessionDescriptionInit) => void>()
  const rtcAnswerRef = React.useRef<(fromUserId: string, sdp: RTCSessionDescriptionInit) => void>()
  const rtcIceCandidateRef = React.useRef<(fromUserId: string, candidate: RTCIceCandidateInit) => void>()

  // WebSocket connection - disconnect when session is ENDED
  const shouldConnect = !!id && !!session && session.status !== 'ENDED'
  const {
    isConnected,
    connectedUsers,
    sessionState,
    lastMessage,
    fogState,
    tokenState,
    error: wsError,
    mutedUsers,
    sendMessage,
  } = useSessionSocket({
    sessionId: id || '',
    enabled: shouldConnect,
    onRtcOffer: React.useCallback((fromUserId: string, sdp: RTCSessionDescriptionInit) => {
      rtcOfferRef.current?.(fromUserId, sdp)
    }, []),
    onRtcAnswer: React.useCallback((fromUserId: string, sdp: RTCSessionDescriptionInit) => {
      rtcAnswerRef.current?.(fromUserId, sdp)
    }, []),
    onRtcIceCandidate: React.useCallback((fromUserId: string, candidate: RTCIceCandidateInit) => {
      rtcIceCandidateRef.current?.(fromUserId, candidate)
    }, []),
  })

  // Use WebSocket session state if available, otherwise fall back to REST data
  // Merge invites from local session state since we update that locally when inviting
  const currentSession = React.useMemo(() => {
    if (sessionState?.session) {
      return {
        ...sessionState.session,
        // Use local session invites if available (we update these locally after inviting)
        invites: session?.invites ?? sessionState.session.invites,
      }
    }
    return session
  }, [sessionState?.session, session])

  const fetchSession = React.useCallback(async () => {
    if (!id) return

    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/sessions/${id}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Session not found')
        }
        if (response.status === 403) {
          throw new Error('You do not have access to this session')
        }
        throw new Error('Failed to load session')
      }

      const data: SessionResponse = await response.json()
      setSession(data.session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load session')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    fetchSession()
  }, [fetchSession])

  const isDm = currentSession?.dmId === user?.id
  const myParticipant = currentSession?.participants.find((p) => p.userId === user?.id)

  const updateStatus = async (newStatus: SessionStatus) => {
    if (!id) return

    setIsUpdating(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/sessions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to update session')
      }

      const data: SessionResponse = await response.json()
      setSession(data.session)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update session')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleLeave = async () => {
    if (!id) return

    setIsUpdating(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/sessions/${id}/leave`, {
        method: 'POST',
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to leave session')
      }

      navigate('/adventure/sessions')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to leave session')
    } finally {
      setIsUpdating(false)
    }
  }

  const handleInvitePlayer = async (email: string) => {
    if (!id) return

    const response = await fetch(`${API_URL}/api/sessions/${id}/invites`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    })

    if (!response.ok) {
      const data = await response.json()
      throw new Error(data.message || 'Failed to send invite')
    }

    const data: SessionInviteResponse = await response.json()

    // Update local session state with new invite
    setSession((prev) =>
      prev
        ? {
            ...prev,
            invites: [...prev.invites, data.invite],
          }
        : null
    )
  }

  const handleCancelInvite = async (inviteId: string) => {
    if (!id) return

    setCancellingInviteId(inviteId)

    try {
      const response = await fetch(`${API_URL}/api/sessions/${id}/invites/${inviteId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to cancel invite')
      }

      // Remove invite from local session state
      setSession((prev) =>
        prev
          ? {
              ...prev,
              invites: prev.invites.filter((i) => i.id !== inviteId),
            }
          : null
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to cancel invite')
    } finally {
      setCancellingInviteId(null)
    }
  }

  // Build connected users map for online status
  const connectedUserIds = new Set(connectedUsers.map((u) => u.userId))

  if (isLoading) {
    return (
      <div className="mx-auto max-w-4xl p-6 md:p-8">
        <div className="flex items-center justify-center py-16">
          <span className="animate-quill-scratch text-4xl">&#9998;</span>
          <span className="ml-4 font-body text-ink-soft">Loading session...</span>
        </div>
      </div>
    )
  }

  if (error || !currentSession) {
    return (
      <div className="mx-auto max-w-4xl p-6 md:p-8">
        <div className="border-3 border-blood-red bg-parchment-100 p-6 text-center">
          <p className="font-body text-blood-red">{error || 'Session not found'}</p>
          <Link to={isDm ? '/forge' : '/adventure/sessions'}>
            <Button variant="ghost" className="mt-4">
              Go back
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Show game view for ACTIVE or PAUSED sessions
  if (currentSession.status === 'ACTIVE' || currentSession.status === 'PAUSED') {
    return (
      <SessionGameView
        session={currentSession}
        connectedUsers={connectedUsers}
        mutedUsers={mutedUsers}
        sendMessage={sendMessage}
        lastMessage={lastMessage}
        fogState={fogState}
        tokenState={tokenState}
        isConnected={isConnected}
        rtcOfferRef={rtcOfferRef}
        rtcAnswerRef={rtcAnswerRef}
        rtcIceCandidateRef={rtcIceCandidateRef}
        onUpdateStatus={updateStatus}
        isUpdating={isUpdating}
      />
    )
  }

  const participantCount = currentSession.participants.length

  return (
    <div className="mx-auto max-w-4xl p-6 md:p-8">
      <header className="mb-8">
        <div className="mb-4">
          <Link
            to={isDm ? `/adventures/${currentSession.adventureId}` : '/adventure/sessions'}
            className="font-body text-sm text-ink-faded hover:text-ink"
          >
            ← Back to {isDm ? 'Adventure' : 'Sessions'}
          </Link>
        </div>
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-2xl uppercase tracking-wide text-ink md:text-3xl">
              {currentSession.adventure.name}
            </h1>
            <p className="mt-1 font-body text-sm text-ink-faded">
              DM: {currentSession.dm.name}
            </p>
          </div>
          <SessionTypeChip accessType={currentSession.accessType} />
        </div>
      </header>

      {/* Status and Connection */}
      <div className="mb-6 flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="font-body text-lg">{STATUS_ICONS[currentSession.status]}</span>
          <span className="font-display text-sm uppercase tracking-wide text-ink">
            {STATUS_LABELS[currentSession.status]}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span
            className={`h-2 w-2 ${isConnected ? 'bg-green-500' : 'bg-gray-400'}`}
          />
          <span className="font-body text-xs text-ink-faded">
            {isConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
      </div>

      {wsError && (
        <div className="mb-4 border-2 border-amber-500 bg-amber-50 p-3">
          <p className="font-body text-sm text-amber-800">{wsError}</p>
        </div>
      )}

      {/* Player Info (for players) */}
      {!isDm && myParticipant && (
        <div className="mb-6 border-3 border-ink bg-parchment-200 p-4">
          <p className="font-body text-sm text-ink">
            Playing as:{' '}
            <strong>
              {myParticipant.character.name} ({myParticipant.character.class}, Level{' '}
              {myParticipant.character.level})
            </strong>
          </p>
        </div>
      )}

      {/* Waiting message (FORMING) */}
      {currentSession.status === 'FORMING' && !isDm && (
        <div className="mb-6 text-center">
          <p className="font-body text-ink-soft">Waiting for the DM to start the session...</p>
        </div>
      )}

      {/* Players List */}
      <section className="mb-8">
        <h2 className="mb-4 font-display text-lg uppercase tracking-wide text-ink">
          Players ({participantCount}/8)
        </h2>
        <div className="space-y-2 border-3 border-ink bg-parchment-100 p-4">
          {/* DM */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-display text-sm text-ink">★</span>
              <span className="font-body text-ink">
                {currentSession.dm.name} <span className="text-ink-faded">(DM)</span>
              </span>
            </div>
            <span
              className={`h-2 w-2 ${
                connectedUserIds.has(currentSession.dmId) ? 'bg-green-500' : 'bg-gray-300'
              }`}
              title={connectedUserIds.has(currentSession.dmId) ? 'Online' : 'Offline'}
            />
          </div>

          {/* Participants */}
          {currentSession.participants.map((participant) => (
            <div key={participant.id} className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-4" />
                <span className="font-body text-ink">
                  {participant.user.name} —{' '}
                  <span className="text-ink-faded">
                    {participant.character.name} ({participant.character.class.slice(0, 3)}{' '}
                    {participant.character.level})
                  </span>
                </span>
              </div>
              <span
                className={`h-2 w-2 ${
                  connectedUserIds.has(participant.userId) ? 'bg-green-500' : 'bg-gray-300'
                }`}
                title={connectedUserIds.has(participant.userId) ? 'Online' : 'Offline'}
              />
            </div>
          ))}

          {participantCount === 0 && (
            <p className="py-2 text-center font-body text-sm text-ink-faded">
              No players have joined yet
            </p>
          )}
        </div>
      </section>

      {/* Pending Invites (DM only, INVITE sessions) */}
      {isDm && currentSession.accessType === 'INVITE' && currentSession.status !== 'ENDED' && (
        <section className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg uppercase tracking-wide text-ink">
              Pending Invites
            </h2>
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsInviteModalOpen(true)}
            >
              + Invite Player
            </Button>
          </div>
          <div className="space-y-2 border-3 border-ink bg-parchment-100 p-4">
            {currentSession.invites.filter((i) => !i.acceptedAt && !i.declinedAt).length === 0 ? (
              <p className="py-2 text-center font-body text-sm text-ink-faded">
                No pending invites
              </p>
            ) : (
              currentSession.invites
                .filter((i) => !i.acceptedAt && !i.declinedAt)
                .map((invite) => (
                  <div key={invite.id} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-body text-sm text-ink-faded">✉</span>
                      <span className="font-body text-ink">
                        {invite.user?.name || invite.email}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleCancelInvite(invite.id)}
                      loading={cancellingInviteId === invite.id}
                      loadingText="..."
                      className="text-blood-red"
                    >
                      Cancel
                    </Button>
                  </div>
                ))
            )}
          </div>
        </section>
      )}

      {/* Actions */}
      <section>
        {error && (
          <div className="mb-4 border-2 border-blood-red bg-red-50 p-3">
            <p className="font-body text-sm text-blood-red">{error}</p>
          </div>
        )}

        <div className="flex flex-wrap gap-3">
          {isDm ? (
            // DM Controls
            <>
              {currentSession.status === 'FORMING' && (
                <>
                  <Button
                    variant="primary"
                    onClick={() => updateStatus('ACTIVE')}
                    disabled={isUpdating}
                    loading={isUpdating}
                    loadingText="Starting..."
                  >
                    Start Session
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => updateStatus('ENDED')}
                    disabled={isUpdating}
                  >
                    Cancel
                  </Button>
                </>
              )}
              {currentSession.status === 'ACTIVE' && (
                <>
                  <Button
                    variant="default"
                    onClick={() => updateStatus('PAUSED')}
                    disabled={isUpdating}
                  >
                    Pause
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => updateStatus('FORMING')}
                    disabled={isUpdating}
                  >
                    Re-open
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => updateStatus('ENDED')}
                    disabled={isUpdating}
                  >
                    End Session
                  </Button>
                </>
              )}
              {currentSession.status === 'PAUSED' && (
                <>
                  <Button
                    variant="primary"
                    onClick={() => updateStatus('ACTIVE')}
                    disabled={isUpdating}
                  >
                    Resume
                  </Button>
                  <Button
                    variant="default"
                    onClick={() => updateStatus('FORMING')}
                    disabled={isUpdating}
                  >
                    Re-open
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => updateStatus('ENDED')}
                    disabled={isUpdating}
                  >
                    End Session
                  </Button>
                </>
              )}
              {currentSession.status === 'ENDED' && (
                <p className="font-body text-ink-faded">This session has ended.</p>
              )}
            </>
          ) : (
            // Player Controls
            <>
              {currentSession.status !== 'ENDED' && (
                <Button
                  variant="destructive"
                  onClick={handleLeave}
                  disabled={isUpdating}
                  loading={isUpdating}
                  loadingText="Leaving..."
                >
                  Leave Session
                </Button>
              )}
              {currentSession.status === 'ENDED' && (
                <p className="font-body text-ink-faded">This session has ended.</p>
              )}
            </>
          )}
        </div>
      </section>

      <InvitePlayerModal
        open={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        onSubmit={handleInvitePlayer}
        sessionName={currentSession.adventure.name}
      />
    </div>
  )
}
