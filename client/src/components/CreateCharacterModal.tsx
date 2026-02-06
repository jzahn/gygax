import * as React from 'react'
import type { Character, CharacterClass, CharacterExportFile } from '@gygax/shared'
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
import { roll3d6, roll4d6DropLowest } from '../utils/bxRules'

export interface CharacterFormData {
  name: string
  class: CharacterClass
  strength: number
  intelligence: number
  wisdom: number
  dexterity: number
  constitution: number
  charisma: number
  portraitImage?: File | null | undefined
  hotspotX?: number
  hotspotY?: number
  // Imported stat fields (carried through from file import)
  level?: number
  alignment?: 'Lawful' | 'Neutral' | 'Chaotic'
  title?: string
  hitPointsMax?: number
  hitPointsCurrent?: number
  armorClass?: number
  saveDeathRay?: number
  saveWands?: number
  saveParalysis?: number
  saveBreath?: number
  saveSpells?: number
  experiencePoints?: number
  goldPieces?: number
  equipment?: string
  spells?: string
  notes?: string
}

interface CreateCharacterModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: CharacterFormData) => Promise<void>
  character?: Character | null
}

const MAX_NAME_LENGTH = 100

const CHARACTER_CLASSES: CharacterClass[] = [
  'Fighter',
  'Magic-User',
  'Cleric',
  'Thief',
  'Elf',
  'Dwarf',
  'Halfling',
]

const ABILITY_NAMES = [
  { key: 'strength', label: 'STR' },
  { key: 'intelligence', label: 'INT' },
  { key: 'wisdom', label: 'WIS' },
  { key: 'dexterity', label: 'DEX' },
  { key: 'constitution', label: 'CON' },
  { key: 'charisma', label: 'CHA' },
] as const

