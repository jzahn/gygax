import * as React from 'react'
import { useNavigate } from 'react-router'
import type { MonsterListItem } from '@gygax/shared'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

interface MonsterCardProps {
  monster: MonsterListItem
  onEdit: (monster: MonsterListItem) => void
  onDelete: (monster: MonsterListItem) => void
  onExport: (monster: MonsterListItem) => void
}

const CLASS_ICONS: Record<string, string> = {
  Fighter: '\u2694',
  'Magic-User': '\u2605',
  Cleric: '\u271D',
  Thief: '\u2666',
  Elf: '\u2741',
  Dwarf: '\u2692',
  Halfling: '\u263C',
}

export function MonsterCard({ monster, onEdit, onDelete, onExport }: MonsterCardProps) {
  const navigate = useNavigate()

  const handleCardClick = () => {
    navigate(`/adventures/${monster.adventureId}/monsters/${monster.id}`)
  }

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit(monster)
  }

  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation()
    onExport(monster)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(monster)
  }

  const classIcon = monster.class ? CLASS_ICONS[monster.class] || '\u2620' : '\u2620'

  return (
    <div
      onClick={handleCardClick}
      className="group cursor-pointer border-3 border-ink bg-parchment-100 shadow-brutal card-texture transition-all hover:-translate-y-1 hover:shadow-brutal-lg"
    >
      <div className="flex gap-3 p-3">
        <div className="w-14 flex-shrink-0 overflow-hidden border-2 border-ink bg-parchment-200 aspect-[3/4]">
          {monster.avatarUrl ? (
            <img
              src={monster.avatarUrl}
              alt={monster.name}
              className="h-full w-full object-cover"
              style={{
                objectPosition: monster.avatarHotspotX != null
                  ? `${monster.avatarHotspotX}% ${monster.avatarHotspotY ?? 50}%`
                  : undefined,
              }}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-2xl text-ink-soft">{classIcon}</span>
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <h3 className="font-display text-sm uppercase tracking-wide text-ink line-clamp-1">
              {monster.name}
            </h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={handleMenuClick}>
                <button className="flex-shrink-0 p-0.5 text-ink-soft hover:text-ink">
                  <span className="text-base leading-none">&#8942;</span>
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleEdit}>Edit</DropdownMenuItem>
                <DropdownMenuItem onClick={handleExport}>Export</DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete} className="text-blood-red">
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
          <p className="font-body text-xs text-ink-soft">
            {monster.class ? `Lvl ${monster.level} ${monster.class}` : `Level ${monster.level}`}
          </p>
          {monster.description && (
            <p className="mt-0.5 font-body text-xs text-ink-faded line-clamp-1">
              {monster.description}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
