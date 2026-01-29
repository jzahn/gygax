import * as React from 'react'
import { useNavigate } from 'react-router'

interface MobileMenuProps {
  forgeActive: boolean
  adventureActive: boolean
}

export function MobileMenu({ forgeActive, adventureActive }: MobileMenuProps) {
  const [isOpen, setIsOpen] = React.useState(false)
  const navigate = useNavigate()

  const handleNavClick = (path: string) => {
    setIsOpen(false)
    navigate(path)
  }

  // Close menu on escape
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false)
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEscape)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEscape)
      document.body.style.overflow = ''
    }
  }, [isOpen])

  return (
    <>
      {/* Hamburger button - visible only on mobile */}
      <button
        onClick={() => setIsOpen(true)}
        className="flex h-10 w-10 items-center justify-center border-3 border-ink bg-white shadow-brutal-sm md:hidden"
        aria-label="Open menu"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <line x1="4" x2="20" y1="6" y2="6" />
          <line x1="4" x2="20" y1="12" y2="12" />
          <line x1="4" x2="20" y1="18" y2="18" />
        </svg>
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-ink/30 md:hidden"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Drawer */}
      <div
        className={`fixed bottom-0 right-0 top-0 z-50 w-72 transform border-l-3 border-ink bg-parchment-100 shadow-brutal-lg transition-transform duration-200 ease-out md:hidden ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Header with close button */}
        <div className="flex h-14 items-center justify-between border-b-3 border-ink px-4">
          <span className="font-display text-lg uppercase tracking-wide text-ink">
            Menu
          </span>
          <button
            onClick={() => setIsOpen(false)}
            className="flex h-8 w-8 items-center justify-center border-2 border-ink bg-white shadow-brutal-sm transition-all duration-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-brutal-pressed"
            aria-label="Close menu"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M18 6 6 18" />
              <path d="m6 6 12 12" />
            </svg>
          </button>
        </div>

        {/* Navigation links */}
        <div className="flex flex-col p-4">
          <button
            onClick={() => handleNavClick('/')}
            className={`px-3 py-3 text-left font-display text-sm uppercase tracking-wide transition-colors ${
              forgeActive
                ? 'text-ink underline underline-offset-4'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            Forge
          </button>
          <button
            onClick={() => handleNavClick('/adventure')}
            className={`px-3 py-3 text-left font-display text-sm uppercase tracking-wide transition-colors ${
              adventureActive
                ? 'text-ink underline underline-offset-4'
                : 'text-ink-soft hover:text-ink'
            }`}
          >
            Quest
          </button>
        </div>
      </div>
    </>
  )
}
