import * as React from 'react'
import ReactMarkdown from 'react-markdown'
import type { Note } from '@gygax/shared'
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

export interface NoteFormData {
  title: string
  content?: string
}

interface CreateNoteModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: NoteFormData) => Promise<void>
  note?: Note | null
  initialEditing?: boolean
}

const MAX_TITLE_LENGTH = 200
const MAX_CONTENT_LENGTH = 10000

export function CreateNoteModal({
  open,
  onClose,
  onSubmit,
  note,
  initialEditing = false,
}: CreateNoteModalProps) {
  const [title, setTitle] = React.useState('')
  const [content, setContent] = React.useState('')
  const [isEditing, setIsEditing] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errors, setErrors] = React.useState<{ title?: string }>({})

  const isViewMode = !!note && !isEditing
  const isCreateMode = !note
  const modalTitle = isCreateMode ? 'Create Note' : isEditing ? 'Edit Note' : note.title

  React.useEffect(() => {
    if (open) {
      if (note) {
        setTitle(note.title)
        setContent(note.content || '')
        setIsEditing(initialEditing)
      } else {
        setTitle('')
        setContent('')
        setIsEditing(false)
      }
      setErrors({})
    }
  }, [open, note])

  const validateForm = (): boolean => {
    const newErrors: { title?: string } = {}
    const trimmedTitle = title.trim()
    if (!trimmedTitle) {
      newErrors.title = 'Title is required'
    } else if (trimmedTitle.length > MAX_TITLE_LENGTH) {
      newErrors.title = `Title must be ${MAX_TITLE_LENGTH} characters or less`
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    setIsSubmitting(true)
    try {
      await onSubmit({
        title: title.trim(),
        content: content.trim() || undefined,
      })
    } catch {
      // Error handling done in parent
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-2xl" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{modalTitle}</DialogTitle>
        </DialogHeader>

        {isViewMode ? (
          <>
            <div className="max-h-[60vh] overflow-y-auto px-1">
              {note.content ? (
                <div className="prose-bx font-body text-ink">
                  <ReactMarkdown>{note.content}</ReactMarkdown>
                </div>
              ) : (
                <p className="font-body text-sm text-ink-soft italic">No content</p>
              )}
            </div>
            <DialogFooter className="gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={onClose}>
                Close
              </Button>
              <Button type="button" variant="default" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            </DialogFooter>
          </>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div>
                <Label htmlFor="note-title">Title *</Label>
                <Input
                  id="note-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={MAX_TITLE_LENGTH}
                  placeholder="Note title"
                />
                {errors.title && (
                  <p className="mt-1 font-body text-sm text-blood-red">{errors.title}</p>
                )}
              </div>

              <div>
                <Label htmlFor="note-content">Content</Label>
                <textarea
                  id="note-content"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  maxLength={MAX_CONTENT_LENGTH}
                  rows={12}
                  placeholder="Write your notes here... Markdown is supported."
                  className="w-full rounded border-2 border-ink bg-parchment-100 px-3 py-2 font-body text-sm text-ink placeholder:text-ink-faded focus:outline-none focus:ring-2 focus:ring-ink focus:ring-offset-1"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-4">
              <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="default" loading={isSubmitting} loadingText={isCreateMode ? 'Creating...' : 'Saving...'}>
                {isCreateMode ? 'Create' : 'Save'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  )
}
