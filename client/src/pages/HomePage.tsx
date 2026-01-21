import { useNavigate } from 'react-router'
import { useAuth } from '../hooks'
import { HealthCheck } from '../components'
import { Button, Card, CardContent, CardHeader, CardTitle, Divider } from '../components/ui'

export function HomePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()

  async function handleLogout() {
    await logout()
    navigate('/login')
  }

  return (
    <div className="min-h-screen paper-texture">
      <div className="max-w-2xl mx-auto p-8">
        <Card className="stagger-children">
          <CardHeader className="text-center">
            <CardTitle className="animate-ink-reveal">GYGAX</CardTitle>
            <p className="font-body italic text-ink-soft animate-ink-reveal">
              Old-school D&D virtual tabletop
            </p>
          </CardHeader>

          <CardContent className="space-y-6">
            <Divider className="animate-ink-reveal !mt-0" />
            <div className="animate-ink-reveal">
              <div className="space-y-4">
                <p className="font-body text-ink">
                  Welcome back, <span className="font-medium">{user?.name}</span>
                </p>
                <Button variant="ghost" onClick={handleLogout}>
                  Depart from the realm
                </Button>
              </div>
            </div>

            <Divider className="animate-ink-reveal" />

            <div className="animate-ink-reveal">
              <HealthCheck />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
