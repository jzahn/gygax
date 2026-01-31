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
import { ImageUpload } from './ImageUpload'

export interface BackdropFormData {
  name: string
  description?: string
  image: File | null
  focusX: number
  focusY: number
}

interface CreateBackdropModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: BackdropFormData) => Promise<void>
}

const MAX_NAME_LENGTH = 100
const MAX_DESCRIPTION_LENGTH = 2000

export function CreateBackdropModal({
  open,
  onClose,
  onSubmit,
}: CreateBackdropModalProps) {
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [image, setImage] = React.useState<File | null>(null)
  const [focusX, setFocusX] = React.useState(50)
  const [focusY, setFocusY] = React.useState(50)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errors, setErrors] = React.useState<{ name?: string; image?: string }>({})

  React.useEffect(() => {
    if (open) {
      setName('')
      setDescription('')
      setImage(null)
      setFocusX(50)
      setFocusY(50)
      setErrors({})
    }
  }, [open])

  const validateForm = (): boolean => {
    const newErrors: { name?: string; image?: string } = {}

    const trimmedName = name.trim()
    if (!trimmedName) {
      newErrors.name = 'Name is required'
    } else if (trimmedName.length > MAX_NAME_LENGTH) {
      newErrors.name = `Name must be ${MAX_NAME_LENGTH} characters or less`
    }

    if (!image) {
      newErrors.image = 'Image is required'
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
        name: name.trim(),
        description: description.trim() || undefined,
        image,
        focusX,
        focusY,
      })
      onClose()
    } catch {
      // Error handling done in parent
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Create Backdrop</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="font-display text-xs uppercase tracking-wide">Image *</Label>
            <ImageUpload
              value={image}
              onChange={(file) => setImage(file)}
              focusX={focusX}
              focusY={focusY}
              onFocusChange={(x, y) => {
                setFocusX(x)
                setFocusY(y)
              }}
              error={errors.image}
            />
            <p className="font-body text-xs text-ink-faded">
              Click image to set focal point
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="backdrop-name" className="font-display text-xs uppercase tracking-wide">
              Name *
            </Label>
            <Input
              id="backdrop-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What is this backdrop?"
              error={!!errors.name}
              maxLength={MAX_NAME_LENGTH + 10}
            />
            {errors.name && <p className="font-body text-sm text-blood-red">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="backdrop-description" className="font-display text-xs uppercase tracking-wide">
              Description
            </Label>
            <textarea
              id="backdrop-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Notes about this backdrop..."
              maxLength={MAX_DESCRIPTION_LENGTH}
              rows={3}
              className="w-full resize-none border-3 border-ink bg-parchment-100 px-3 py-2 font-body text-ink placeholder:text-ink-faded focus:outline-none focus:ring-2 focus:ring-ink"
            />
          </div>

          <DialogFooter className="pt-4">
            <div className="flex w-full justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={isSubmitting}>
                Create
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