export function CreateCharacterModal({
  open,
  onClose,
  onSubmit,
  character,
}: CreateCharacterModalProps) {
  const [name, setName] = React.useState('')
  const [charClass, setCharClass] = React.useState<CharacterClass>('Fighter')
  const [abilities, setAbilities] = React.useState({
    strength: 10,
    intelligence: 10,
    wisdom: 10,
    dexterity: 10,
    constitution: 10,
    charisma: 10,
  })
  const [portraitImage, setPortraitImage] = React.useState<File | string | null>(null)
  const [hotspotX, setHotspotX] = React.useState(50)
  const [hotspotY, setHotspotY] = React.useState(50)
  const [removePortrait, setRemovePortrait] = React.useState(false)
  const [importedData, setImportedData] = React.useState<CharacterExportFile['character'] | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errors, setErrors] = React.useState<{ name?: string; import?: string }>({})
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const isEditing = !!character

  React.useEffect(() => {
    if (open) {
      if (character) {
        setName(character.name)
        setCharClass(character.class)
        setAbilities({
          strength: character.strength,
          intelligence: character.intelligence,
          wisdom: character.wisdom,
          dexterity: character.dexterity,
          constitution: character.constitution,
          charisma: character.charisma,
        })
        setPortraitImage(character.avatarUrl)
        setHotspotX(character.avatarHotspotX ?? 50)
        setHotspotY(character.avatarHotspotY ?? 50)
        setRemovePortrait(false)
      } else {
        setName('')
        setCharClass('Fighter')
        setAbilities({
          strength: 10,
          intelligence: 10,
          wisdom: 10,
          dexterity: 10,
          constitution: 10,
          charisma: 10,
        })
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
  }, [open, character])

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

      const formData: CharacterFormData = {
        name: name.trim(),
        class: charClass,
        ...abilities,
        portraitImage: imageToSubmit,
        hotspotX,
        hotspotY,
      }

      // Include imported stats if present
      if (importedData) {
        if (importedData.level) formData.level = importedData.level
        if (importedData.alignment) formData.alignment = importedData.alignment as 'Lawful' | 'Neutral' | 'Chaotic'
        if (importedData.title) formData.title = importedData.title
        if (importedData.hitPointsMax) formData.hitPointsMax = importedData.hitPointsMax
        if (importedData.hitPointsCurrent) formData.hitPointsCurrent = importedData.hitPointsCurrent
        if (importedData.armorClass) formData.armorClass = importedData.armorClass
        if (importedData.saveDeathRay) formData.saveDeathRay = importedData.saveDeathRay
        if (importedData.saveWands) formData.saveWands = importedData.saveWands
        if (importedData.saveParalysis) formData.saveParalysis = importedData.saveParalysis
        if (importedData.saveBreath) formData.saveBreath = importedData.saveBreath
        if (importedData.saveSpells) formData.saveSpells = importedData.saveSpells
        if (importedData.experiencePoints) formData.experiencePoints = importedData.experiencePoints
        if (importedData.goldPieces) formData.goldPieces = importedData.goldPieces
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

  const handleAbilityChange = (key: keyof typeof abilities, value: string) => {
    const num = parseInt(value, 10)
    if (isNaN(num)) return
    const clamped = Math.max(3, Math.min(18, num))
    setAbilities((prev) => ({ ...prev, [key]: clamped }))
  }

  const handleRoll3d6 = () => {
    setAbilities({
      strength: roll3d6(),
      intelligence: roll3d6(),
      wisdom: roll3d6(),
      dexterity: roll3d6(),
      constitution: roll3d6(),
      charisma: roll3d6(),
    })
  }

  const handleRoll4d6 = () => {
    setAbilities({
      strength: roll4d6DropLowest(),
      intelligence: roll4d6DropLowest(),
      wisdom: roll4d6DropLowest(),
      dexterity: roll4d6DropLowest(),
      constitution: roll4d6DropLowest(),
      charisma: roll4d6DropLowest(),
    })
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

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    try {
      const text = await file.text()
      const data = JSON.parse(text) as CharacterExportFile

      if (data.version !== 1) {
        setErrors({ import: 'Unsupported file version' })
        return
      }

      if (!data.character?.name) {
        setErrors({ import: 'Invalid character file: missing name' })
        return
      }

      // Pre-fill form fields
      setName(data.character.name)
      setCharClass(data.character.class || 'Fighter')
      setAbilities({
        strength: data.character.strength ?? 10,
        intelligence: data.character.intelligence ?? 10,
        wisdom: data.character.wisdom ?? 10,
        dexterity: data.character.dexterity ?? 10,
        constitution: data.character.constitution ?? 10,
        charisma: data.character.charisma ?? 10,
      })
      setImportedData(data.character)
      setErrors({})
    } catch {
      setErrors({ import: 'Invalid file format' })
    }
  }

  const handleClearImport = () => {
    setImportedData(null)
    setName('')
    setCharClass('Fighter')
    setAbilities({
      strength: 10,
      intelligence: 10,
      wisdom: 10,
      dexterity: 10,
      constitution: 10,
      charisma: 10,
    })
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setErrors({})
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Character' : 'Create New Character'}</DialogTitle>
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
                    accept=".json,.character.gygax.json"
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
                  Import a .character.gygax.json file
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
              Character Name
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What is your name, adventurer?"
              error={!!errors.name}
              maxLength={MAX_NAME_LENGTH + 10}
            />
            {errors.name && <p className="font-body text-sm text-blood-red">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="class" className="font-display text-xs uppercase tracking-wide">
              Class
            </Label>
            <select
              id="class"
              value={charClass}
              onChange={(e) => setCharClass(e.target.value as CharacterClass)}
              className="w-full border-3 border-ink bg-parchment-100 px-3 py-2 font-body text-ink focus:outline-none focus:ring-2 focus:ring-ink"
            >
              {CHARACTER_CLASSES.map((cls) => (
                <option key={cls} value={cls}>
                  {cls}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="font-display text-xs uppercase tracking-wide">
                Ability Scores
              </Label>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRoll3d6}
                  className="text-xs"
                >
                  Roll 3d6
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleRoll4d6}
                  className="text-xs"
                >
                  Roll 4d6
                </Button>
              </div>
            </div>
            <div className="grid grid-cols-6 gap-2">
              {ABILITY_NAMES.map(({ key, label }) => (
                <div key={key} className="text-center">
                  <label className="block font-display text-xs uppercase tracking-wide text-ink-soft">
                    {label}
                  </label>
                  <input
                    type="number"
                    min={3}
                    max={18}
                    value={abilities[key]}
                    onChange={(e) => handleAbilityChange(key, e.target.value)}
                    className="mt-1 w-full border-3 border-ink bg-parchment-100 px-1 py-2 text-center font-body text-lg text-ink focus:outline-none focus:ring-2 focus:ring-ink"
                  />
                </div>
              ))}
            </div>
            <p className="font-body text-xs text-ink-faded">
              Enter values 3-18 or use the roll buttons
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
