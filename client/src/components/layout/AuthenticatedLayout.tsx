import { Outlet } from 'react-router'
import { NavBar } from './NavBar'

export function AuthenticatedLayout() {
  return (
    <div className="min-h-screen paper-texture">
      <NavBar />
      <Outlet />
    </div>
  )
}
