import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
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
import type { MessageResponse } from '@gygax/shared'

const API_URL = import.meta.env.VITE_API_URL || ''

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const response = await fetch(`${API_URL}/api/auth/forgot-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      })

      if (response.ok) {
        const data: MessageResponse = await response.json()
        if (data.success) {
          setSubmitted(true)
        }
      } else {
        setError('Failed to process request. Please try again.')
      }
    } catch {
      setError('Failed to send request. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="min-h-dvh paper-texture vignette flex items-center justify-center p-4 overflow-x-hidden">
        <div className="w-full max-w-md relative z-10 my-auto">
          <Card className="stagger-children">
            <CardHeader className="text-center">
              <CardTitle className="animate-ink-reveal">
                SCROLL DISPATCHED
              </CardTitle>
              <CardDescription className="animate-ink-reveal">
                Check your scrying device
              </CardDescription>
            </CardHeader>

            <CardContent>
              <Divider className="animate-ink-reveal !mt-0 mb-6" />
              <div className="text-center space-y-4 animate-ink-reveal">
                <div className="text-4xl">&#9993;</div>
                <p className="font-body text-ink">
                  If a guild member with that scrying address exists, a recovery
                  scroll has been dispatched.
                </p>
                <p className="font-body text-ink-soft text-sm">
                  The scroll will expire in one hour.
                </p>
              </div>
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

  return (
    <div className="min-h-dvh paper-texture vignette flex items-center justify-center p-4 overflow-x-hidden">
      <div className="w-full max-w-md relative z-10 my-auto">
        <Card className="stagger-children">
          <CardHeader className="text-center">
            <CardTitle className="animate-ink-reveal">
              FORGOTTEN SECRET WORD
            </CardTitle>
            <CardDescription className="animate-ink-reveal">
              Fear not, adventurer. We shall send a recovery scroll.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <Divider className="animate-ink-reveal !mt-0 mb-6" />
            <form onSubmit={handleSubmit} className="space-y-6">
              {error && (
                <div className="animate-ink-reveal text-blood-red text-sm font-body">
                  <span className="mr-2">&#9876;</span>
                  {error}
                </div>
              )}

              <div className="space-y-1.5 animate-ink-reveal">
                <Label htmlFor="email" className="uppercase tracking-wider">
                  Your Scrying Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="your.name@realm.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete="email"
                />
              </div>

              <div className="animate-ink-reveal pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full uppercase tracking-wider"
                  loading={loading}
                  loadingText="Preparing the scroll..."
                >
                  SEND RECOVERY SCROLL
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
