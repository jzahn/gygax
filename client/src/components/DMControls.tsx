import * as React from 'react'
import type { Map, Backdrop, SessionStatus, SessionToken, SessionParticipantWithDetails, NPC } from '@gygax/shared'
import { Button } from './ui'
import { FogTools, type FogTool, type FogBrushSize } from './FogTools'
import { TokenTools } from './TokenTools'

interface DMControlsProps {
  maps: Map[]
  backdrops: Backdrop[]
  activeMapId: string | null
  activeBackdropId: string | null
  sessionStatus: SessionStatus
  onSelectMap: (mapId: string | null) => void
  onSelectBackdrop: (backdropId: string | null) => void
  onClearDisplay: () => void
  onPause: () => void
  onResume: () => void
  onEnd: () => void
  isUpdating?: boolean
  className?: string
  // Fog of war props
  fogTool?: FogTool | null
  fogBrushSize?: FogBrushSize
  onFogToolChange?: (tool: FogTool | null) => void
  onFogBrushSizeChange?: (size: FogBrushSize) => void
  onRevealAll?: () => void
  onHideAll?: () => void
  // Token props
  tokens?: SessionToken[]
  participants?: SessionParticipantWithDetails[]
  npcs?: NPC[]
  selectedTokenId?: string | null
  onPlacePCToken?: (participantId: string) => void
  onPlaceNPCToken?: (name: string, npcId?: string) => void
  onPlaceMonsterToken?: (name: string) => void
  onSelectToken?: (tokenId: string | null) => void
  onRemoveToken?: (tokenId: string) => void
}

type ExpandedSection = 'display' | 'fog' | 'tokens' | 'session' | null

// Section header component - defined outside to prevent recreation on each render
function SectionHeader({
  title,
  section,
  icon,
  expandedSection,
  onToggle,
}: {
  title: string
  section: ExpandedSection
  icon: string
  expandedSection: ExpandedSection
  onToggle: (section: ExpandedSection) => void
}) {
  return (
    <button
      type="button"
      onClick={() => onToggle(section)}
      className="flex w-full items-center justify-between border-b border-ink/20 pb-1"
    >
      <span className="font-display text-xs uppercase tracking-wide text-ink">
        {icon} {title}
      </span>
      <span className="font-body text-xs text-ink-soft">
        {expandedSection === section ? '▾' : '▸'}
      </span>
    </button>
  )
}

