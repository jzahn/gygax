import * as React from 'react'
import { useNavigate } from 'react-router'
import type { NPCListItem } from '@gygax/shared'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

interface NPCCardProps {
  npc: NPCListItem
  onEdit: (npc: NPCListItem) => void
  onDelete: (npc: NPCListItem) => void
  onExport: (npc: NPCListItem) => void
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

export function NPCCard({ npc, onEdit, onDelete, onExport }: NPCCardProps) {
  const navigate = useNavigate()

  const handleCardClick = () => {
    navigate(`/adventures/${npc.adventureId}/npcs/${npc.id}`)
  }

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit(npc)
  }

  const handleExport = (e: React.MouseEvent) => {
    e.stopPropagation()
    onExport(npc)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(npc)
  }

  // Use class icon if available, otherwise default NPC icon
  const classIcon = npc.class ? CLASS_ICONS[npc.class] || '\u263A' : '\u263A' // Smiley face as NPC default

  return (
    <div
      onClick={handleCardClick}
      className="group cursor-pointer border-2 border-ink bg-parchment-100 shadow-brutal-sm card-texture transition-all hover:-translate-y-0.5 hover:shadow-brutal"
    >
      <div className="flex gap-3 p-3">
        {/* Portrait */}
        <div className="w-14 flex-shrink-0 overflow-hidden border-2 border-ink bg-parchment-200 aspect-[3/4]">
          {npc.avatarUrl ? (
            <img
              src={npc.avatarUrl}
              alt={npc.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center">
              <span className="text-2xl text-ink-soft">{classIcon}</span>
            </div>
          )}
        </div>

        {/* Info */}
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-1">
            <h3 className="font-display text-sm uppercase tracking-wide text-ink line-clamp-1">
              {npc.name}
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
            {npc.class ? `Lvl ${npc.level} ${npc.class}` : `Level ${npc.level}`}
          </p>
          {npc.description && (
            <p className="mt-0.5 font-body text-xs text-ink-faded line-clamp-1">
              {npc.description}
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
