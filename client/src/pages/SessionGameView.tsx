import * as React from 'react'
import { Link, useNavigate } from 'react-router'
import type {
  SessionWithDetails,
  WSConnectedUser,
  Map,
  Backdrop,
  MapResponse,
  BackdropResponse,
  SessionStatus,
} from '@gygax/shared'
import { MapDisplay } from '../components/MapDisplay'
import { BackdropDisplay } from '../components/BackdropDisplay'
import { PlayerCardsSidebar } from '../components/PlayerCardsSidebar'
import { DMControls } from '../components/DMControls'
import { SessionStatusBanner } from '../components/SessionStatusBanner'
import { VoiceControls } from '../components/VoiceControls'
import { useVoiceChat } from '../hooks/useVoiceChat'
import { useAuth } from '../hooks/useAuth'

const API_URL = import.meta.env.VITE_API_URL || ''

interface SessionGameViewProps {
  session: SessionWithDetails
  connectedUsers: WSConnectedUser[]
  mutedUsers: Set<string>
  sendMessage: (type: string, payload: unknown) => void
  rtcOfferRef: React.MutableRefObject<((fromUserId: string, sdp: RTCSessionDescriptionInit) => void) | undefined>
  rtcAnswerRef: React.MutableRefObject<((fromUserId: string, sdp: RTCSessionDescriptionInit) => void) | undefined>
  rtcIceCandidateRef: React.MutableRefObject<((fromUserId: string, candidate: RTCIceCandidateInit) => void) | undefined>
  onUpdateStatus: (status: SessionStatus) => Promise<void>
  isUpdating: boolean
}

