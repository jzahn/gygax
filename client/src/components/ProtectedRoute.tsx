import { Navigate } from 'react-router'
import { useAuth } from '../hooks'
import type { ReactNode } from 'react'

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen paper-texture flex items-center justify-center">
        <div className="text-center font-body text-ink-soft">
          <span className="animate-quill-scratch inline-block text-2xl mr-3">
            &#9998;
          </span>
          <span className="italic">Consulting the ancient tomes...</span>
        </div>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
