import * as React from 'react'
import type { Adventure } from '@gygax/shared'
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
import { Textarea } from './ui/textarea'
import { ImageUpload } from './ImageUpload'

export interface AdventureFormData {
  name: string
  description: string
  coverImage: File | null | undefined
  focusX: number
  focusY: number
}

interface CreateAdventureModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: AdventureFormData) => Promise<void>
  onDelete?: () => void
  adventure?: Adventure | null
}

const MAX_NAME_LENGTH = 100
const MAX_DESCRIPTION_LENGTH = 1000

export function CreateAdventureModal({
  open,
  onClose,
  onSubmit,
  onDelete,
  adventure,
}: CreateAdventureModalProps) {
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [coverImage, setCoverImage] = React.useState<File | string | null>(null)
  const [focusX, setFocusX] = React.useState(50)
  const [focusY, setFocusY] = React.useState(50)
  const [removeCoverImage, setRemoveCoverImage] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errors, setErrors] = React.useState<{ name?: string; description?: string }>({})

  const isEditing = !!adventure

  React.useEffect(() => {
    if (open) {
      if (adventure) {
        setName(adventure.name)
        setDescription(adventure.description || '')
        setCoverImage(adventure.coverImageUrl)
        setFocusX(adventure.coverImageFocusX ?? 50)
        setFocusY(adventure.coverImageFocusY ?? 50)
        setRemoveCoverImage(false)
      } else {
        setName('')
        setDescription('')
        setCoverImage(null)
        setFocusX(50)
        setFocusY(50)
        setRemoveCoverImage(false)
      }
      setErrors({})
    }
  }, [open, adventure])

  const validateForm = (): boolean => {
    const newErrors: { name?: string; description?: string } = {}

    const trimmedName = name.trim()
    if (!trimmedName) {
      newErrors.name = 'Name is required'
    } else if (trimmedName.length > MAX_NAME_LENGTH) {
      newErrors.name = `Name must be ${MAX_NAME_LENGTH} characters or less`
    }

    const trimmedDescription = description.trim()
    if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH) {
      newErrors.description = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    try {
      // undefined = no change, null = explicitly remove, File = new upload
      let imageToSubmit: File | null | undefined
      if (removeCoverImage) {
        imageToSubmit = null
      } else if (coverImage instanceof File) {
        imageToSubmit = coverImage
      } else {
        imageToSubmit = undefined
      }
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        coverImage: imageToSubmit,
        focusX,
        focusY,
      })
      onClose()
    } catch {
      // Error handling is done in parent component
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCoverImageChange = (file: File | null) => {
    setCoverImage(file)
    setRemoveCoverImage(false)
    // Reset focal point to center when selecting a new image
    if (file) {
      setFocusX(50)
      setFocusY(50)
    }
  }

  const handleRemoveCoverImage = () => {
    setCoverImage(null)
    setRemoveCoverImage(true)
    setFocusX(50)
    setFocusY(50)
  }

  const handleFocusChange = (x: number, y: number) => {
    setFocusX(x)
    setFocusY(y)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Adventure' : 'Forge a New Adventure'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="font-display text-xs uppercase tracking-wide">
              Cover Art <span className="font-body text-ink-faded">(optional)</span>
            </Label>
            <ImageUpload
              value={coverImage}
              onChange={handleCoverImageChange}
              onRemove={handleRemoveCoverImage}
              focusX={focusX}
              focusY={focusY}
              onFocusChange={handleFocusChange}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="font-display text-xs uppercase tracking-wide">
              Adventure Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What shall this adventure be called?"
              error={!!errors.name}
              maxLength={MAX_NAME_LENGTH + 10}
            />
            {errors.name && <p className="font-body text-sm text-blood-red">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="font-display text-xs uppercase tracking-wide">
              Description <span className="font-body text-ink-faded">(optional)</span>
            </Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the nature of this adventure..."
              rows={4}
              error={!!errors.description}
              maxLength={MAX_DESCRIPTION_LENGTH + 10}
            />
            {errors.description && (
              <p className="font-body text-sm text-blood-red">{errors.description}</p>
            )}
          </div>

          <DialogFooter className="pt-4">
            <div className="flex w-full items-center justify-between">
              {isEditing && onDelete ? (
                <Button
                  type="button"
                  variant="destructive"
                  onClick={onDelete}
                  disabled={isSubmitting}
                >
                  Delete
                </Button>
              ) : (
                <div />
              )}
              <div className="flex gap-2">
                <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={isSubmitting}>
                  {isEditing ? 'Save' : 'Create'}
                </Button>
              </div>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
