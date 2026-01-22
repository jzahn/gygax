import { useState, useEffect } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router'
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Divider,
} from '../components/ui'
import type { MessageResponse, AuthError } from '@gygax/shared'

const API_URL = import.meta.env.VITE_API_URL || ''

export function VerifyEmailPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    async function verifyEmail() {
      if (!token) {
        setStatus('error')
        setMessage('No verification token provided')
        return
      }

      try {
        const response = await fetch(`${API_URL}/api/auth/verify-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          credentials: 'include',
          body: JSON.stringify({ token }),
        })

        if (response.ok) {
          const data: MessageResponse = await response.json()
          setStatus('success')
          setMessage(data.message)
          // Redirect to home after 3 seconds
          setTimeout(() => navigate('/'), 3000)
        } else {
          const error: AuthError = await response.json()
          setStatus('error')
          setMessage(error.message)
        }
      } catch {
        setStatus('error')
        setMessage('Failed to verify email. Please try again.')
      }
    }

    verifyEmail()
  }, [token, navigate])

  return (
    <div className="min-h-dvh paper-texture vignette flex items-center justify-center p-4 overflow-x-hidden">
      <div className="w-full max-w-md relative z-10 my-auto">
        <Card className="stagger-children">
          <CardHeader className="text-center">
            <CardTitle className="animate-ink-reveal">
              GUILD VERIFICATION
            </CardTitle>
            <CardDescription className="animate-ink-reveal">
              {status === 'loading' && 'Verifying your seal...'}
              {status === 'success' && 'Your seal has been verified'}
              {status === 'error' && 'Verification failed'}
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Divider className="animate-ink-reveal !mt-0 mb-6" />

            {status === 'loading' && (
              <div className="text-center animate-ink-reveal">
                <span className="animate-quill-scratch inline-block text-2xl mr-3">
                  &#9998;
                </span>
                <span className="font-body text-ink-soft italic">
                  Consulting the ancient registry...
                </span>
              </div>
            )}

            {status === 'success' && (
              <div className="text-center space-y-4 animate-ink-reveal">
                <div className="text-4xl">&#9734;</div>
                <p className="font-body text-ink">
                  Your guild membership is confirmed!
                </p>
                <p className="font-body text-ink-soft text-sm italic">
                  You will be transported to the realm shortly...
                </p>
              </div>
            )}

            {status === 'error' && (
              <div className="text-center space-y-4 animate-ink-reveal">
                <div className="text-blood-red text-sm font-body">
                  <span className="mr-2">&#9876;</span>
                  {message}
                </div>
                <p className="font-body text-ink-soft text-sm">
                  This seal may have expired or already been used.
                </p>
              </div>
            )}
          </CardContent>

          {status === 'error' && (
            <CardFooter className="justify-center animate-ink-reveal">
              <Link
                to="/verify-pending"
                className="font-body text-sm text-ink-soft hover:text-seal-wax transition-colors"
              >
                Request a new verification seal &rarr;
              </Link>
            </CardFooter>
          )}
        </Card>
      </div>
    </div>
  )
}
