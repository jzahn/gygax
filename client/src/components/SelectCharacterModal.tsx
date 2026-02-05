import * as React from 'react'
import type { Character } from '@gygax/shared'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'
import { cn } from '@/lib/utils'

interface SelectCharacterModalProps {
  open: boolean
  onClose: () => void
  onSelect: (characterId: string) => Promise<void>
  characters: Character[]
  sessionName?: string
}

function CharacterCard({
  character,
  isSelected,
  onClick,
}: {
  character: Character
  isSelected: boolean
  onClick: () => void
}) {
  const classAbbrev: Record<string, string> = {
    Fighter: 'Ftr',
    'Magic-User': 'M-U',
    Cleric: 'Clr',
    Thief: 'Thf',
    Elf: 'Elf',
    Dwarf: 'Dwf',
    Halfling: 'Hlf',
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center gap-2 border-3 p-3 transition-all',
        isSelected
          ? 'border-ink bg-parchment-200 shadow-brutal'
          : 'border-ink-soft bg-parchment-100 hover:border-ink'
      )}
    >
      <div className="flex h-16 w-16 items-center justify-center border-2 border-ink bg-parchment-200">
        {character.avatarUrl ? (
          <img
            src={character.avatarUrl}
            alt={character.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <span className="font-display text-2xl text-ink-faded">?</span>
        )}
      </div>
      <div className="text-center">
        <p className="font-display text-sm uppercase tracking-wide text-ink">
          {character.name}
        </p>
        <p className="font-body text-xs text-ink-faded">
          {classAbbrev[character.class] || character.class} {character.level}
        </p>
      </div>
    </button>
  )
}

export function SelectCharacterModal({
  open,
  onClose,
  onSelect,
  characters,
  sessionName,
}: SelectCharacterModalProps) {
  const [selectedId, setSelectedId] = React.useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (open) {
      setSelectedId(null)
    }
  }, [open])

  const handleSubmit = async () => {
    if (!selectedId) return

    setIsSubmitting(true)
    try {
      await onSelect(selectedId)
      onClose()
    } catch {
      // Error handling in parent
    } finally {
      setIsSubmitting(false)
    }
  }

  const selectedCharacter = characters.find((c) => c.id === selectedId)

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>Choose Your Adventurer</DialogTitle>
        </DialogHeader>

        {sessionName && (
          <p className="font-body text-sm text-ink-faded">
            Joining: {sessionName}
          </p>
        )}

        <div className="grid grid-cols-3 gap-3 py-4">
          {characters.map((character) => (
            <CharacterCard
              key={character.id}
              character={character}
              isSelected={selectedId === character.id}
              onClick={() => setSelectedId(character.id)}
            />
          ))}
        </div>

        {selectedCharacter && (
          <p className="font-body text-sm text-ink">
            Selected: <strong>{selectedCharacter.name}</strong>
          </p>
        )}

        <DialogFooter className="pt-4">
          <div className="flex w-full justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleSubmit}
              disabled={!selectedId}
              loading={isSubmitting}
              loadingText="Joining..."
            >
              Join Session
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
