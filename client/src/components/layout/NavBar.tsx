import { Link, NavLink, useLocation } from 'react-router'
import { Avatar } from './Avatar'
import { MobileMenu } from './MobileMenu'

function isForgeActive(pathname: string): boolean {
  return (
    pathname.startsWith('/campaigns') ||
    pathname.startsWith('/adventures') ||
    pathname.startsWith('/maps')
  )
}

function isAdventureActive(pathname: string): boolean {
  return (
    pathname === '/adventure' ||
    pathname.startsWith('/characters') ||
    pathname.startsWith('/sessions')
  )
}

export function NavBar() {
  const location = useLocation()
  const forgeActive = isForgeActive(location.pathname)
  const adventureActive = isAdventureActive(location.pathname)

  return (
    <nav className="sticky top-0 z-40 h-14 border-b-3 border-ink bg-parchment-100">
      <div className="relative flex h-full items-center justify-between px-6">
        {/* Brand - Left */}
        <Link to="/" className="flex items-center gap-2">
          <img
            src="/logo/logo.jpg"
            alt="Gygax logo"
            className="h-8 w-8 border-2 border-ink"
          />
          <span className="font-display text-xl uppercase tracking-wide text-ink">
            Gygax
          </span>
        </Link>

        {/* Desktop Navigation - Centered */}
        <div className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-8 md:flex">
          <NavLink
            to="/"
            end
            className={({ isActive }) =>
              `font-display text-sm uppercase tracking-wide transition-colors ${
                isActive || forgeActive
                  ? 'text-ink underline underline-offset-4'
                  : 'text-ink-soft hover:text-ink'
              }`
            }
          >
            Forge
          </NavLink>
          <NavLink
            to="/adventure"
            className={() =>
              `font-display text-sm uppercase tracking-wide transition-colors ${
                adventureActive
                  ? 'text-ink underline underline-offset-4'
                  : 'text-ink-soft hover:text-ink'
              }`
            }
          >
            Adventure
          </NavLink>
        </div>

        {/* Right side: Avatar + Mobile Menu */}
        <div className="flex items-center gap-3">
          <Avatar />
          <MobileMenu
            forgeActive={forgeActive}
            adventureActive={adventureActive}
          />
        </div>
      </div>
    </nav>
  )
}