export function SessionGameView({
  session,
  connectedUsers,
  mutedUsers,
  sendMessage,
  rtcOfferRef,
  rtcAnswerRef,
  rtcIceCandidateRef,
  onUpdateStatus,
  isUpdating,
}: SessionGameViewProps) {
  const { user } = useAuth()
  const navigate = useNavigate()
  const isDm = session.dmId === user?.id

  // Sidebar visibility for mobile/tablet
  const [sidebarOpen, setSidebarOpen] = React.useState(false)

  // Map and backdrop data cache
  const [maps, setMaps] = React.useState<Map[]>([])
  const [backdrops, setBackdrops] = React.useState<Backdrop[]>([])
  const [activeMap, setActiveMap] = React.useState<Map | null>(null)
  const [activeBackdrop, setActiveBackdrop] = React.useState<Backdrop | null>(null)
  const [isLoadingDisplay, setIsLoadingDisplay] = React.useState(false)

  // Cache for fetched maps/backdrops
  const mapCacheRef = React.useRef<Record<string, Map>>({})
  const backdropCacheRef = React.useRef<Record<string, Backdrop>>({})

  // Voice chat
  const voiceChat = useVoiceChat({
    userId: user?.id || '',
    connectedUsers,
    enabled: !!user,
    sendMessage,
  })

  // Wire up RTC callbacks from parent to voice chat handlers
  React.useEffect(() => {
    rtcOfferRef.current = voiceChat.onRtcOffer
    rtcAnswerRef.current = voiceChat.onRtcAnswer
    rtcIceCandidateRef.current = voiceChat.onRtcIceCandidate

    return () => {
      rtcOfferRef.current = undefined
      rtcAnswerRef.current = undefined
      rtcIceCandidateRef.current = undefined
    }
  }, [voiceChat.onRtcOffer, voiceChat.onRtcAnswer, voiceChat.onRtcIceCandidate, rtcOfferRef, rtcAnswerRef, rtcIceCandidateRef])

  // Fetch maps and backdrops list for DM controls
  React.useEffect(() => {
    if (!isDm) return

    const fetchLists = async () => {
      try {
        const [mapsRes, backdropsRes] = await Promise.all([
          fetch(`${API_URL}/api/adventures/${session.adventureId}/maps`, {
            credentials: 'include',
          }),
          fetch(`${API_URL}/api/adventures/${session.adventureId}/backdrops`, {
            credentials: 'include',
          }),
        ])

        let adventureMaps: Map[] = []
        if (mapsRes.ok) {
          const data = await mapsRes.json()
          adventureMaps = data.maps
        }
        if (backdropsRes.ok) {
          const data = await backdropsRes.json()
          setBackdrops(data.backdrops)
        }

        // If adventure belongs to a campaign, also fetch the campaign's world map
        if (session.adventure.campaignId) {
          try {
            const campaignRes = await fetch(
              `${API_URL}/api/campaigns/${session.adventure.campaignId}`,
              { credentials: 'include' }
            )
            if (campaignRes.ok) {
              const campaignData = await campaignRes.json()
              // The campaign response includes worldMap as the full Map object (not just an ID)
              if (campaignData.campaign.worldMap) {
                // Add world map at the beginning with a special marker
                const worldMap = {
                  ...campaignData.campaign.worldMap,
                  name: `[World] ${campaignData.campaign.worldMap.name}`,
                }
                adventureMaps = [worldMap, ...adventureMaps]
              }
            }
          } catch {
            // Failed to fetch campaign world map
          }
        }

        setMaps(adventureMaps)
      } catch {
        // Failed to fetch lists
      }
    }

    fetchLists()
  }, [isDm, session.adventureId, session.adventure.campaignId])

  // Fetch active map/backdrop when they change
  React.useEffect(() => {
    const fetchActiveDisplay = async () => {
      setIsLoadingDisplay(true)

      try {
        if (session.activeMapId) {
          // Check cache first
          if (mapCacheRef.current[session.activeMapId]) {
            setActiveMap(mapCacheRef.current[session.activeMapId])
            setActiveBackdrop(null)
          } else {
            // Use /api/maps/:id route (not nested under adventures)
            const res = await fetch(
              `${API_URL}/api/maps/${session.activeMapId}`,
              { credentials: 'include' }
            )
            if (res.ok) {
              const data: MapResponse = await res.json()
              mapCacheRef.current[session.activeMapId] = data.map
              setActiveMap(data.map)
              setActiveBackdrop(null)
            }
          }
        } else if (session.activeBackdropId) {
          // Check cache first
          if (backdropCacheRef.current[session.activeBackdropId]) {
            setActiveBackdrop(backdropCacheRef.current[session.activeBackdropId])
            setActiveMap(null)
          } else {
            const res = await fetch(
              `${API_URL}/api/adventures/${session.adventureId}/backdrops/${session.activeBackdropId}`,
              { credentials: 'include' }
            )
            if (res.ok) {
              const data: BackdropResponse = await res.json()
              backdropCacheRef.current[session.activeBackdropId] = data.backdrop
              setActiveBackdrop(data.backdrop)
              setActiveMap(null)
            }
          }
        } else {
          setActiveMap(null)
          setActiveBackdrop(null)
        }
      } catch {
        // Failed to fetch display
      } finally {
        setIsLoadingDisplay(false)
      }
    }

    fetchActiveDisplay()
  }, [session.activeMapId, session.activeBackdropId, session.adventureId])

  // DM controls handlers
  const handleSelectMap = (mapId: string | null) => {
    sendMessage('session:set-map', { mapId })
  }

  const handleSelectBackdrop = (backdropId: string | null) => {
    sendMessage('session:set-backdrop', { backdropId })
  }

  const handleClearDisplay = () => {
    sendMessage('session:clear-display', {})
  }

  const handlePause = () => onUpdateStatus('PAUSED')
  const handleResume = () => onUpdateStatus('ACTIVE')
  const handleEnd = () => onUpdateStatus('ENDED')

  // Handler for player leaving session (calls API then navigates)
  const handlePlayerLeave = async () => {
    try {
      await fetch(`${API_URL}/api/sessions/${session.id}/leave`, {
        method: 'POST',
        credentials: 'include',
      })
    } catch {
      // Still navigate even if leave fails
    }
    navigate('/adventure/sessions')
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col bg-parchment-100">
      {/* Header */}
      <header className="border-b-3 border-ink bg-parchment-200">
        {/* Mobile layout: stacked */}
        <div className="flex flex-col md:hidden">
          {/* Top row: back + status + menu */}
          <div className="flex items-center justify-between px-3 py-2">
            {isDm ? (
              <Link
                to={`/adventures/${session.adventureId}`}
                className="flex items-center gap-1 font-body text-xs text-ink-faded hover:text-ink"
              >
                <span className="text-base leading-none">&#8592;</span>
                <span>Adventure</span>
              </Link>
            ) : (
              <button
                onClick={handlePlayerLeave}
                className="flex items-center gap-1 font-body text-xs text-ink-faded hover:text-ink"
              >
                <span className="text-base leading-none">&#8592;</span>
                <span>Leave</span>
              </button>
            )}
            <div className="flex items-center gap-2">
              {session.status === 'ACTIVE' && (
                <span className="flex items-center gap-1.5 font-body text-xs font-medium uppercase tracking-wider text-green-700">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inline-flex h-full w-full animate-ping bg-green-500 opacity-75"></span>
                    <span className="relative inline-flex h-2 w-2 bg-green-600"></span>
                  </span>
                  Live
                </span>
              )}
              {session.status === 'PAUSED' && (
                <span className="flex items-center gap-1.5 font-body text-xs font-medium uppercase tracking-wider text-amber-700">
                  <span>&#9208;</span>
                  Paused
                </span>
              )}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="flex h-8 w-8 items-center justify-center border-2 border-ink bg-parchment-100 text-ink transition-colors hover:bg-ink hover:text-parchment-100 lg:hidden"
              >
                &#9776;
              </button>
            </div>
          </div>
          {/* Bottom row: title */}
          <div className="border-t border-ink/20 px-3 py-1.5">
            <h1 className="truncate font-display text-sm uppercase tracking-wider text-ink">
              {session.adventure.name}
            </h1>
          </div>
        </div>

        {/* Desktop layout: single row */}
        <div className="hidden items-center justify-between px-4 py-2 md:flex">
          {isDm ? (
            <Link
              to={`/adventures/${session.adventureId}`}
              className="font-body text-sm text-ink-faded hover:text-ink"
            >
              &#8592; Adventure
            </Link>
          ) : (
            <button
              onClick={handlePlayerLeave}
              className="font-body text-sm text-ink-faded hover:text-ink"
            >
              &#8592; Leave Session
            </button>
          )}
          <h1 className="font-display text-lg uppercase tracking-wide text-ink">
            {session.adventure.name}
          </h1>
          <div className="flex items-center gap-3">
            {session.status === 'ACTIVE' && (
              <span className="flex items-center gap-1.5 font-body text-xs font-medium uppercase tracking-wider text-green-700">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping bg-green-500 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 bg-green-600"></span>
                </span>
                Live
              </span>
            )}
            {session.status === 'PAUSED' && (
              <span className="flex items-center gap-1.5 font-body text-xs font-medium uppercase tracking-wider text-amber-700">
                <span>&#9208;</span>
                Paused
              </span>
            )}
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="flex h-9 w-9 items-center justify-center border-2 border-ink bg-parchment-100 text-ink transition-colors hover:bg-ink hover:text-parchment-100 lg:hidden"
            >
              &#9776;
            </button>
          </div>
        </div>
      </header>

      {/* Status banner (only shows for ENDED) */}
      <SessionStatusBanner
        status={session.status}
        isDm={isDm}
        adventureId={session.adventureId}
      />

      {/* Main content */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Map/Backdrop display area */}
        <div
          className={`min-w-0 flex-1 overflow-hidden ${
            session.status === 'PAUSED' ? 'opacity-60' : ''
          }`}
        >
          {isLoadingDisplay ? (
            <div className="flex h-full items-center justify-center">
              <span className="animate-quill-scratch text-4xl">&#9998;</span>
              <span className="ml-4 font-body text-ink-soft">Loading...</span>
            </div>
          ) : activeMap ? (
            <MapDisplay map={activeMap} />
          ) : activeBackdrop ? (
            <BackdropDisplay backdrop={activeBackdrop} />
          ) : (
            <div className="flex h-full items-center justify-center bg-parchment-200">
              <p className="font-display text-xl text-ink-faded">
                Awaiting the Dungeon Master...
              </p>
            </div>
          )}
        </div>

        {/* Player sidebar - desktop always visible, mobile/tablet overlay */}
        <aside
          className={`
            absolute right-0 top-0 z-20 h-full w-72 transform border-l-3 border-ink transition-transform lg:relative lg:transform-none
            ${sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}
          `}
        >
          <PlayerCardsSidebar
            session={session}
            connectedUsers={connectedUsers}
            speakingUsers={voiceChat.speakingUsers}
            mutedUsers={mutedUsers}
            isMuted={voiceChat.isMuted}
            onToggleMute={voiceChat.toggleMute}
            className="h-full"
          />
        </aside>

        {/* Mobile sidebar backdrop */}
        {sidebarOpen && (
          <div
            className="absolute inset-0 z-10 bg-ink/50 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Mobile voice controls */}
        <div className="absolute bottom-4 right-4 z-10 lg:hidden">
          <VoiceControls
            isMuted={voiceChat.isMuted}
            audioEnabled={voiceChat.audioEnabled}
            error={voiceChat.error}
            onToggleMute={voiceChat.toggleMute}
          />
        </div>
      </div>

      {/* DM Controls */}
      {isDm && (
        <DMControls
          maps={maps}
          backdrops={backdrops}
          activeMapId={session.activeMapId}
          activeBackdropId={session.activeBackdropId}
          sessionStatus={session.status}
          onSelectMap={handleSelectMap}
          onSelectBackdrop={handleSelectBackdrop}
          onClearDisplay={handleClearDisplay}
          onPause={handlePause}
          onResume={handleResume}
          onEnd={handleEnd}
          isUpdating={isUpdating}
        />
      )}
    </div>
  )
}
