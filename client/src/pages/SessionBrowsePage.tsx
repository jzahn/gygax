import * as React from 'react'
import { useNavigate, Link } from 'react-router'
import type {
  SessionListItem,
  SessionListResponse,
  Character,
  CharacterListResponse,
} from '@gygax/shared'
import { Button } from '../components/ui'
import { SessionTypeChip } from '../components/SessionTypeChip'
import { SelectCharacterModal } from '../components/SelectCharacterModal'

const API_URL = import.meta.env.VITE_API_URL || ''

const STATUS_ICONS: Record<string, string> = {
  FORMING: '○',
  ACTIVE: '●',
}

export function SessionBrowsePage() {
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

  React.useEffect(() => {
    fetchData()
  }, [fetchData])

  const handleJoinClick = (session: SessionListItem) => {
    if (characters.length === 0) {
      setError('You need a character to join. Create one first.')
      return
    }

    if (characters.length === 1) {
      handleJoinSession(session.id, characters[0].id)
    } else {
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

      await response.json()
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
      <div className="mx-auto max-w-4xl p-6 md:p-8">
        <header className="mb-8">
          <div className="mb-4">
            <Link
              to="/adventure"
              className="font-body text-sm text-ink-faded hover:text-ink"
            >
              ← Back to Quest
            </Link>
          </div>
          <h1 className="font-display text-2xl uppercase tracking-wide text-ink md:text-3xl">
            Find a Session
          </h1>
          <p className="mt-1 font-body italic text-ink-soft">
            Browse available sessions and join an adventure
          </p>
        </header>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <span className="animate-quill-scratch text-4xl">&#9998;</span>
            <span className="ml-4 font-body text-ink-soft">Finding sessions...</span>
          </div>
        ) : error ? (
          <div className="border-3 border-blood-red bg-parchment-100 p-6 text-center">
            <p className="font-body text-blood-red">{error}</p>
            <Button variant="ghost" onClick={fetchData} className="mt-4">
              Try again
            </Button>
          </div>
        ) : sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 text-ink-soft">
              &#9876; &#9552;&#9552;&#9552;&#9552;&#9552;&#9552; &#9876;
            </div>
            <h2 className="font-display text-xl uppercase tracking-wide text-ink">
              No Sessions Available
            </h2>
            <p className="mt-2 max-w-md font-body text-ink-soft">
              No quests await... check back later. Sessions appear here when a DM creates one you
              can join.
            </p>
          </div>
        ) : (
          <div>
            <p className="mb-4 font-body text-xs text-ink-faded">
              Sorted: Invited → Campaign → Open
            </p>

            <div className="space-y-3">
              {sessions.map((session) => (
                <div
                  key={session.id}
                  className="border-3 border-ink bg-parchment-100 p-4 shadow-brutal"
                >
                  <div className="mb-2 flex items-center gap-2">
                    <SessionTypeChip accessType={session.accessType} />
                    <span className="font-body text-xs text-ink-faded">
                      {STATUS_ICONS[session.status]} {session.status}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-lg uppercase tracking-wide text-ink">
                        {session.adventure.name}
                      </p>
                      <p className="font-body text-sm text-ink-faded">
                        DM: {session.dm.name} • {session.participantCount} player
                        {session.participantCount !== 1 ? 's' : ''}
                      </p>
                    </div>
                    <Button
                      variant="primary"
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
      </div>

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
