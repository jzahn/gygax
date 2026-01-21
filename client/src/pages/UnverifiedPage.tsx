import { useState } from 'react'
import { useAuth } from '../hooks'
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  Divider,
} from '../components/ui'
import type { MessageResponse, AuthError } from '@gygax/shared'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function UnverifiedPage() {
  const { user, logout } = useAuth()
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleResend() {
    setLoading(true)
    setMessage('')
    setError('')

    try {
      const response = await fetch(`${API_URL}/api/auth/resend-verification`, {
        method: 'POST',
        credentials: 'include',
      })

      if (response.ok) {
        const data: MessageResponse = await response.json()
        setMessage(data.message)
      } else {
        const errorData: AuthError = await response.json()
        setError(errorData.message)
      }
    } catch {
      setError('Failed to send verification email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen paper-texture vignette flex items-center justify-center p-4">
      <div className="w-full max-w-md relative z-10">
        <Card className="stagger-children">
          <CardHeader className="text-center">
            <CardTitle className="animate-ink-reveal">
              VERIFY YOUR MEMBERSHIP
            </CardTitle>
            <CardDescription className="animate-ink-reveal">
              Your scrying address must be verified
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-6">
            <Divider className="animate-ink-reveal !mt-0" />

            <div className="text-center space-y-4 animate-ink-reveal">
              <p className="font-body text-ink">
                A verification missive has been dispatched to:
              </p>
              <p className="font-display text-lg text-seal-wax">
                {user?.email}
              </p>
              <p className="font-body text-ink-soft text-sm">
                Check your scrying device and click the verification seal within
                to complete your guild registration.
              </p>
            </div>

            {message && (
              <div className="animate-ink-reveal text-center text-sm font-body text-ink">
                <span className="mr-2">&#10003;</span>
                {message}
              </div>
            )}

            {error && (
              <div className="animate-ink-reveal text-center text-blood-red text-sm font-body">
                <span className="mr-2">&#9876;</span>
                {error}
              </div>
            )}

            <div className="space-y-3 animate-ink-reveal">
              <Button
                variant="primary"
                className="w-full uppercase tracking-wider"
                onClick={handleResend}
                loading={loading}
                loadingText="Dispatching missive..."
              >
                RESEND VERIFICATION
              </Button>

              <Button
                variant="ghost"
                className="w-full"
                onClick={() => logout()}
              >
                Sign out
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
