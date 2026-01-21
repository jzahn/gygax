import { createContext, useState, useEffect, useCallback, type ReactNode } from 'react'
import type { User, AuthResponse, AuthError } from '@gygax/shared'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export interface AuthContextValue {
  user: User | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => Promise<void>
}

export const AuthContext = createContext<AuthContextValue | null>(null)

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Check for existing session on mount
  useEffect(() => {
    async function checkAuth() {
      try {
        const response = await fetch(`${API_URL}/api/auth/me`, {
          credentials: 'include',
        })

        if (response.ok) {
          const data: AuthResponse = await response.json()
          setUser(data.user)
        }
      } catch {
        // Not authenticated or network error
      } finally {
        setLoading(false)
      }
    }

    checkAuth()
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    const response = await fetch(`${API_URL}/api/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    })

    if (!response.ok) {
      const error: AuthError = await response.json()
      throw new Error(error.message)
    }

    const data: AuthResponse = await response.json()
    setUser(data.user)
  }, [])

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const response = await fetch(`${API_URL}/api/auth/register`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ email, password, name }),
      })

      if (!response.ok) {
        const error: AuthError = await response.json()
        throw new Error(error.message)
      }

      const data: AuthResponse = await response.json()
      setUser(data.user)
    },
    []
  )

  const logout = useCallback(async () => {
    await fetch(`${API_URL}/api/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    })

    setUser(null)
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}
