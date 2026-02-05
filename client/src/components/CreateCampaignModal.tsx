import * as React from 'react'
import type { Campaign } from '@gygax/shared'
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
import { BannerUpload } from './BannerUpload'

export interface CampaignFormData {
  name: string
  description: string
  bannerImage: File | null | undefined
  hotspotX: number
  hotspotY: number
}

interface CreateCampaignModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: CampaignFormData) => Promise<void>
  onDelete?: () => void
  campaign?: Campaign | null
}

const MAX_NAME_LENGTH = 100
const MAX_DESCRIPTION_LENGTH = 1000

export function CreateCampaignModal({
  open,
  onClose,
  onSubmit,
  onDelete,
  campaign,
}: CreateCampaignModalProps) {
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [bannerImage, setBannerImage] = React.useState<File | string | null>(null)
  const [hotspotX, setHotspotX] = React.useState(50)
  const [hotspotY, setHotspotY] = React.useState(50)
  const [removeBannerImage, setRemoveBannerImage] = React.useState(false)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errors, setErrors] = React.useState<{ name?: string; description?: string }>({})

  const isEditing = !!campaign

  React.useEffect(() => {
    if (open) {
      if (campaign) {
        setName(campaign.name)
        setDescription(campaign.description || '')
        setBannerImage(campaign.bannerImageUrl)
        setHotspotX(campaign.bannerHotspotX ?? 50)
        setHotspotY(campaign.bannerHotspotY ?? 50)
        setRemoveBannerImage(false)
      } else {
        setName('')
        setDescription('')
        setBannerImage(null)
        setHotspotX(50)
        setHotspotY(50)
        setRemoveBannerImage(false)
      }
      setErrors({})
    }
  }, [open, campaign])

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
      if (removeBannerImage) {
        imageToSubmit = null
      } else if (bannerImage instanceof File) {
        imageToSubmit = bannerImage
      } else {
        imageToSubmit = undefined
      }
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        bannerImage: imageToSubmit,
        hotspotX,
        hotspotY,
      })
      onClose()
    } catch {
      // Error handling is done in parent component
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleBannerImageChange = (file: File | null) => {
    setBannerImage(file)
    setRemoveBannerImage(false)
    // Reset hotspot to center when selecting a new image
    if (file) {
      setHotspotX(50)
      setHotspotY(50)
    }
  }

  const handleRemoveBannerImage = () => {
    setBannerImage(null)
    setRemoveBannerImage(true)
    setHotspotX(50)
    setHotspotY(50)
  }

  const handleHotspotChange = (x: number, y: number) => {
    setHotspotX(x)
    setHotspotY(y)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-lg" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Campaign' : 'Create New Campaign'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label className="font-display text-xs uppercase tracking-wide">
              Campaign Banner <span className="font-body text-ink-faded">(optional)</span>
            </Label>
            <BannerUpload
              value={bannerImage}
              onChange={handleBannerImageChange}
              onRemove={handleRemoveBannerImage}
              hotspotX={hotspotX}
              hotspotY={hotspotY}
              onHotspotChange={handleHotspotChange}
            />
            <p className="font-body text-xs text-ink-faded">
              Recommended: 1200x400 (3:1 ratio) landscape image
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="font-display text-xs uppercase tracking-wide">
              Campaign Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What shall this campaign be called?"
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
              placeholder="Describe the nature of this campaign..."
              rows={3}
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
