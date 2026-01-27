import * as React from 'react'
import type { Character, CharacterClass, Alignment, UpdateCharacterRequest } from '@gygax/shared'
import { ImageUpload } from './ImageUpload'
import { getModifier, formatModifier, getThac0 } from '../utils/bxRules'

interface CharacterSheetProps {
  character: Character
  onUpdate: (data: UpdateCharacterRequest) => Promise<void>
  onAvatarUpload: (file: File) => Promise<void>
  onAvatarRemove: () => Promise<void>
}

const CHARACTER_CLASSES: CharacterClass[] = [
  'Fighter',
  'Magic-User',
  'Cleric',
  'Thief',
  'Elf',
  'Dwarf',
  'Halfling',
]

const ALIGNMENTS: Alignment[] = ['Lawful', 'Neutral', 'Chaotic']

interface EditableFieldProps {
  value: string | number
  onChange: (value: string) => void
  type?: 'text' | 'number' | 'textarea'
  className?: string
  min?: number
  max?: number
  placeholder?: string
}

function EditableField({
  value,
  onChange,
  type = 'text',
  className = '',
  min,
  max,
  placeholder,
}: EditableFieldProps) {
  const [localValue, setLocalValue] = React.useState(String(value))
  const [isFocused, setIsFocused] = React.useState(false)

  React.useEffect(() => {
    if (!isFocused) {
      setLocalValue(String(value))
    }
  }, [value, isFocused])

  const handleBlur = () => {
    setIsFocused(false)
    if (localValue !== String(value)) {
      onChange(localValue)
    }
  }

  if (type === 'textarea') {
    return (
      <textarea
        value={localValue}
        onChange={(e) => setLocalValue(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={handleBlur}
        placeholder={placeholder}
        className={`w-full resize-none border-0 border-b-2 border-ink-faded bg-transparent px-1 py-1 font-body text-ink focus:border-ink focus:outline-none ${className}`}
        rows={4}
      />
    )
  }

  return (
    <input
      type={type}
      value={localValue}
      onChange={(e) => setLocalValue(e.target.value)}
      onFocus={() => setIsFocused(true)}
      onBlur={handleBlur}
      min={min}
      max={max}
      placeholder={placeholder}
      className={`w-full border-0 border-b-2 border-ink-faded bg-transparent px-1 py-1 font-body text-ink focus:border-ink focus:outline-none ${className}`}
    />
  )
}

export function CharacterSheet({
  character,
  onUpdate,
  onAvatarUpload,
  onAvatarRemove,
}: CharacterSheetProps) {
  const [isSaving, setIsSaving] = React.useState(false)

  const handleFieldUpdate = async (field: keyof UpdateCharacterRequest, value: unknown) => {
    setIsSaving(true)
    try {
      await onUpdate({ [field]: value })
    } finally {
      setIsSaving(false)
    }
  }

  const handleNumberUpdate = async (field: keyof UpdateCharacterRequest, value: string) => {
    const num = parseInt(value, 10)
    if (!isNaN(num)) {
      await handleFieldUpdate(field, num)
    }
  }

  const handleAvatarChange = async (file: File | null) => {
    if (file) {
      await onAvatarUpload(file)
    }
  }

  const thac0 = getThac0(character.class, character.level)

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      {/* Header Section */}
      <section className="border-3 border-ink bg-parchment-100 p-6">
        <div className="flex gap-6">
          {/* Avatar */}
          <div className="flex-shrink-0">
            <ImageUpload
              value={character.avatarUrl}
              onChange={handleAvatarChange}
              onRemove={onAvatarRemove}
              className="w-32"
              aspectRatio="3/4"
              compact
            />
          </div>

          {/* Identity Fields */}
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block font-display text-xs uppercase tracking-wide text-ink-soft">
                  Character Name
                </label>
                <EditableField
                  value={character.name}
                  onChange={(v) => handleFieldUpdate('name', v)}
                  className="text-xl font-display uppercase"
                />
              </div>
              <div>
                <label className="block font-display text-xs uppercase tracking-wide text-ink-soft">
                  Title
                </label>
                <EditableField
                  value={character.title || ''}
                  onChange={(v) => handleFieldUpdate('title', v || null)}
                  placeholder="(optional)"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block font-display text-xs uppercase tracking-wide text-ink-soft">
                  Class
                </label>
                <select
                  value={character.class}
                  onChange={(e) => handleFieldUpdate('class', e.target.value as CharacterClass)}
                  className="w-full border-0 border-b-2 border-ink-faded bg-transparent px-1 py-1 font-body text-ink focus:border-ink focus:outline-none"
                >
                  {CHARACTER_CLASSES.map((cls) => (
                    <option key={cls} value={cls}>
                      {cls}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-display text-xs uppercase tracking-wide text-ink-soft">
                  Level
                </label>
                <EditableField
                  type="number"
                  value={character.level}
                  onChange={(v) => handleNumberUpdate('level', v)}
                  min={1}
                  max={14}
                />
              </div>
              <div>
                <label className="block font-display text-xs uppercase tracking-wide text-ink-soft">
                  Alignment
                </label>
                <select
                  value={character.alignment || ''}
                  onChange={(e) =>
                    handleFieldUpdate('alignment', e.target.value ? (e.target.value as Alignment) : null)
                  }
                  className="w-full border-0 border-b-2 border-ink-faded bg-transparent px-1 py-1 font-body text-ink focus:border-ink focus:outline-none"
                >
                  <option value="">—</option>
                  {ALIGNMENTS.map((align) => (
                    <option key={align} value={align}>
                      {align}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Ability Scores */}
      <section className="border-3 border-ink bg-parchment-100 p-6">
        <h2 className="mb-4 font-display text-sm uppercase tracking-wide text-ink">
          Ability Scores
        </h2>
        <div className="grid grid-cols-6 gap-4">
          {[
            { key: 'strength', label: 'STR' },
            { key: 'intelligence', label: 'INT' },
            { key: 'wisdom', label: 'WIS' },
            { key: 'dexterity', label: 'DEX' },
            { key: 'constitution', label: 'CON' },
            { key: 'charisma', label: 'CHA' },
          ].map(({ key, label }) => {
            const score = character[key as keyof Character] as number
            const mod = getModifier(score)
            return (
              <div key={key} className="text-center">
                <label className="block font-display text-xs uppercase tracking-wide text-ink-soft">
                  {label}
                </label>
                <div className="mt-1 border-3 border-ink bg-parchment-200 p-2">
                  <input
                    type="number"
                    value={score}
                    onChange={(e) => handleNumberUpdate(key as keyof UpdateCharacterRequest, e.target.value)}
                    min={3}
                    max={18}
                    className="w-full bg-transparent text-center font-body text-2xl text-ink focus:outline-none"
                  />
                  <div className="mt-1 font-body text-sm text-ink-soft">
                    {formatModifier(mod)}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </section>

      {/* Combat Stats */}
      <section className="border-3 border-ink bg-parchment-100 p-6">
        <h2 className="mb-4 font-display text-sm uppercase tracking-wide text-ink">Combat</h2>
        <div className="grid grid-cols-4 gap-4">
          <div className="text-center">
            <label className="block font-display text-xs uppercase tracking-wide text-ink-soft">
              HP
            </label>
            <div className="mt-1 border-3 border-ink bg-parchment-200 p-2">
              <div className="flex items-center justify-center gap-1">
                <input
                  type="number"
                  value={character.hitPointsCurrent}
                  onChange={(e) => handleNumberUpdate('hitPointsCurrent', e.target.value)}
                  className="w-12 bg-transparent text-center font-body text-2xl text-ink focus:outline-none"
                />
                <span className="font-body text-ink-soft">/</span>
                <input
                  type="number"
                  value={character.hitPointsMax}
                  onChange={(e) => handleNumberUpdate('hitPointsMax', e.target.value)}
                  min={0}
                  className="w-12 bg-transparent text-center font-body text-2xl text-ink focus:outline-none"
                />
              </div>
              <div className="font-body text-xs text-ink-faded">(current/max)</div>
            </div>
          </div>
          <div className="text-center">
            <label className="block font-display text-xs uppercase tracking-wide text-ink-soft">
              AC
            </label>
            <div className="mt-1 border-3 border-ink bg-parchment-200 p-2">
              <input
                type="number"
                value={character.armorClass}
                onChange={(e) => handleNumberUpdate('armorClass', e.target.value)}
                className="w-full bg-transparent text-center font-body text-2xl text-ink focus:outline-none"
              />
              <div className="font-body text-xs text-ink-faded">(descending)</div>
            </div>
          </div>
          <div className="text-center">
            <label className="block font-display text-xs uppercase tracking-wide text-ink-soft">
              THAC0
            </label>
            <div className="mt-1 border-3 border-ink bg-parchment-200 p-2">
              <div className="font-body text-2xl text-ink">{thac0}</div>
              <div className="font-body text-xs text-ink-faded">(calculated)</div>
            </div>
          </div>
          <div className="text-center">
            <label className="block font-display text-xs uppercase tracking-wide text-ink-soft">
              Movement
            </label>
            <div className="mt-1 border-3 border-ink bg-parchment-200 p-2">
              <div className="font-body text-2xl text-ink">120&apos;</div>
              <div className="font-body text-xs text-ink-faded">(base)</div>
            </div>
          </div>
        </div>
      </section>

      {/* Saving Throws */}
      <section className="border-3 border-ink bg-parchment-100 p-6">
        <h2 className="mb-4 font-display text-sm uppercase tracking-wide text-ink">
          Saving Throws
        </h2>
        <div className="grid grid-cols-5 gap-4">
          {[
            { key: 'saveDeathRay', label: 'Death Ray' },
            { key: 'saveWands', label: 'Wands' },
            { key: 'saveParalysis', label: 'Paralysis' },
            { key: 'saveBreath', label: 'Breath' },
            { key: 'saveSpells', label: 'Spells' },
          ].map(({ key, label }) => (
            <div key={key} className="text-center">
              <label className="block font-display text-xs uppercase tracking-wide text-ink-soft">
                {label}
              </label>
              <div className="mt-1 border-3 border-ink bg-parchment-200 p-2">
                <input
                  type="number"
                  value={character[key as keyof Character] as number}
                  onChange={(e) => handleNumberUpdate(key as keyof UpdateCharacterRequest, e.target.value)}
                  min={1}
                  className="w-full bg-transparent text-center font-body text-xl text-ink focus:outline-none"
                />
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Resources */}
      <section className="border-3 border-ink bg-parchment-100 p-6">
        <h2 className="mb-4 font-display text-sm uppercase tracking-wide text-ink">Resources</h2>
        <div className="grid grid-cols-2 gap-6">
          <div>
            <label className="block font-display text-xs uppercase tracking-wide text-ink-soft">
              Experience Points
            </label>
            <EditableField
              type="number"
              value={character.experiencePoints}
              onChange={(v) => handleNumberUpdate('experiencePoints', v)}
              min={0}
              className="text-lg"
            />
          </div>
          <div>
            <label className="block font-display text-xs uppercase tracking-wide text-ink-soft">
              Gold Pieces
            </label>
            <EditableField
              type="number"
              value={character.goldPieces}
              onChange={(v) => handleNumberUpdate('goldPieces', v)}
              min={0}
              className="text-lg"
            />
          </div>
        </div>
      </section>

      {/* Equipment */}
      <section className="border-3 border-ink bg-parchment-100 p-6">
        <h2 className="mb-4 font-display text-sm uppercase tracking-wide text-ink">Equipment</h2>
        <EditableField
          type="textarea"
          value={character.equipment || ''}
          onChange={(v) => handleFieldUpdate('equipment', v || null)}
          placeholder="List your equipment here..."
          className="min-h-[120px]"
        />
      </section>

      {/* Spells */}
      <section className="border-3 border-ink bg-parchment-100 p-6">
        <h2 className="mb-4 font-display text-sm uppercase tracking-wide text-ink">Spells</h2>
        <EditableField
          type="textarea"
          value={character.spells || ''}
          onChange={(v) => handleFieldUpdate('spells', v || null)}
          placeholder="List your spells here..."
          className="min-h-[120px]"
        />
      </section>

      {/* Notes */}
      <section className="border-3 border-ink bg-parchment-100 p-6">
        <h2 className="mb-4 font-display text-sm uppercase tracking-wide text-ink">Notes</h2>
        <EditableField
          type="textarea"
          value={character.notes || ''}
          onChange={(v) => handleFieldUpdate('notes', v || null)}
          placeholder="Additional notes, backstory, etc..."
          className="min-h-[120px]"
        />
      </section>

      {/* Saving indicator */}
      {isSaving && (
        <div className="fixed bottom-4 right-4 rounded border-2 border-ink bg-parchment-100 px-4 py-2 font-body text-sm text-ink-soft shadow-brutal">
          Saving...
        </div>
      )}
    </div>
  )
}
