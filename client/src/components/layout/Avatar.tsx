import * as React from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../hooks'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '../ui/dropdown-menu'

function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) {
    return parts[0].substring(0, 2).toUpperCase()
  }
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function Avatar() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  if (!user) return null

  const initials = getInitials(user.name)

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="relative h-10 w-10 bg-transparent border-0 p-0 focus:outline-none"
          aria-label="User menu"
        >
          <span
            className="flex h-full w-full items-center justify-center border-3 border-ink bg-white font-display text-sm uppercase shadow-brutal-sm transition-all duration-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-brutal-pressed focus-visible:ring-2 focus-visible:ring-candle-glow focus-visible:ring-offset-2"
          >
            {initials}
          </span>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 p-0">
        <div className="px-3 py-3 paper-texture">
          <p className="font-display text-sm uppercase tracking-wide text-ink">
            {user.name}
          </p>
          <p className="font-body text-xs text-ink-faded">{user.email}</p>
        </div>
        <div className="border-t-3 border-ink" style={{ backgroundColor: 'var(--color-parchment-100)', backgroundImage: 'none' }}>
          <DropdownMenuItem onClick={handleLogout} className="py-2.5">
            Depart
          </DropdownMenuItem>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
