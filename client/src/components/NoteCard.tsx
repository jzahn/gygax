import * as React from 'react'
import type { Note } from '@gygax/shared'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

interface NoteCardProps {
  note: Note
  onView: (note: Note) => void
  onEdit: (note: Note) => void
  onDelete: (note: Note) => void
}

function relativeTime(dateStr: string): string {
  const now = Date.now()
  const then = new Date(dateStr).getTime()
  const diff = now - then
  const seconds = Math.floor(diff / 1000)
  const minutes = Math.floor(seconds / 60)
  const hours = Math.floor(minutes / 60)
  const days = Math.floor(hours / 24)

  if (seconds < 60) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export function NoteCard({ note, onView, onEdit, onDelete }: NoteCardProps) {
  const handleCardClick = () => {
    onView(note)
  }

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit(note)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(note)
  }

  return (
    <div
      onClick={handleCardClick}
      className="group cursor-pointer border-2 border-ink bg-parchment-100 p-4 shadow-brutal-sm card-texture transition-all hover:-translate-y-0.5 hover:shadow-brutal"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-display text-sm uppercase tracking-wide text-ink line-clamp-1">
          {note.title}
        </h3>
        <DropdownMenu>
          <DropdownMenuTrigger asChild onClick={handleMenuClick}>
            <button className="flex-shrink-0 p-0.5 text-ink-soft hover:text-ink">
              <span className="text-base leading-none">&#8942;</span>
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

      {note.content && (
        <p className="mt-2 font-body text-sm text-ink-soft line-clamp-3">
          {note.content}
        </p>
      )}

      <p className="mt-3 font-body text-xs text-ink-faded">
        Updated {relativeTime(note.updatedAt)}
      </p>
    </div>
  )
}
