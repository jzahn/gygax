import * as React from 'react'
import type { Adventure } from '@gygax/shared'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'

interface DeleteAdventureDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  adventure: Adventure | null
}

export function DeleteAdventureDialog({
  open,
  onClose,
  onConfirm,
  adventure,
}: DeleteAdventureDialogProps) {
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
          <DialogTitle className="text-blood-red">Delete Adventure</DialogTitle>
          <DialogDescription className="font-body text-base not-italic text-ink">
            Are you certain you wish to destroy &lsquo;{adventure?.name}&rsquo;? This action cannot
            be undone. All maps and session history will be lost forever.
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
