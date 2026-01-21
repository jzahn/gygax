import { Link } from 'react-router'
import { useAuth } from '../hooks'
import { HealthCheck } from '../components'
import { Button, Card, CardContent, CardHeader, CardTitle, Divider } from '../components/ui'

export function HomePage() {
  const { user, loading, logout } = useAuth()

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

          <Divider className="mx-8 animate-ink-reveal" />

          <CardContent className="space-y-6">
            <div className="animate-ink-reveal">
              {loading ? (
                <p className="font-body text-ink-soft italic">
                  <span className="animate-quill-scratch inline-block mr-2">&#9998;</span>
                  Consulting the ancient tomes...
                </p>
              ) : user ? (
                <div className="space-y-4">
                  <p className="font-body text-ink">
                    Welcome back, <span className="font-medium">{user.name}</span>
                  </p>
                  <Button variant="ghost" onClick={logout}>
                    Depart from the realm
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <p className="font-body text-ink-soft italic">
                    You are not yet sworn to the guild.
                  </p>
                  <div className="flex gap-4 flex-wrap">
                    <Link to="/login">
                      <Button variant="primary">Enter the Realm</Button>
                    </Link>
                    <Link to="/register">
                      <Button variant="default">Register Your Name</Button>
                    </Link>
                  </div>
                </div>
              )}
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
