import { useState, useMemo, type FormEvent } from 'react'
import { Link, useSearchParams, useNavigate } from 'react-router'
import {
  Button,
  Input,
  Label,
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

export function ResetPasswordPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const token = searchParams.get('token')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const passwordTooShort = password.length > 0 && password.length < 8
  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword

  const canSubmit = useMemo(() => {
    return password.length >= 8 && password === confirmPassword && token
  }, [password, confirmPassword, token])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ token, password }),
      })

      if (response.ok) {
        const data: MessageResponse = await response.json()
        if (data.success) {
          setSuccess(true)
          setTimeout(() => navigate('/login'), 3000)
        }
      } else {
        const errorData: AuthError = await response.json()
        setError(errorData.message)
      }
    } catch {
      setError('Failed to reset password. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!token) {
    return (
      <div className="min-h-dvh paper-texture vignette flex items-center justify-center p-4 overflow-x-hidden">
        <div className="w-full max-w-md relative z-10 my-auto">
        {/* Frontispiece branding */}
        <div className="mb-3 md:mb-6 flex flex-col items-center text-center">
          <div className="animate-logo-emerge mb-2 md:mb-4">
            <img
              src="/logo/logo.jpg"
              alt="Gygax — a dragon perched upon ancient tomes"
              className="h-16 w-16 md:h-28 md:w-28 border-2 md:border-3 border-ink shadow-brutal-sm md:shadow-brutal"
            />
          </div>
          <h1 className="animate-brand-reveal font-display text-2xl md:text-4xl uppercase text-ink" style={{ letterSpacing: '0.35em' }}>
            Gygax
          </h1>
          <div className="animate-rule-expand mt-1 md:mt-2 h-px w-32 md:w-48 bg-gradient-to-r from-transparent via-ink to-transparent" />
        </div>

          <Card className="stagger-children">
            <CardHeader className="text-center">
              <CardTitle className="animate-ink-reveal">
                INVALID SCROLL
              </CardTitle>
              <CardDescription className="animate-ink-reveal">
                This recovery scroll is incomplete
              </CardDescription>
            </CardHeader>

            <CardContent>
              <Divider className="animate-ink-reveal !mt-0 mb-6" />
              <div className="text-center space-y-4 animate-ink-reveal">
                <div className="text-blood-red text-sm font-body">
                  <span className="mr-2">&#9876;</span>
                  No recovery token was provided
                </div>
              </div>
            </CardContent>

            <CardFooter className="justify-center animate-ink-reveal">
              <Link
                to="/forgot-password"
                className="font-body text-sm text-ink-soft hover:text-seal-wax transition-colors"
              >
                Request a new recovery scroll &rarr;
              </Link>
            </CardFooter>
          </Card>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-dvh paper-texture vignette flex items-center justify-center p-4 overflow-x-hidden">
        <div className="w-full max-w-md relative z-10 my-auto">
        {/* Frontispiece branding */}
        <div className="mb-3 md:mb-6 flex flex-col items-center text-center">
          <div className="animate-logo-emerge mb-2 md:mb-4">
            <img
              src="/logo/logo.jpg"
              alt="Gygax — a dragon perched upon ancient tomes"
              className="h-16 w-16 md:h-28 md:w-28 border-2 md:border-3 border-ink shadow-brutal-sm md:shadow-brutal"
            />
          </div>
          <h1 className="animate-brand-reveal font-display text-2xl md:text-4xl uppercase text-ink" style={{ letterSpacing: '0.35em' }}>
            Gygax
          </h1>
          <div className="animate-rule-expand mt-1 md:mt-2 h-px w-32 md:w-48 bg-gradient-to-r from-transparent via-ink to-transparent" />
        </div>

          <Card className="stagger-children">
            <CardHeader className="text-center">
              <CardTitle className="animate-ink-reveal">
                SECRET WORD RESET
              </CardTitle>
              <CardDescription className="animate-ink-reveal">
                Your new secret word has been sealed
              </CardDescription>
            </CardHeader>

            <CardContent>
              <Divider className="animate-ink-reveal !mt-0 mb-6" />
              <div className="text-center space-y-4 animate-ink-reveal">
                <div className="text-4xl">&#9734;</div>
                <p className="font-body text-ink">
                  Your secret word has been changed successfully!
                </p>
                <p className="font-body text-ink-soft text-sm italic">
                  You will be transported to the gates shortly...
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh paper-texture vignette flex items-center justify-center p-4 overflow-x-hidden">
      <div className="w-full max-w-md relative z-10 my-auto">
        {/* Frontispiece branding */}
        <div className="mb-3 md:mb-6 flex flex-col items-center text-center">
          <div className="animate-logo-emerge mb-2 md:mb-4">
            <img
              src="/logo/logo.jpg"
              alt="Gygax — a dragon perched upon ancient tomes"
              className="h-16 w-16 md:h-28 md:w-28 border-2 md:border-3 border-ink shadow-brutal-sm md:shadow-brutal"
            />
          </div>
          <h1 className="animate-brand-reveal font-display text-2xl md:text-4xl uppercase text-ink" style={{ letterSpacing: '0.35em' }}>
            Gygax
          </h1>
          <div className="animate-rule-expand mt-1 md:mt-2 h-px w-32 md:w-48 bg-gradient-to-r from-transparent via-ink to-transparent" />
        </div>

        <Card className="stagger-children">
          <CardHeader className="text-center">
            <CardTitle className="animate-ink-reveal">
              CHOOSE A NEW SECRET WORD
            </CardTitle>
            <CardDescription className="animate-ink-reveal">
              Select a new phrase to protect your guild membership
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Divider className="animate-ink-reveal !mt-0 mb-6" />
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="animate-ink-reveal text-blood-red text-sm font-body">
                  <span className="mr-2">&#9876;</span>
                  {error}
                  {error.includes('expired') && (
                    <Link
                      to="/forgot-password"
                      className="block mt-2 text-ink-soft hover:text-seal-wax transition-colors"
                    >
                      Request a new recovery scroll &rarr;
                    </Link>
                  )}
                </div>
              )}

              <div className="space-y-1.5 animate-ink-reveal">
                <Label htmlFor="password" className="uppercase tracking-wider">
                  New Secret Word
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="At least 8 characters"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete="new-password"
                  error={passwordTooShort}
                />
                {passwordTooShort && (
                  <p className="text-xs font-body italic text-ink-faded mt-1">
                    Your secret word must contain at least 8 runes
                  </p>
                )}
              </div>

              <div className="space-y-1.5 animate-ink-reveal">
                <Label
                  htmlFor="confirmPassword"
                  className="uppercase tracking-wider"
                >
                  Confirm Your Oath
                </Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Repeat your secret word"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete="new-password"
                  error={!passwordsMatch}
                />
                {!passwordsMatch && (
                  <p className="text-xs font-body italic text-blood-red mt-1">
                    Your oaths do not align
                  </p>
                )}
              </div>

              <div className="animate-ink-reveal pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full uppercase tracking-wider"
                  loading={loading}
                  loadingText="Sealing your new word..."
                  disabled={!canSubmit}
                >
                  SEAL NEW PASSWORD
                </Button>
              </div>
            </form>
          </CardContent>

          <CardFooter className="justify-center animate-ink-reveal">
            <Link
              to="/login"
              className="font-body text-sm text-ink-soft hover:text-seal-wax transition-colors"
            >
              &larr; Return to the gates
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
