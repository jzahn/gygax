import * as React from 'react'
import type { Backdrop } from '@gygax/shared'
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

export interface EditBackdropFormData {
  name: string
  title?: string | null
  titleX: number
  titleY: number
  description?: string | null
  replaceImage: File | null
  focusX: number
  focusY: number
}

interface EditBackdropModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: EditBackdropFormData) => Promise<void>
  backdrop: Backdrop | null
}

const MAX_NAME_LENGTH = 100
const MAX_TITLE_LENGTH = 200
const MAX_DESCRIPTION_LENGTH = 2000

export function EditBackdropModal({
  open,
  onClose,
  onSubmit,
  backdrop,
}: EditBackdropModalProps) {
  const [name, setName] = React.useState('')
  const [title, setTitle] = React.useState('')
  const [titleX, setTitleX] = React.useState(50)
  const [titleY, setTitleY] = React.useState(50)
  const [description, setDescription] = React.useState('')
  const [replaceImage, setReplaceImage] = React.useState<File | null>(null)
  const [focusX, setFocusX] = React.useState(50)
  const [focusY, setFocusY] = React.useState(50)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errors, setErrors] = React.useState<{ name?: string }>({})
  const [positioningTitle, setPositioningTitle] = React.useState(false)
  const positioningImgRef = React.useRef<HTMLImageElement>(null)
  const [positioningImgWidth, setPositioningImgWidth] = React.useState(0)

  React.useEffect(() => {
    if (open && backdrop) {
      setName(backdrop.name)
      setTitle(backdrop.title || '')
      setTitleX(backdrop.titleX)
      setTitleY(backdrop.titleY)
      setDescription(backdrop.description || '')
      setReplaceImage(null)
      setFocusX(backdrop.focusX)
      setFocusY(backdrop.focusY)
      setErrors({})
      setPositioningTitle(false)
    }
  }, [open, backdrop])

  const imageValue = replaceImage || backdrop?.imageUrl || null

  const validateForm = (): boolean => {
    const newErrors: { name?: string } = {}

    const trimmedName = name.trim()
    if (!trimmedName) {
      newErrors.name = 'Name is required'
    } else if (trimmedName.length > MAX_NAME_LENGTH) {
      newErrors.name = `Name must be ${MAX_NAME_LENGTH} characters or less`
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
        title: title.trim() || null,
        titleX,
        titleY,
        description: description.trim() || null,
        replaceImage,
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

  // Get preview URL for title positioning
  const previewUrl = replaceImage
    ? URL.createObjectURL(replaceImage)
    : backdrop?.imageUrl || null

  const handleImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!positioningTitle || !title.trim()) return
    const rect = e.currentTarget.getBoundingClientRect()
    const x = Math.round(((e.clientX - rect.left) / rect.width) * 100)
    const y = Math.round(((e.clientY - rect.top) / rect.height) * 100)
    setTitleX(x)
    setTitleY(y)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Backdrop</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="font-display text-xs uppercase tracking-wide">Image</Label>
            {positioningTitle && previewUrl ? (
              <div className="space-y-2">
                <div
                  className="relative cursor-crosshair border-3 border-ink overflow-hidden"
                  onClick={handleImageClick}
                >
                  <img
                    ref={positioningImgRef}
                    src={previewUrl}
                    alt="Preview"
                    className="block w-full"
                    style={{ objectPosition: `${focusX}% ${focusY}%` }}
                    onLoad={() => {
                      if (positioningImgRef.current) {
                        setPositioningImgWidth(positioningImgRef.current.clientWidth)
                      }
                    }}
                  />
                  {title.trim() && positioningImgWidth > 0 && (() => {
                    const fontSize = Math.max(16, Math.min(48, positioningImgWidth * 0.036))
                    return (
                      <div
                        className="absolute pointer-events-none font-display uppercase tracking-wide text-parchment-100 text-center"
                        style={{
                          left: `${titleX}%`,
                          top: `${titleY}%`,
                          transform: 'translate(-50%, -50%)',
                          fontSize,
                          maxWidth: '90%',
                          padding: `${fontSize * 0.3}px ${fontSize * 0.6}px`,
                          backgroundColor: 'rgba(0,0,0,0.7)',
                          textShadow: '0 0 6px rgba(0,0,0,1), 2px 3px 8px rgba(0,0,0,1)',
                        }}
                      >
                        {title.trim()}
                      </div>
                    )
                  })()}
                </div>
                <div className="flex items-center justify-between">
                  <p className="font-body text-xs text-ink-faded">Click image to position title</p>
                  <button
                    type="button"
                    onClick={() => setPositioningTitle(false)}
                    className="font-body text-xs text-ink underline underline-offset-2 hover:text-ink-soft"
                  >
                    Done positioning
                  </button>
                </div>
              </div>
            ) : (
              <ImageUpload
                value={imageValue}
                onChange={(file) => setReplaceImage(file)}
                focusX={focusX}
                focusY={focusY}
                onFocusChange={(x, y) => {
                  setFocusX(x)
                  setFocusY(y)
                }}
              />
            )}
            {!positioningTitle && (
              <p className="font-body text-xs text-ink-faded">
                Click image to set focal point. Upload a new image to replace.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-backdrop-name" className="font-display text-xs uppercase tracking-wide">
              Name *
            </Label>
            <Input
              id="edit-backdrop-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What is this backdrop?"
              error={!!errors.name}
              maxLength={MAX_NAME_LENGTH + 10}
            />
            {errors.name && <p className="font-body text-sm text-blood-red">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-backdrop-title" className="font-display text-xs uppercase tracking-wide">
              Title (shown over backdrop when displayed)
            </Label>
            <Input
              id="edit-backdrop-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., The Grand Duchy of Karameikos"
              maxLength={MAX_TITLE_LENGTH}
            />
            {title.trim() && previewUrl && !positioningTitle && (
              <button
                type="button"
                onClick={() => setPositioningTitle(true)}
                className="font-body text-xs text-ink underline underline-offset-2 hover:text-ink-soft"
              >
                Position title on image
              </button>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="edit-backdrop-description" className="font-display text-xs uppercase tracking-wide">
              Description
            </Label>
            <textarea
              id="edit-backdrop-description"
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
                Save
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
