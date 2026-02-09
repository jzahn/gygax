import * as React from 'react'
import { Link, useNavigate } from 'react-router'
import type {
  SessionWithDetails,
  WSConnectedUser,
  WSMessage,
  WSFogState,
  WSTokenState,
  Map,
  Backdrop,
  MapResponse,
  BackdropResponse,
  SessionStatus,
  NPC,
  MonsterListItem,
  CellCoord,
} from '@gygax/shared'
import { MapDisplay } from '../components/MapDisplay'
import { BackdropDisplay } from '../components/BackdropDisplay'
import { PlayerCardsSidebar } from '../components/PlayerCardsSidebar'
import { DMControls } from '../components/DMControls'
import type { FogTool, FogBrushSize } from '../components/FogTools'
import { SessionStatusBanner } from '../components/SessionStatusBanner'
import { VoiceControls } from '../components/VoiceControls'
import { ChatPanel } from '../components/ChatPanel'
import { FloatingConsole } from '../components/FloatingConsole'
import { useVoiceChat } from '../hooks/useVoiceChat'
import { useChat } from '../hooks/useChat'
import { useFog } from '../hooks/useFog'
import { useTokens } from '../hooks/useTokens'
import { useAuth } from '../hooks/useAuth'

const API_URL = import.meta.env.VITE_API_URL || ''

interface SessionGameViewProps {
  session: SessionWithDetails
  connectedUsers: WSConnectedUser[]
  mutedUsers: Set<string>
  sendMessage: (type: string, payload: unknown) => void
  lastMessage: WSMessage | null
  fogState: WSFogState | null
  tokenState: WSTokenState | null
  isConnected: boolean
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
  lastMessage,
  fogState,
  tokenState,
  isConnected,
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

  // Chat hook
  const chat = useChat({
    sessionId: session.id,
    lastMessage,
    sendMessage,
    isConnected,
  })

  // Build session participants for create channel dialog
  const sessionParticipants = React.useMemo(() => {
    const participants = [
      {
        userId: session.dmId,
        userName: session.dm.name,
        avatarUrl: session.dm.avatarUrl,
      },
      ...session.participants.map((p) => ({
        userId: p.userId,
        userName: p.user.name,
        avatarUrl: p.user.avatarUrl,
        characterName: p.character.name,
      })),
    ]
    return participants
  }, [session.dmId, session.dm, session.participants])

  // Handle channel creation
  const handleCreateChannel = React.useCallback(
    async (participantIds: string[], name?: string) => {
      const channel = await chat.createChannel(participantIds, name)
      if (channel) {
        chat.setActiveChannelId(channel.id)
      }
    },
    [chat]
  )

  // Close sidebar when main menu opens
  React.useEffect(() => {
    const handleMainMenuOpened = () => setSidebarOpen(false)
    window.addEventListener('mainMenuOpened', handleMainMenuOpened)
    return () => window.removeEventListener('mainMenuOpened', handleMainMenuOpened)
  }, [])

