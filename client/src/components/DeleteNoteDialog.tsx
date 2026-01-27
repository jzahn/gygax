import * as React from 'react'
import type { Note } from '@gygax/shared'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'

interface DeleteNoteDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  note: Note | null
}

export function DeleteNoteDialog({ open, onClose, onConfirm, note }: DeleteNoteDialogProps) {
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
          <DialogTitle className="text-blood-red">Delete Note</DialogTitle>
          <DialogDescription className="font-body text-base not-italic text-ink">
            Are you certain you wish to remove &lsquo;{note?.title}&rsquo;? This action cannot
            be undone.
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