export function DMControls({
  maps,
  backdrops,
  activeMapId,
  activeBackdropId,
  sessionStatus,
  onSelectMap,
  onSelectBackdrop,
  onClearDisplay,
  onPause,
  onResume,
  onEnd,
  isUpdating = false,
  className = '',
  // Fog props
  fogTool = null,
  fogBrushSize = 'small',
  onFogToolChange,
  onFogBrushSizeChange,
  onRevealAll,
  onHideAll,
  // Token props
  tokens = [],
  participants = [],
  npcs = [],
  selectedTokenId = null,
  onPlacePCToken,
  onPlaceNPCToken,
  onPlaceMonsterToken,
  onSelectToken,
  onRemoveToken,
}: DMControlsProps) {
  const [showEndConfirm, setShowEndConfirm] = React.useState(false)
  const [expandedSection, setExpandedSection] = React.useState<ExpandedSection>('display')

  const hasMapSelected = activeMapId !== null

  const toggleSection = (section: ExpandedSection) => {
    // On mobile, only one section at a time (accordion)
    setExpandedSection(expandedSection === section ? null : section)
  }

  const handleMapChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    onSelectMap(value === '' ? null : value)
  }

  const handleBackdropChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value
    onSelectBackdrop(value === '' ? null : value)
  }

  const handleEndClick = () => {
    if (showEndConfirm) {
      onEnd()
      setShowEndConfirm(false)
    } else {
      setShowEndConfirm(true)
    }
  }

  // Hide cancel confirmation after 3 seconds
  React.useEffect(() => {
    if (showEndConfirm) {
      const timeout = setTimeout(() => setShowEndConfirm(false), 3000)
      return () => clearTimeout(timeout)
    }
  }, [showEndConfirm])

  return (
    <div className={`flex flex-col gap-3 px-4 py-3 ${className}`}>
      {/* DISPLAY Section */}
      <div>
        <SectionHeader title="Display" section="display" icon="&#128220;" expandedSection={expandedSection} onToggle={toggleSection} />
        {expandedSection === 'display' && (
          <div className="mt-2 flex flex-col gap-2">
            <label className="flex items-center gap-2">
              <span className="font-body text-sm text-ink">Map:</span>
              <select
                value={activeMapId || ''}
                onChange={handleMapChange}
                className="min-w-0 flex-1 border-2 border-ink bg-parchment-100 px-2 py-1 font-body text-sm text-ink"
              >
                <option value="">None</option>
                {maps.map((map) => (
                  <option key={map.id} value={map.id}>
                    {map.name} ({map.gridType === 'HEX' ? 'Hex' : 'Sq'})
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-2">
              <span className="font-body text-sm text-ink">Backdrop:</span>
              <select
                value={activeBackdropId || ''}
                onChange={handleBackdropChange}
                className="min-w-0 flex-1 border-2 border-ink bg-parchment-100 px-2 py-1 font-body text-sm text-ink"
              >
                <option value="">None</option>
                {backdrops.map((backdrop) => (
                  <option key={backdrop.id} value={backdrop.id}>
                    {backdrop.name}
                  </option>
                ))}
              </select>
            </label>
            {(activeMapId || activeBackdropId) && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClearDisplay}
                className="self-start text-ink hover:bg-ink hover:text-parchment-100"
              >
                &#10005; Clear Display
              </Button>
            )}
          </div>
        )}
      </div>

      {/* FOG OF WAR Section (only when map is active) */}
      {hasMapSelected && onFogToolChange && onFogBrushSizeChange && onRevealAll && onHideAll && (
        <div>
          <SectionHeader title="Fog of War" section="fog" icon="&#127787;" expandedSection={expandedSection} onToggle={toggleSection} />
          {expandedSection === 'fog' && (
            <div className="mt-2">
              <FogTools
                activeTool={fogTool}
                brushSize={fogBrushSize}
                onToolChange={onFogToolChange}
                onBrushSizeChange={onFogBrushSizeChange}
                onRevealAll={onRevealAll}
                onHideAll={onHideAll}
                disabled={isUpdating}
              />
            </div>
          )}
        </div>
      )}

      {/* TOKENS Section (only when map is active) */}
      {hasMapSelected && onPlacePCToken && onPlaceNPCToken && onPlaceMonsterToken && onSelectToken && onRemoveToken && (
        <div>
          <SectionHeader title="Tokens" section="tokens" icon="&#9899;" expandedSection={expandedSection} onToggle={toggleSection} />
          {expandedSection === 'tokens' && (
            <div className="mt-2">
              <TokenTools
                tokens={tokens}
                participants={participants}
                npcs={npcs}
                selectedTokenId={selectedTokenId}
                onPlacePCToken={onPlacePCToken}
                onPlaceNPCToken={onPlaceNPCToken}
                onPlaceMonsterToken={onPlaceMonsterToken}
                onSelectToken={onSelectToken}
                onRemoveToken={onRemoveToken}
                disabled={isUpdating}
              />
            </div>
          )}
        </div>
      )}

      {/* SESSION Section */}
      <div>
        <SectionHeader title="Session" section="session" icon="&#9654;" expandedSection={expandedSection} onToggle={toggleSection} />
        {expandedSection === 'session' && (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            {sessionStatus === 'ACTIVE' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onPause}
                disabled={isUpdating}
                className="text-ink hover:bg-ink hover:text-parchment-100"
              >
                &#9208; Pause
              </Button>
            )}
            {sessionStatus === 'PAUSED' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onResume}
                disabled={isUpdating}
                className="text-ink hover:bg-ink hover:text-parchment-100"
              >
                &#9654; Resume
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleEndClick}
              disabled={isUpdating}
              className={
                showEndConfirm
                  ? 'bg-blood-red text-parchment-100 hover:bg-blood-red/80'
                  : 'text-blood-red hover:bg-blood-red hover:text-parchment-100'
              }
            >
              {showEndConfirm ? 'Click to Confirm' : '■ End Session'}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
