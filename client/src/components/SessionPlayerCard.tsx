import type { SessionParticipantWithDetails, WSConnectedUser } from '@gygax/shared'

interface SessionPlayerCardProps {
  // For DM card
  dm?: {
    id: string
    name: string
    avatarUrl: string | null
  }
  // For player card
  participant?: SessionParticipantWithDetails
  // Connection state
  connectedUser?: WSConnectedUser
  isOnline: boolean
  isSpeaking: boolean
  isMuted: boolean
}

function getInitials(name: string): string {
  return name
    .split(' ')
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

export function SessionPlayerCard({
  dm,
  participant,
  isOnline,
  isSpeaking,
  isMuted,
}: SessionPlayerCardProps) {
  const isDm = !!dm
  const name = isDm ? dm.name : participant?.character.name || ''
  const avatarUrl = isDm
    ? dm.avatarUrl
    : participant?.character.avatarUrl || participant?.user.avatarUrl || null
  const initials = getInitials(isDm ? dm.name : participant?.user.name || '')

  return (
    <div className="border-3 border-ink bg-parchment-100 p-3 shadow-brutal">
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative h-12 w-12 flex-shrink-0">
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={name}
              className="h-12 w-12 border-2 border-ink object-cover"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center border-2 border-ink bg-parchment-300 font-display text-lg text-ink">
              {initials}
            </div>
          )}
          {/* Speaking indicator glow */}
          {isSpeaking && !isMuted && (
            <div className="absolute -inset-1 animate-pulse border-2 border-green-500 opacity-75" />
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            {isDm && <span className="text-amber-600">&#9733;</span>}
            <span className="font-display text-sm uppercase tracking-wide text-ink truncate">
              {name}
            </span>
          </div>

          {isDm ? (
            <p className="font-body text-xs text-ink-faded">Dungeon Master</p>
          ) : participant ? (
            <>
              <p className="font-body text-xs text-ink-faded">
                {participant.character.class} {participant.character.level}
              </p>
              <div className="mt-1 flex gap-3 font-body text-xs">
                <span className="text-blood-red">
                  HP: {participant.character.hitPointsCurrent}/{participant.character.hitPointsMax}
                </span>
                <span className="text-ink-faded">AC: {participant.character.armorClass}</span>
              </div>
            </>
          ) : null}
        </div>

        {/* Status indicators */}
        <div className="flex flex-col items-center gap-1">
          {/* Online status */}
          <div
            className={`h-2.5 w-2.5 ${isOnline ? 'bg-green-500' : 'bg-gray-300'}`}
            title={isOnline ? 'Online' : 'Offline'}
          />
          {/* Mute indicator */}
          {isMuted && (
            <span className="text-ink-faded" title="Muted">
              &#128263;
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
