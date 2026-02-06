import * as React from 'react'
import type { MonsterListItem, MonsterExportFile, CreateMonsterRequest } from '@gygax/shared'
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

export interface MonsterFormData extends CreateMonsterRequest {
  name: string
  portraitImage?: File | null | undefined
  hotspotX?: number
  hotspotY?: number
}

interface CreateMonsterModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: MonsterFormData) => Promise<void>
  monster?: MonsterListItem | null
}

const MAX_NAME_LENGTH = 100
const MAX_DESCRIPTION_LENGTH = 2000

const NPC_CLASSES = [
  'Fighter',
  'Magic-User',
  'Cleric',
  'Thief',
  'Elf',
  'Dwarf',
  'Halfling',
]

export function CreateMonsterModal({
  open,
  onClose,
  onSubmit,
  monster,
}: CreateMonsterModalProps) {
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [monsterClass, setMonsterClass] = React.useState<string>('')
  const [portraitImage, setPortraitImage] = React.useState<File | string | null>(null)
  const [hotspotX, setHotspotX] = React.useState(50)
  const [hotspotY, setHotspotY] = React.useState(50)
  const [removePortrait, setRemovePortrait] = React.useState(false)
  const [importedData, setImportedData] = React.useState<MonsterExportFile['monster'] | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errors, setErrors] = React.useState<{ name?: string; import?: string }>({})
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const isEditing = !!monster

  React.useEffect(() => {
    if (open) {
      if (monster) {
        setName(monster.name)
        setDescription(monster.description || '')
        setMonsterClass(monster.class || '')
        setPortraitImage(monster.avatarUrl)
        setHotspotX(monster.avatarHotspotX ?? 50)
        setHotspotY(monster.avatarHotspotY ?? 50)
        setRemovePortrait(false)
      } else {
        setName('')
        setDescription('')
        setMonsterClass('')
        setPortraitImage(null)
        setHotspotX(50)
        setHotspotY(50)
        setRemovePortrait(false)
        setImportedData(null)
      }
      setErrors({})
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [open, monster])

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

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    try {
      // undefined = no change, null = explicitly remove, File = new upload
      let imageToSubmit: File | null | undefined
      if (removePortrait) {
        imageToSubmit = null
      } else if (portraitImage instanceof File) {
        imageToSubmit = portraitImage
      } else {
        imageToSubmit = undefined
      }

      const formData: MonsterFormData = {
        name: name.trim(),
        description: description.trim() || undefined,
        class: monsterClass || undefined,
        portraitImage: imageToSubmit,
        hotspotX,
        hotspotY,
      }

      // If imported data exists, include all the imported stats
      if (importedData) {
        if (importedData.level) formData.level = importedData.level
        if (importedData.alignment) formData.alignment = importedData.alignment as 'Lawful' | 'Neutral' | 'Chaotic'
        if (importedData.title) formData.title = importedData.title
        if (importedData.strength !== null) formData.strength = importedData.strength
        if (importedData.intelligence !== null) formData.intelligence = importedData.intelligence
        if (importedData.wisdom !== null) formData.wisdom = importedData.wisdom
        if (importedData.dexterity !== null) formData.dexterity = importedData.dexterity
        if (importedData.constitution !== null) formData.constitution = importedData.constitution
        if (importedData.charisma !== null) formData.charisma = importedData.charisma
        if (importedData.hitPointsMax !== null) formData.hitPointsMax = importedData.hitPointsMax
        if (importedData.hitPointsCurrent !== null) formData.hitPointsCurrent = importedData.hitPointsCurrent
        if (importedData.armorClass !== null) formData.armorClass = importedData.armorClass
        if (importedData.saveDeathRay !== null) formData.saveDeathRay = importedData.saveDeathRay
        if (importedData.saveWands !== null) formData.saveWands = importedData.saveWands
        if (importedData.saveParalysis !== null) formData.saveParalysis = importedData.saveParalysis
        if (importedData.saveBreath !== null) formData.saveBreath = importedData.saveBreath
        if (importedData.saveSpells !== null) formData.saveSpells = importedData.saveSpells
        if (importedData.experiencePoints !== null) formData.experiencePoints = importedData.experiencePoints
        if (importedData.goldPieces !== null) formData.goldPieces = importedData.goldPieces
        if (importedData.equipment) formData.equipment = importedData.equipment
        if (importedData.spells) formData.spells = importedData.spells
        if (importedData.notes) formData.notes = importedData.notes
      }

      await onSubmit(formData)
      onClose()
    } catch {
      // Error handling is done in parent component
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text) as MonsterExportFile

      if (data.version !== 1) {
        setErrors({ import: 'Unsupported file version' })
        return
      }

      if (!data.monster?.name) {
        setErrors({ import: 'Invalid monster file: missing name' })
        return
      }

      // Pre-fill form fields
      setName(data.monster.name)
      setDescription(data.monster.description || '')
      setMonsterClass(data.monster.class || '')
      setImportedData(data.monster)
      setErrors({})
    } catch {
      setErrors({ import: 'Invalid file format' })
    }
  }

  const handleClearImport = () => {
    setImportedData(null)
    setName('')
    setDescription('')
    setMonsterClass('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setErrors({})
  }

  const handlePortraitChange = (file: File | null) => {
    setPortraitImage(file)
    setRemovePortrait(false)
    if (file) {
      setHotspotX(50)
      setHotspotY(50)
    }
  }

  const handleRemovePortrait = () => {
    setPortraitImage(null)
    setRemovePortrait(true)
    setHotspotX(50)
    setHotspotY(50)
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Monster' : 'Create Monster'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {!isEditing && (
            <>
              <div className="space-y-2">
                <Label className="font-display text-xs uppercase tracking-wide">
                  Import from file (optional)
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.monster.gygax.json"
                    onChange={handleFileChange}
                    className="flex-1 border-3 border-ink bg-parchment-100 px-3 py-2 font-body text-sm text-ink file:mr-3 file:border-0 file:bg-transparent file:font-body file:text-ink-soft"
                  />
                  {importedData && (
                    <Button type="button" variant="ghost" size="sm" onClick={handleClearImport}>
                      Clear
                    </Button>
                  )}
                </div>
                {importedData && (
                  <p className="font-body text-xs text-forest-green">
                    Imported: {importedData.name}
                    {importedData.class ? ` (Level ${importedData.level} ${importedData.class})` : ''}
                  </p>
                )}
                {errors.import && (
                  <p className="font-body text-sm text-blood-red">{errors.import}</p>
                )}
                <p className="font-body text-xs text-ink-faded">
                  Import a .monster.gygax.json file
                </p>
              </div>

              <div className="flex items-center gap-4">
                <div className="h-px flex-1 bg-ink-faded" />
                <span className="font-body text-xs text-ink-faded">or</span>
                <div className="h-px flex-1 bg-ink-faded" />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label className="font-display text-xs uppercase tracking-wide">
              Portrait <span className="font-body text-ink-faded">(optional)</span>
            </Label>
            <ImageUpload
              value={portraitImage}
              onChange={handlePortraitChange}
              onRemove={handleRemovePortrait}
              focusX={hotspotX}
              focusY={hotspotY}
              onFocusChange={(x, y) => {
                setHotspotX(x)
                setHotspotY(y)
              }}
              className="w-48"
              aspectRatio="3/4"
              compact
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="name" className="font-display text-xs uppercase tracking-wide">
              Name *
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Who is this monster?"
              error={!!errors.name}
              maxLength={MAX_NAME_LENGTH + 10}
            />
            {errors.name && <p className="font-body text-sm text-blood-red">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="description" className="font-display text-xs uppercase tracking-wide">
              Description
            </Label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What kind of creature is this?"
              maxLength={MAX_DESCRIPTION_LENGTH}
              rows={3}
              className="w-full resize-none border-3 border-ink bg-parchment-100 px-3 py-2 font-body text-ink placeholder:text-ink-faded focus:outline-none focus:ring-2 focus:ring-ink"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="class" className="font-display text-xs uppercase tracking-wide">
              Class (optional)
            </Label>
            <select
              id="class"
              value={monsterClass}
              onChange={(e) => setMonsterClass(e.target.value)}
              className="w-full border-3 border-ink bg-parchment-100 px-3 py-2 font-body text-ink focus:outline-none focus:ring-2 focus:ring-ink"
            >
              <option value="">— None —</option>
              {NPC_CLASSES.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
            <p className="font-body text-xs text-ink-faded">
              Leave blank for classless monsters
            </p>
          </div>

          <DialogFooter className="pt-4">
            <div className="flex w-full justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={isSubmitting}>
                {isEditing ? 'Save' : 'Create'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
