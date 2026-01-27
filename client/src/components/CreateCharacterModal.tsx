import * as React from 'react'
import type { Character, CharacterClass } from '@gygax/shared'
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
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errors, setErrors] = React.useState<{ name?: string }>({})

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
      }
      setErrors({})
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
      await onSubmit({
        name: name.trim(),
        class: charClass,
        ...abilities,
      })
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

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Character' : 'Create New Character'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
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
