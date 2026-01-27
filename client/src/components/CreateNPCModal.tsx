import * as React from 'react'
import type { NPCListItem, NPCExportFile, CreateNPCRequest } from '@gygax/shared'
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

export interface NPCFormData extends CreateNPCRequest {
  name: string
}

interface CreateNPCModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: NPCFormData) => Promise<void>
  npc?: NPCListItem | null
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

export function CreateNPCModal({
  open,
  onClose,
  onSubmit,
  npc,
}: CreateNPCModalProps) {
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [npcClass, setNpcClass] = React.useState<string>('')
  const [importedData, setImportedData] = React.useState<NPCExportFile['npc'] | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errors, setErrors] = React.useState<{ name?: string; import?: string }>({})
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const isEditing = !!npc

  React.useEffect(() => {
    if (open) {
      if (npc) {
        setName(npc.name)
        setDescription(npc.description || '')
        setNpcClass(npc.class || '')
      } else {
        setName('')
        setDescription('')
        setNpcClass('')
        setImportedData(null)
      }
      setErrors({})
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }, [open, npc])

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
      const formData: NPCFormData = {
        name: name.trim(),
        description: description.trim() || undefined,
        class: npcClass || undefined,
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
      const data = JSON.parse(text) as NPCExportFile

      if (data.version !== 1) {
        setErrors({ import: 'Unsupported file version' })
        return
      }

      if (!data.npc?.name) {
        setErrors({ import: 'Invalid NPC file: missing name' })
        return
      }

      // Pre-fill form fields
      setName(data.npc.name)
      setDescription(data.npc.description || '')
      setNpcClass(data.npc.class || '')
      setImportedData(data.npc)
      setErrors({})
    } catch {
      setErrors({ import: 'Invalid file format' })
    }
  }

  const handleClearImport = () => {
    setImportedData(null)
    setName('')
    setDescription('')
    setNpcClass('')
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
    setErrors({})
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit NPC' : 'Create NPC'}</DialogTitle>
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
                    accept=".json,.npc.gygax.json"
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
                  Import a .npc.gygax.json file
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
            <Label htmlFor="name" className="font-display text-xs uppercase tracking-wide">
              Name *
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Who is this NPC?"
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
              placeholder="Role, personality, notes for the DM..."
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
              value={npcClass}
              onChange={(e) => setNpcClass(e.target.value)}
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
              Leave blank for classless NPCs (villagers, monsters, etc.)
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
