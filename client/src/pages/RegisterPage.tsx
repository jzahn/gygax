import { useState, type FormEvent, useMemo } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../hooks'
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

export function RegisterPage() {
  const navigate = useNavigate()
  const { register } = useAuth()

  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  // Validation states
  const passwordTooShort = password.length > 0 && password.length < 8
  const passwordsMatch = confirmPassword.length === 0 || password === confirmPassword

  const canSubmit = useMemo(() => {
    return (
      name.trim().length > 0 &&
      email.length > 0 &&
      password.length >= 8 &&
      password === confirmPassword
    )
  }, [name, email, password, confirmPassword])

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (!canSubmit) return

    setError('')
    setLoading(true)

    try {
      await register(email, password, name)
      navigate('/')
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to inscribe your name'
      )
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
              ADVENTURER'S REGISTRY
            </CardTitle>
            <CardDescription className="animate-ink-reveal">
              Inscribe your name in the guild ledger
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
                <Label htmlFor="name" className="uppercase tracking-wider">
                  Your True Name, Adventurer
                </Label>
                <Input
                  id="name"
                  type="text"
                  placeholder="Sir Galahad the Bold"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete="name"
                />
              </div>

              <div className="space-y-1.5 animate-ink-reveal">
                <Label htmlFor="email" className="uppercase tracking-wider">
                  Scrying Address
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

              <div className="space-y-1.5 animate-ink-reveal">
                <Label htmlFor="password" className="uppercase tracking-wider">
                  Secret Word
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
                  loadingText="Signing the ledger..."
                  disabled={!canSubmit}
                >
                  TAKE THE OATH
                </Button>
              </div>
            </form>
          </CardContent>

          <CardFooter className="justify-center animate-ink-reveal">
            <Link
              to="/login"
              className="font-body text-sm text-ink-soft hover:text-seal-wax transition-colors"
            >
              Already sworn? Return to your quest &rarr;
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
