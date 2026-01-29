import * as React from 'react'
import { useNavigate } from 'react-router'
import type {
  SessionListItem,
  SessionListResponse,
  Character,
  CharacterListResponse,
  SessionParticipantResponse,
} from '@gygax/shared'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { SessionTypeChip } from './SessionTypeChip'
import { SelectCharacterModal } from './SelectCharacterModal'
import { useSessionBrowseSSE } from '../hooks/useSessionBrowseSSE'

const API_URL = import.meta.env.VITE_API_URL || ''

interface JoinSessionModalProps {
  open: boolean
  onClose: () => void
}

const STATUS_ICONS: Record<string, string> = {
  FORMING: '○',
  ACTIVE: '●',
}

export function JoinSessionModal({ open, onClose }: JoinSessionModalProps) {
  const navigate = useNavigate()
  const [sessions, setSessions] = React.useState<SessionListItem[]>([])
  const [characters, setCharacters] = React.useState<Character[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [joiningSession, setJoiningSession] = React.useState<SessionListItem | null>(null)
  const [isJoining, setIsJoining] = React.useState(false)

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [sessionsRes, charactersRes] = await Promise.all([
        fetch(`${API_URL}/api/sessions?browse=true`, { credentials: 'include' }),
        fetch(`${API_URL}/api/characters`, { credentials: 'include' }),
      ])

      if (!sessionsRes.ok || !charactersRes.ok) {
        throw new Error('Failed to load data')
      }

      const [sessionsData, charactersData]: [SessionListResponse, CharacterListResponse] =
        await Promise.all([sessionsRes.json(), charactersRes.json()])

      setSessions(sessionsData.sessions)
      setCharacters(charactersData.characters)
    } catch {
      setError('Failed to load sessions')
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Initial fetch when modal opens
  React.useEffect(() => {
    if (open) {
      fetchData()
    }
  }, [open, fetchData])

  // SSE for real-time session updates
  useSessionBrowseSSE({
    enabled: open && !isLoading,
    onSessionCreated: (session) => {
      setSessions((prev) => {
        // Don't add if already exists
        if (prev.some((s) => s.id === session.id)) return prev
        return [session, ...prev]
      })
    },
    onSessionUpdated: (session) => {
      setSessions((prev) =>
        prev.map((s) => (s.id === session.id ? session : s))
      )
    },
    onSessionEnded: (sessionId) => {
      setSessions((prev) => prev.filter((s) => s.id !== sessionId))
    },
  })

  const handleJoinClick = (session: SessionListItem) => {
    if (characters.length === 0) {
      // No characters - show message
      setError('You need a character to join. Create one first.')
      return
    }

    if (characters.length === 1) {
      // Auto-select single character
      handleJoinSession(session.id, characters[0].id)
    } else {
      // Show character selection
      setJoiningSession(session)
    }
  }

  const handleJoinSession = async (sessionId: string, characterId: string) => {
    setIsJoining(true)
    setError(null)

    try {
      const response = await fetch(`${API_URL}/api/sessions/${sessionId}/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ characterId }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.message || 'Failed to join session')
      }

      const _data: SessionParticipantResponse = await response.json()
      onClose()
      navigate(`/sessions/${sessionId}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to join session')
    } finally {
      setIsJoining(false)
      setJoiningSession(null)
    }
  }

  return (
    <>
      <Dialog open={open && !joiningSession} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Join a Session</DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="animate-quill-scratch text-2xl">&#9998;</span>
              <span className="ml-3 font-body text-ink-soft">Finding sessions...</span>
            </div>
          ) : error ? (
            <div className="py-4 text-center">
              <p className="font-body text-blood-red">{error}</p>
              <Button variant="ghost" onClick={fetchData} className="mt-2">
                Try again
              </Button>
            </div>
          ) : sessions.length === 0 ? (
            <div className="py-8 text-center">
              <p className="font-body text-ink-soft">No quests await... check back later.</p>
              <p className="mt-2 font-body text-sm text-ink-faded">
                Sessions appear here when a DM creates one you can join.
              </p>
            </div>
          ) : (
            <div className="max-h-[60vh] space-y-4 overflow-y-auto py-2">
              <p className="font-body text-xs text-ink-faded">
                Sorted: Invited → Campaign → Open
              </p>

              <div className="space-y-2">
                {sessions.map((session) => (
                  <div
                    key={session.id}
                    className="border-3 border-ink bg-parchment-100 p-3"
                  >
                    <div className="mb-2 flex items-center gap-2">
                      <SessionTypeChip accessType={session.accessType} />
                      <span className="font-body text-xs text-ink-faded">
                        {STATUS_ICONS[session.status]} {session.status}
                      </span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-display text-sm uppercase tracking-wide text-ink">
                          {session.adventure.name}
                        </p>
                        <p className="font-body text-xs text-ink-faded">
                          DM: {session.dm.name} • {session.participantCount} player
                          {session.participantCount !== 1 ? 's' : ''}
                        </p>
                      </div>
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => handleJoinClick(session)}
                        disabled={isJoining}
                      >
                        Join
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Character Selection Modal */}
      <SelectCharacterModal
        open={!!joiningSession}
        onClose={() => setJoiningSession(null)}
        onSelect={async (characterId) => {
          if (joiningSession) {
            await handleJoinSession(joiningSession.id, characterId)
          }
        }}
        characters={characters}
        sessionName={joiningSession?.adventure.name}
      />
    </>
  )
}
