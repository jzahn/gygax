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
        className={`flex items-center gap-2 border-2 border-blood-red bg-parchment-100 px-3 py-1 shadow-brutal ${className}`}
      >
        <span className="text-blood-red">&#9888;</span>
        <span className="font-body text-xs text-blood-red">Mic unavailable</span>
      </div>
    )
  }

  if (!audioEnabled) {
    return (
      <div
        className={`flex items-center gap-2 border-2 border-ink bg-parchment-100 px-3 py-1 shadow-brutal ${className}`}
      >
        <span className="animate-pulse">&#9834;</span>
        <span className="font-body text-xs text-ink-faded">Connecting...</span>
      </div>
    )
  }

  if (!isMuted) {
    return null
  }

  return (
    <button
      onClick={onToggleMute}
      className={`border-2 border-blood-red bg-parchment-100 px-2 py-1 shadow-brutal transition-colors ${className}`}
    >
      <span className="font-body text-xs uppercase tracking-wide text-blood-red">Muted</span>
    </button>
  )
}
