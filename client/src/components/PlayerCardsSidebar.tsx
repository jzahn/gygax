import type { SessionWithDetails, WSConnectedUser } from '@gygax/shared'
import { SessionPlayerCard } from './SessionPlayerCard'

interface PlayerCardsSidebarProps {
  session: SessionWithDetails
  connectedUsers: WSConnectedUser[]
  speakingUsers: Set<string>
  mutedUsers: Set<string>
  isMuted: boolean
  onToggleMute: () => void
  className?: string
}

export function PlayerCardsSidebar({
  session,
  connectedUsers,
  speakingUsers,
  mutedUsers,
  isMuted,
  onToggleMute,
  className = '',
}: PlayerCardsSidebarProps) {
  const connectedUserIds = new Set(connectedUsers.map((u) => u.userId))

  return (
    <div className={`flex flex-col bg-parchment-200 ${className}`}>
      {/* Header */}
      <div className="border-b-3 border-ink bg-parchment-100 px-4 py-3">
        <h2 className="font-display text-sm uppercase tracking-wide text-ink">Players</h2>
      </div>

      {/* Player cards */}
      <div className="flex-1 space-y-2 overflow-y-auto p-3">
        {/* DM card always first */}
        <SessionPlayerCard
          dm={session.dm}
          isOnline={connectedUserIds.has(session.dmId)}
          isSpeaking={speakingUsers.has(session.dmId)}
          isMuted={mutedUsers.has(session.dmId)}
        />

        {/* Participant cards */}
        {session.participants.map((participant) => (
          <SessionPlayerCard
            key={participant.id}
            participant={participant}
            isOnline={connectedUserIds.has(participant.userId)}
            isSpeaking={speakingUsers.has(participant.userId)}
            isMuted={mutedUsers.has(participant.userId)}
          />
        ))}

        {session.participants.length === 0 && (
          <p className="py-4 text-center font-body text-sm text-ink-faded">
            No players have joined yet
          </p>
        )}
      </div>

      {/* Voice controls */}
      <div className="border-t-3 border-ink bg-parchment-100 px-4 py-3">
        <button
          onClick={onToggleMute}
          className={`flex w-full items-center justify-center gap-2 rounded border-3 px-4 py-2 font-body text-sm transition-colors ${
            isMuted
              ? 'border-blood-red bg-blood-red/10 text-blood-red hover:bg-blood-red/20'
              : 'border-ink bg-parchment-200 text-ink hover:bg-parchment-300'
          }`}
        >
          <span>{isMuted ? '🔇' : '🎙️'}</span>
          <span>{isMuted ? 'Unmute' : 'Mute'}</span>
        </button>
      </div>
    </div>
  )
}
