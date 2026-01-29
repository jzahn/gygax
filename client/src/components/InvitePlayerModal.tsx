import * as React from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'

interface InvitePlayerModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (email: string) => Promise<void>
  sessionName?: string
}

export function InvitePlayerModal({
  open,
  onClose,
  onSubmit,
  sessionName,
}: InvitePlayerModalProps) {
  const [email, setEmail] = React.useState('')
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  React.useEffect(() => {
    if (open) {
      setEmail('')
      setError(null)
    }
  }, [open])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const trimmedEmail = email.trim()
    if (!trimmedEmail) {
      setError('Email is required')
      return
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setError('Please enter a valid email address')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      await onSubmit(trimmedEmail)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send invite')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Invite Player</DialogTitle>
        </DialogHeader>

        {sessionName && (
          <p className="font-body text-sm text-ink-faded">
            Inviting to: {sessionName}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email" className="font-display text-xs uppercase tracking-wide">
              Player's Email
            </Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="player@example.com"
              error={!!error}
            />
            {error && <p className="font-body text-sm text-blood-red">{error}</p>}
          </div>

          <p className="font-body text-xs text-ink-faded">
            The player will see this session in their available sessions list.
          </p>

          <DialogFooter>
            <div className="flex w-full justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={isSubmitting} loadingText="Inviting...">
                Send Invite
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
