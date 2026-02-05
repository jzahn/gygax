import * as React from 'react'
import { useNavigate } from 'react-router'
import type {
  SessionListItem,
  SessionListResponse,
  Adventure,
  AdventureListResponse,
  SessionAccessType,
  SessionResponse,
  CampaignListItem,
  CampaignListResponse,
} from '@gygax/shared'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog'
import { Button } from './ui/button'
import { Divider } from './ui/divider'
import { SessionTypeChip } from './SessionTypeChip'

const API_URL = import.meta.env.VITE_API_URL || ''

interface StartSessionModalProps {
  open: boolean
  onClose: () => void
}

const STATUS_ICONS: Record<string, string> = {
  FORMING: '○',
  ACTIVE: '●',
  PAUSED: '◐',
}

export function StartSessionModal({ open, onClose }: StartSessionModalProps) {
  const navigate = useNavigate()
  const [sessions, setSessions] = React.useState<SessionListItem[]>([])
  const [adventures, setAdventures] = React.useState<Adventure[]>([])
  const [campaigns, setCampaigns] = React.useState<CampaignListItem[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [creatingForAdventure, setCreatingForAdventure] = React.useState<Adventure | null>(null)
  const [isCreating, setIsCreating] = React.useState(false)

  const fetchData = React.useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const [sessionsRes, adventuresRes, campaignsRes] = await Promise.all([
        fetch(`${API_URL}/api/sessions`, { credentials: 'include' }),
        fetch(`${API_URL}/api/adventures?all=true`, { credentials: 'include' }),
        fetch(`${API_URL}/api/campaigns`, { credentials: 'include' }),
      ])

      if (!sessionsRes.ok || !adventuresRes.ok || !campaignsRes.ok) {
        throw new Error('Failed to load data')
      }

      const [sessionsData, adventuresData, campaignsData]: [
        SessionListResponse,
        AdventureListResponse,
        CampaignListResponse
      ] = await Promise.all([
        sessionsRes.json(),
        adventuresRes.json(),
        campaignsRes.json(),
      ])

      // Filter to only show forming/active/paused sessions
      const activeSessions = sessionsData.sessions.filter(
        (s) => s.status !== 'ENDED'
      )
      setSessions(activeSessions)

      // Get adventure IDs that already have active sessions
      const adventureIdsWithSessions = new Set(activeSessions.map((s) => s.adventureId))

      // Filter adventures to those without active sessions
      const availableAdventures = adventuresData.adventures.filter(
        (a) => !adventureIdsWithSessions.has(a.id)
      )
      setAdventures(availableAdventures)

      setCampaigns(campaignsData.campaigns)
    } catch {
      setError('Failed to load data')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    if (open) {
      fetchData()
    }
  }, [open, fetchData])

  const handleViewSession = (sessionId: string) => {
    onClose()
    navigate(`/sessions/${sessionId}`)
  }

  const handleCreateSession = async (adventure: Adventure, accessType: SessionAccessType) => {
    setIsCreating(true)
    try {
      const response = await fetch(`${API_URL}/api/adventures/${adventure.id}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ accessType }),
      })

      if (!response.ok) {
        throw new Error('Failed to create session')
      }

      const data: SessionResponse = await response.json()
      onClose()
      navigate(`/sessions/${data.session.id}`)
    } catch {
      setError('Failed to create session')
    } finally {
      setIsCreating(false)
      setCreatingForAdventure(null)
    }
  }

  const getCampaignName = (adventure: Adventure) => {
    if (!adventure.campaignId) return null
    const campaign = campaigns.find((c) => c.id === adventure.campaignId)
    return campaign?.name || null
  }

  return (
    <>
      <Dialog open={open && !creatingForAdventure} onOpenChange={(isOpen) => !isOpen && onClose()}>
        <DialogContent className="max-w-lg" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Start a Session</DialogTitle>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <span className="animate-quill-scratch text-2xl">&#9998;</span>
              <span className="ml-3 font-body text-ink-soft">Loading...</span>
            </div>
          ) : error ? (
            <div className="py-4 text-center">
              <p className="font-body text-blood-red">{error}</p>
              <Button variant="ghost" onClick={fetchData} className="mt-2">
                Try again
              </Button>
            </div>
          ) : (
            <div className="max-h-[60vh] space-y-6 overflow-y-auto py-2">
              {/* Existing Sessions */}
              {sessions.length > 0 && (
                <section>
                  <h3 className="mb-3 font-display text-sm uppercase tracking-wide text-ink">
                    Your Sessions
                  </h3>
                  <div className="space-y-2">
                    {sessions.map((session) => (
                      <div
                        key={session.id}
                        className="flex items-center justify-between border-3 border-ink bg-parchment-100 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-body text-ink">
                              {STATUS_ICONS[session.status]}
                            </span>
                            <span className="truncate font-display text-sm uppercase tracking-wide text-ink">
                              {session.adventure.name}
                            </span>
                          </div>
                          <p className="font-body text-xs text-ink-faded">
                            {session.status} • {session.participantCount} players
                          </p>
                        </div>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => handleViewSession(session.id)}
                        >
                          View
                        </Button>
                      </div>
                    ))}
                  </div>
                </section>
              )}

              {sessions.length > 0 && adventures.length > 0 && (
                <Divider text="Or Create New" />
              )}

              {/* Available Adventures */}
              {adventures.length > 0 ? (
                <section>
                  <h3 className="mb-3 font-display text-sm uppercase tracking-wide text-ink">
                    Select an Adventure
                  </h3>
                  <div className="space-y-2">
                    {adventures.map((adventure) => (
                      <div
                        key={adventure.id}
                        className="flex items-center justify-between border-3 border-ink bg-parchment-100 p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <span className="truncate font-display text-sm uppercase tracking-wide text-ink">
                            {adventure.name}
                          </span>
                          <p className="font-body text-xs text-ink-faded">
                            {getCampaignName(adventure) || 'Standalone'}
                          </p>
                        </div>
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => setCreatingForAdventure(adventure)}
                        >
                          Create
                        </Button>
                      </div>
                    ))}
                  </div>
                </section>
              ) : sessions.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="font-body text-ink-soft">
                    No adventures available.
                  </p>
                  <p className="mt-1 font-body text-sm text-ink-faded">
                    Create an adventure first to start a session.
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Access Type Selection Modal */}
      <Dialog
        open={!!creatingForAdventure}
        onOpenChange={(isOpen) => !isOpen && setCreatingForAdventure(null)}
      >
        <DialogContent className="max-w-sm" aria-describedby={undefined}>
          <DialogHeader>
            <DialogTitle>Start New Session</DialogTitle>
          </DialogHeader>

          {creatingForAdventure && (
            <div className="space-y-4 py-2">
              <p className="font-body text-sm text-ink">
                Who can join <strong>{creatingForAdventure.name}</strong>?
              </p>

              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => handleCreateSession(creatingForAdventure, 'OPEN')}
                  disabled={isCreating}
                  className="flex w-full items-start gap-3 border-3 border-ink bg-parchment-100 p-3 text-left transition-colors hover:bg-parchment-200 disabled:opacity-50"
                >
                  <SessionTypeChip accessType="OPEN" />
                  <div>
                    <p className="font-body text-sm text-ink">Anyone can browse and join</p>
                  </div>
                </button>

                {creatingForAdventure.campaignId && (
                  <button
                    type="button"
                    onClick={() => handleCreateSession(creatingForAdventure, 'CAMPAIGN')}
                    disabled={isCreating}
                    className="flex w-full items-start gap-3 border-3 border-ink bg-parchment-100 p-3 text-left transition-colors hover:bg-parchment-200 disabled:opacity-50"
                  >
                    <SessionTypeChip accessType="CAMPAIGN" />
                    <div>
                      <p className="font-body text-sm text-ink">
                        Only campaign members can join
                      </p>
                    </div>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleCreateSession(creatingForAdventure, 'INVITE')}
                  disabled={isCreating}
                  className="flex w-full items-start gap-3 border-3 border-ink bg-parchment-100 p-3 text-left transition-colors hover:bg-parchment-200 disabled:opacity-50"
                >
                  <SessionTypeChip accessType="INVITE" />
                  <div>
                    <p className="font-body text-sm text-ink">You'll invite specific players</p>
                  </div>
                </button>
              </div>

              <div className="flex justify-end pt-2">
                <Button
                  variant="ghost"
                  onClick={() => setCreatingForAdventure(null)}
                  disabled={isCreating}
                >
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}
