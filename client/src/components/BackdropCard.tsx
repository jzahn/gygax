import * as React from 'react'
import type { Backdrop } from '@gygax/shared'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'

interface BackdropCardProps {
  backdrop: Backdrop
  onEdit: (backdrop: Backdrop) => void
  onDelete: (backdrop: Backdrop) => void
  onPreview: (backdrop: Backdrop) => void
}

export function BackdropCard({ backdrop, onEdit, onDelete, onPreview }: BackdropCardProps) {
  const handleCardClick = () => {
    onPreview(backdrop)
  }

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit(backdrop)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(backdrop)
  }

  return (
    <div
      onClick={handleCardClick}
      className="group cursor-pointer border-2 border-ink bg-parchment-100 shadow-brutal-sm card-texture transition-all hover:-translate-y-0.5 hover:shadow-brutal"
    >
      <div className="relative aspect-video overflow-hidden">
        <img
          src={backdrop.imageUrl}
          alt={backdrop.name}
          className="h-full w-full object-cover"
          style={{
            objectPosition: `${backdrop.focusX}% ${backdrop.focusY}%`,
          }}
        />
        {/* Name overlay at bottom */}
        <div className="absolute inset-x-0 bottom-0 bg-ink/70 px-3 py-1.5">
          <div className="flex items-center justify-between gap-1">
            <h3 className="font-display text-sm uppercase tracking-wide text-parchment-100 line-clamp-1">
              {backdrop.name}
            </h3>
            <DropdownMenu>
              <DropdownMenuTrigger asChild onClick={handleMenuClick}>
                <button className="flex-shrink-0 p-0.5 text-parchment-200 hover:text-parchment-100">
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
        </div>
      </div>
    </div>
  )
}
