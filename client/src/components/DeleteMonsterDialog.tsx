import * as React from 'react'
import type { MonsterListItem, Monster } from '@gygax/shared'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'

interface DeleteMonsterDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  monster: MonsterListItem | Monster | null
}

export function DeleteMonsterDialog({ open, onClose, onConfirm, monster }: DeleteMonsterDialogProps) {
  const [isDeleting, setIsDeleting] = React.useState(false)

  const handleConfirm = async () => {
    setIsDeleting(true)
    try {
      await onConfirm()
      onClose()
    } catch {
      // Error handling done in parent
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-blood-red">Delete Monster</DialogTitle>
          <DialogDescription className="font-body text-base not-italic text-ink">
            Are you certain you wish to remove &lsquo;{monster?.name}&rsquo; from this adventure? This
            action cannot be undone. All stats, equipment, and notes will be lost forever.
          </DialogDescription>
        </DialogHeader>

        <DialogFooter className="gap-2 pt-4">
          <Button type="button" variant="ghost" onClick={onClose} disabled={isDeleting}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={handleConfirm}
            loading={isDeleting}
            loadingText="Deleting..."
          >
            Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
