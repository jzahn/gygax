import type { SessionAccessType } from '@gygax/shared'
import { cn } from '@/lib/utils'

interface SessionTypeChipProps {
  accessType: SessionAccessType
  className?: string
}

const ACCESS_CONFIG: Record<
  SessionAccessType,
  { icon: string; label: string; bgClass: string }
> = {
  INVITE: {
    icon: '🔒',
    label: 'Invite',
    bgClass: 'bg-amber-100',
  },
  CAMPAIGN: {
    icon: '👥',
    label: 'Campaign',
    bgClass: 'bg-blue-100',
  },
  OPEN: {
    icon: '🌐',
    label: 'Open',
    bgClass: 'bg-parchment-200',
  },
}

export function SessionTypeChip({ accessType, className }: SessionTypeChipProps) {
  const config = ACCESS_CONFIG[accessType]

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 border-2 border-ink px-1.5 py-0.5 font-display text-xs uppercase tracking-wide text-ink',
        config.bgClass,
        className
      )}
    >
      <span>{config.icon}</span>
      <span>{config.label}</span>
    </span>
  )
}
