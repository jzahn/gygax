import * as React from 'react'
import { useNavigate } from 'react-router'
import type { Character } from '@gygax/shared'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

interface CharacterCardProps {
  character: Character
  onEdit: (character: Character) => void
  onDelete: (character: Character) => void
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return 'Today'
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return months === 1 ? '1 month ago' : `${months} months ago`
  } else {
    const years = Math.floor(diffDays / 365)
    return years === 1 ? '1 year ago' : `${years} years ago`
  }
}

// Class-based placeholder icons
const CLASS_ICONS: Record<string, string> = {
  Fighter: '\u2694',      // Crossed swords
  'Magic-User': '\u2605', // Star
  Cleric: '\u271D',       // Latin cross
  Thief: '\u2666',        // Diamond
  Elf: '\u2741',          // Eight petalled outlined black florette
  Dwarf: '\u2692',        // Hammer and pick
  Halfling: '\u263C',     // Sun with rays
}

export function CharacterCard({ character, onEdit, onDelete }: CharacterCardProps) {
  const navigate = useNavigate()

  const handleCardClick = () => {
    navigate(`/characters/${character.id}`)
  }

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit(character)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(character)
  }

  const classIcon = CLASS_ICONS[character.class] || '\u2620' // Skull as fallback

  return (
    <div
      onClick={handleCardClick}
      className="group cursor-pointer border-3 border-ink bg-parchment-100 shadow-brutal card-texture transition-all hover:-translate-y-1 hover:shadow-brutal-lg"
    >
      <div className="aspect-[2/3] overflow-hidden border-b-3 border-ink">
        {character.avatarUrl ? (
          <img
            src={character.avatarUrl}
            alt={character.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-parchment-200">
            <div className="mb-2 text-4xl text-ink-soft">{classIcon}</div>
            <span className="px-4 text-center font-display text-lg uppercase tracking-wide text-ink">
              {character.name.length > 20 ? character.name.slice(0, 20) + '...' : character.name}
            </span>
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <h3 className="font-display text-base uppercase tracking-wide text-ink line-clamp-1">
              {character.name}
            </h3>
            <p className="mt-1 font-body text-sm text-ink-soft">
              Level {character.level} {character.class}
            </p>
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={handleMenuClick}>
              <button className="flex-shrink-0 p-1 text-ink-soft hover:text-ink">
                <span className="text-lg leading-none">&#8942;</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleEdit}>Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-blood-red">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p className="mt-2 font-body text-xs text-ink-faded">
          Last modified: {formatRelativeTime(character.updatedAt)}
        </p>
      </div>
    </div>
  )
}
