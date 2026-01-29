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
            className="h-10 w-10 border-3 border-ink shadow-brutal-sm transition-all duration-100 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-brutal active:translate-x-0.5 active:translate-y-0.5 active:shadow-brutal-pressed"
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
              `nav-link font-display text-sm uppercase tracking-wide transition-colors ${
                isActive || forgeActive
                  ? 'nav-link-active text-ink'
                  : 'text-ink-soft hover:text-ink'
              }`
            }
          >
            Forge
          </NavLink>
          <NavLink
            to="/adventure"
            className={() =>
              `nav-link font-display text-sm uppercase tracking-wide transition-colors ${
                adventureActive
                  ? 'nav-link-active text-ink'
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
