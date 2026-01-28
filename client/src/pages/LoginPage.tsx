import { useState, type FormEvent } from 'react'
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

export function LoginPage() {
  const navigate = useNavigate()
  const { login } = useAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      await login(email, password)
      navigate('/')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'The credentials you provided are not recognized'
      )
    } finally {
      setLoading(false)
    }
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
              RETURN TO THE REALM
            </CardTitle>
            <CardDescription className="animate-ink-reveal">
              Present your credentials, adventurer
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
                  placeholder="Enter your secret word"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  disabled={loading}
                  required
                  autoComplete="current-password"
                />
                <div className="text-right">
                  <Link
                    to="/forgot-password"
                    className="text-xs font-body text-ink-faded hover:text-seal-wax transition-colors"
                  >
                    Forgot your secret word?
                  </Link>
                </div>
              </div>

              <div className="animate-ink-reveal pt-2">
                <Button
                  type="submit"
                  variant="primary"
                  className="w-full uppercase tracking-wider"
                  loading={loading}
                  loadingText="Verifying credentials..."
                >
                  ENTER
                </Button>
              </div>
            </form>
          </CardContent>

          <CardFooter className="justify-center animate-ink-reveal">
            <Link
              to="/register"
              className="font-body text-sm text-ink-soft hover:text-seal-wax transition-colors"
            >
              New to these lands? Register your name &rarr;
            </Link>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}