  // Track space bar for pan-while-held in session mode
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
        // Don't trigger if typing in an input
        if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
          return
        }
        e.preventDefault()
        setIsSpaceHeld(true)
      }
    }
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        setIsSpaceHeld(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Map and backdrop data cache
  const [maps, setMaps] = React.useState<Map[]>([])
  const [backdrops, setBackdrops] = React.useState<Backdrop[]>([])
  const [npcs, setNpcs] = React.useState<NPC[]>([])
  const [monsters, setMonsters] = React.useState<MonsterListItem[]>([])
  const [activeMap, setActiveMap] = React.useState<Map | null>(null)
  const [activeBackdrop, setActiveBackdrop] = React.useState<Backdrop | null>(null)
  const [isLoadingDisplay, setIsLoadingDisplay] = React.useState(false)

  // Cache for fetched maps/backdrops
  const mapCacheRef = React.useRef<Record<string, Map>>({})
  const backdropCacheRef = React.useRef<Record<string, Backdrop>>({})

  // Fog of war state
  const [fogTool, setFogTool] = React.useState<FogTool | null>(null)
  const [fogBrushSize, setFogBrushSize] = React.useState<FogBrushSize>('small')
  const [isSpaceHeld, setIsSpaceHeld] = React.useState(false)

  // Token placement state
  const [placingTokenData, setPlacingTokenData] = React.useState<{
    type: 'PC' | 'NPC' | 'MONSTER' | 'PARTY'
    name: string
    characterId?: string
    npcId?: string
    monsterId?: string
    imageUrl?: string
    imageHotspotX?: number
    imageHotspotY?: number
  } | null>(null)

  // Fog hook
  const fog = useFog({
    mapId: session.activeMapId,
    isDm,
    lastMessage,
    fogState,
    sendMessage,
    isConnected,
  })

  // Tokens hook
  const tokens = useTokens({
    mapId: session.activeMapId,
    isDm,
    tokenState,
    lastMessage,
    sendMessage,
    isConnected,
  })

  // Enrich tokens with entity avatars when the token doesn't have its own imageUrl
  // (handles tokens placed before portrait feature, and portrait changes after placement)
  const enrichedTokens = React.useMemo(() => {
    return tokens.tokens.map((token) => {
      let imageUrl: string | undefined
      let imageHotspotX: number | undefined
      let imageHotspotY: number | undefined

      // Always look up the linked entity for latest avatar/hotspot data
      if (token.characterId) {
        const participant = session.participants.find((p) => p.characterId === token.characterId)
        if (participant?.character.avatarUrl) {
          imageUrl = participant.character.avatarUrl
          imageHotspotX = participant.character.avatarHotspotX ?? undefined
          imageHotspotY = participant.character.avatarHotspotY ?? undefined
        }
      } else if (token.npcId) {
        const npc = npcs.find((n) => n.id === token.npcId)
        if (npc?.avatarUrl) {
          imageUrl = npc.avatarUrl
          imageHotspotX = npc.avatarHotspotX ?? undefined
          imageHotspotY = npc.avatarHotspotY ?? undefined
        }
      } else if (token.monsterId) {
        const monster = monsters.find((m) => m.id === token.monsterId)
        if (monster?.avatarUrl) {
          imageUrl = monster.avatarUrl
          imageHotspotX = monster.avatarHotspotX ?? undefined
          imageHotspotY = monster.avatarHotspotY ?? undefined
        }
      }

      // Fall back to token's own data if no linked entity found
      if (!imageUrl && !token.imageUrl) return token
      return {
        ...token,
        imageUrl: imageUrl ?? token.imageUrl,
        imageHotspotX: imageHotspotX ?? token.imageHotspotX,
        imageHotspotY: imageHotspotY ?? token.imageHotspotY,
      }
    })
  }, [tokens.tokens, session.participants, npcs, monsters])

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

  // Fetch maps, backdrops, and NPCs list for DM controls
  React.useEffect(() => {
    if (!isDm) return

    const fetchLists = async () => {
      try {
        const [mapsRes, backdropsRes, npcsRes, monstersRes] = await Promise.all([
          fetch(`${API_URL}/api/adventures/${session.adventureId}/maps`, {
            credentials: 'include',
          }),
          fetch(`${API_URL}/api/adventures/${session.adventureId}/backdrops`, {
            credentials: 'include',
          }),
          fetch(`${API_URL}/api/adventures/${session.adventureId}/npcs`, {
            credentials: 'include',
          }),
          fetch(`${API_URL}/api/adventures/${session.adventureId}/monsters`, {
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
        if (npcsRes.ok) {
          const data = await npcsRes.json()
          setNpcs(data.npcs)
        }
        if (monstersRes.ok) {
          const data = await monstersRes.json()
          setMonsters(data.monsters)
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

  // Fog handlers
  const handleRevealAll = () => {
    fog.revealAll()
  }

  const handleHideAll = () => {
    fog.hideAll()
  }

  // Token placement handlers
  const handlePlacePCToken = (participantId: string) => {
    const participant = session.participants.find((p) => p.id === participantId)
    if (!participant) return

    setPlacingTokenData({
      type: 'PC',
      name: participant.character.name,
      characterId: participant.characterId,
      imageUrl: participant.character.avatarUrl || undefined,
      imageHotspotX: participant.character.avatarHotspotX ?? undefined,
      imageHotspotY: participant.character.avatarHotspotY ?? undefined,
    })
  }

  const handlePlaceNPCToken = (name: string, npcId?: string) => {
    const npc = npcId ? npcs.find((n) => n.id === npcId) : null
    setPlacingTokenData({
      type: 'NPC',
      name,
      npcId,
      imageUrl: npc?.avatarUrl || undefined,
      imageHotspotX: npc?.avatarHotspotX ?? undefined,
      imageHotspotY: npc?.avatarHotspotY ?? undefined,
    })
  }

  const handlePlaceMonsterToken = (name: string, monsterId?: string) => {
    const monster = monsterId ? monsters.find((m) => m.id === monsterId) : null
    setPlacingTokenData({
      type: 'MONSTER',
      name,
      monsterId,
      imageUrl: monster?.avatarUrl || undefined,
      imageHotspotX: monster?.avatarHotspotX ?? undefined,
      imageHotspotY: monster?.avatarHotspotY ?? undefined,
    })
  }

  const handlePlacePartyToken = () => {
    setPlacingTokenData({
      type: 'PARTY',
      name: 'Party',
    })
  }

  // Handle cell click for fog reveal or token placement
  const handleCellClick = (coord: CellCoord) => {
    // Token placement takes priority
    if (placingTokenData) {
      tokens.placeToken(
        placingTokenData.type,
        placingTokenData.name,
        coord,
        {
          characterId: placingTokenData.characterId,
          npcId: placingTokenData.npcId,
          monsterId: placingTokenData.monsterId,
          imageUrl: placingTokenData.imageUrl,
          imageHotspotX: placingTokenData.imageHotspotX,
          imageHotspotY: placingTokenData.imageHotspotY,
        }
      )
      setPlacingTokenData(null)
      return
    }

    // Fog reveal with brush tool
    if (fogTool === 'brush' && isDm) {
      const cellsToReveal = getBrushCells(coord, fogBrushSize, activeMap)
      fog.revealCells(cellsToReveal)
    }
  }

  // Handle token drag for moving
  const handleTokenDrag = (tokenId: string, position: CellCoord) => {
    tokens.moveToken(tokenId, position)
  }

  // Get brush cells based on size
  function getBrushCells(center: CellCoord, size: FogBrushSize, map: Map | null): CellCoord[] {
    if (!map) return [center]

    const radius = size === 'small' ? 0 : size === 'medium' ? 1 : 2
    const cells: CellCoord[] = []

    if (map.gridType === 'HEX') {
      // Hex brush
      const q = center.q ?? 0
      const r = center.r ?? 0
      for (let dq = -radius; dq <= radius; dq++) {
        for (let dr = Math.max(-radius, -dq - radius); dr <= Math.min(radius, -dq + radius); dr++) {
          const newQ = q + dq
          const newR = r + dr
          if (newQ >= 0 && newQ < map.width && newR >= 0 && newR < map.height) {
            cells.push({ q: newQ, r: newR })
          }
        }
      }
    } else {
      // Square brush
      const col = center.col ?? 0
      const row = center.row ?? 0
      for (let dc = -radius; dc <= radius; dc++) {
        for (let dr = -radius; dr <= radius; dr++) {
          const newCol = col + dc
          const newRow = row + dr
          if (newCol >= 0 && newCol < map.width && newRow >= 0 && newRow < map.height) {
            cells.push({ col: newCol, row: newRow })
          }
        }
      }
    }

    return cells
  }

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
                className="btn-brutal flex h-8 w-8 items-center justify-center border-2 border-ink bg-parchment-100 text-ink shadow-brutal transition-colors hover:bg-ink hover:text-parchment-100 lg:hidden"
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
              className="btn-brutal flex h-9 w-9 items-center justify-center border-2 border-ink bg-parchment-100 text-ink shadow-brutal transition-colors hover:bg-ink hover:text-parchment-100 lg:hidden"
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

      {/* Main content - full height */}
      <div className="relative flex flex-1 overflow-hidden">
        {/* Map/Backdrop display area - now extends full height */}
        <div
          className={`relative min-w-0 flex-1 overflow-hidden ${
            session.status === 'PAUSED' ? 'opacity-60' : ''
          }`}
        >
          {isLoadingDisplay ? (
            <div className="flex h-full items-center justify-center">
              <span className="animate-quill-scratch text-4xl">&#9998;</span>
              <span className="ml-4 font-body text-ink-soft">Loading...</span>
            </div>
          ) : activeMap ? (
            <MapDisplay
              map={activeMap}
              fogRevealedCells={fog.revealedCells}
              tokens={enrichedTokens}
              selectedTokenId={tokens.selectedTokenId}
              isDm={isDm}
              sessionTool={
                placingTokenData ? 'token-place' :
                fogTool === 'brush' ? 'fog-brush' :
                fogTool === 'rect' ? 'fog-rect' :
                null
              }
              isSpaceHeld={isSpaceHeld}
              onTokenClick={isDm ? tokens.selectToken : undefined}
              onTokenDrag={isDm ? handleTokenDrag : undefined}
              onCellClick={isDm ? handleCellClick : undefined}
            />
          ) : activeBackdrop ? (
            <BackdropDisplay backdrop={activeBackdrop} />
          ) : (
            <div className="flex h-full items-center justify-center bg-parchment-200">
              <p className="font-display text-xl text-ink-faded">
                Awaiting the Dungeon Master...
              </p>
            </div>
          )}

          {/* Floating Console - positioned inside the display area */}
          <FloatingConsole
            isDM={isDm}
            chatUnreadCount={chat.totalUnreadCount}
            dmToolsContent={
              isDm ? (
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
                  // Fog props
                  fogTool={fogTool}
                  fogBrushSize={fogBrushSize}
                  onFogToolChange={setFogTool}
                  onFogBrushSizeChange={setFogBrushSize}
                  onRevealAll={handleRevealAll}
                  onHideAll={handleHideAll}
                  // Token props
                  tokens={enrichedTokens}
                  participants={session.participants}
                  npcs={npcs}
                  monsters={monsters}
                  selectedTokenId={tokens.selectedTokenId}
                  onPlacePCToken={handlePlacePCToken}
                  onPlaceNPCToken={handlePlaceNPCToken}
                  onPlaceMonsterToken={handlePlaceMonsterToken}
                  onPlacePartyToken={handlePlacePartyToken}
                  onSelectToken={tokens.selectToken}
                  onRemoveToken={tokens.removeToken}
                  isHexMap={activeMap?.gridType === 'HEX'}
                />
              ) : null
            }
            chatContent={
              <ChatPanel
                channels={chat.channels}
                activeChannelId={chat.activeChannelId}
                messages={chat.messages}
                hasMore={chat.hasMore}
                isLoading={chat.isLoading}
                onSelectChannel={chat.setActiveChannelId}
                onSendMessage={chat.sendChatMessage}
                onLoadMore={chat.loadMore}
                onCreateChannel={handleCreateChannel}
                sessionParticipants={sessionParticipants}
                currentUserId={user?.id || ''}
              />
            }
          />

          {/* Mobile voice controls - padding matches header (px-3 mobile, px-4 desktop) */}
          <div className="absolute bottom-3 right-3 z-40 md:bottom-4 md:right-4 lg:hidden">
            <VoiceControls
              isMuted={voiceChat.isMuted}
              audioEnabled={voiceChat.audioEnabled}
              error={voiceChat.error}
              onToggleMute={voiceChat.toggleMute}
            />
          </div>
        </div>

        {/* Player sidebar - desktop only (inline) */}
        <aside className="hidden w-72 border-l-3 border-ink lg:block">
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
      </div>

      {/* Mobile/tablet sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/50 lg:hidden"
          style={{ top: '3.5rem' }}
          onClick={() => setSidebarOpen(false)}
        />
      )}
      <aside
        className={`
          fixed bottom-0 right-0 top-14 z-50 w-72 transform border-l-3 border-ink bg-parchment-100 transition-transform lg:hidden
          ${sidebarOpen ? 'translate-x-0' : 'translate-x-full'}
        `}
      >
        <PlayerCardsSidebar
          session={session}
          connectedUsers={connectedUsers}
          speakingUsers={voiceChat.speakingUsers}
          mutedUsers={mutedUsers}
          isMuted={voiceChat.isMuted}
          onToggleMute={voiceChat.toggleMute}
          onClose={() => setSidebarOpen(false)}
          className="h-full"
        />
      </aside>
    </div>
  )
}
