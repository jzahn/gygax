interface VoiceControlsProps {
  isMuted: boolean
  audioEnabled: boolean
  error: string | null
  onToggleMute: () => void
  className?: string
}

export function VoiceControls({
  isMuted,
  audioEnabled,
  error,
  onToggleMute,
  className = '',
}: VoiceControlsProps) {
  if (error) {
    return (
      <div
        className={`flex items-center gap-2 rounded-full border-2 border-blood-red bg-parchment-100 px-3 py-1.5 shadow-brutal ${className}`}
      >
        <span className="text-blood-red">&#128263;</span>
        <span className="font-body text-xs text-blood-red">Mic unavailable</span>
      </div>
    )
  }

  if (!audioEnabled) {
    return (
      <div
        className={`flex items-center gap-2 rounded-full border-2 border-ink bg-parchment-100 px-3 py-1.5 shadow-brutal ${className}`}
      >
        <span className="animate-pulse">&#128266;</span>
        <span className="font-body text-xs text-ink-faded">Connecting...</span>
      </div>
    )
  }

  return (
    <button
      onClick={onToggleMute}
      className={`flex items-center gap-2 rounded-full border-2 px-3 py-1.5 shadow-brutal transition-colors ${
        isMuted
          ? 'border-blood-red bg-blood-red/10 text-blood-red'
          : 'border-ink bg-parchment-100 text-ink'
      } ${className}`}
    >
      <span>{isMuted ? '🔇' : '🎙️'}</span>
      <span className="font-body text-xs">{isMuted ? 'Muted' : 'Live'}</span>
    </button>
  )
}
