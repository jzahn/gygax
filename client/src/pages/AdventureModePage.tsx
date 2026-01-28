import * as React from 'react'
import type { Character, CharacterListResponse, CharacterResponse } from '@gygax/shared'
import { Button } from '../components/ui'
import { CharacterCard } from '../components/CharacterCard'
import { CreateCharacterModal, CharacterFormData } from '../components/CreateCharacterModal'
import { DeleteCharacterDialog } from '../components/DeleteCharacterDialog'

const API_URL = import.meta.env.VITE_API_URL || ''

export function AdventureModePage() {
  const [characters, setCharacters] = React.useState<Character[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false)
  const [editingCharacter, setEditingCharacter] = React.useState<Character | null>(null)
  const [deletingCharacter, setDeletingCharacter] = React.useState<Character | null>(null)

  const fetchCharacters = React.useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/characters`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch characters')
      }

      const data: CharacterListResponse = await response.json()
      setCharacters(data.characters)
    } catch {
      setError('Failed to load characters')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchCharacters()
  }, [fetchCharacters])

  const handleCreateCharacter = async (data: CharacterFormData) => {
    const response = await fetch(`${API_URL}/api/characters`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error('Failed to create character')
    }

    const result: CharacterResponse = await response.json()
    setCharacters((prev) => [result.character, ...prev])
    setIsCreateModalOpen(false)
  }

  const handleEditCharacter = async (data: CharacterFormData) => {
    if (!editingCharacter) return

    const response = await fetch(`${API_URL}/api/characters/${editingCharacter.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error('Failed to update character')
    }

    const result: CharacterResponse = await response.json()
    setCharacters((prev) =>
      prev.map((c) => (c.id === result.character.id ? result.character : c))
    )
    setEditingCharacter(null)
  }

  const handleDeleteCharacter = async () => {
    if (!deletingCharacter) return

    const response = await fetch(`${API_URL}/api/characters/${deletingCharacter.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to delete character')
    }

    setCharacters((prev) => prev.filter((c) => c.id !== deletingCharacter.id))
    setDeletingCharacter(null)
  }

  return (
    <>
      <div className="mx-auto max-w-6xl p-6 md:p-8">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl uppercase tracking-wide text-ink md:text-3xl">
              Adventure
            </h1>
            <p className="mt-1 font-body italic text-ink-soft">
              Create characters and embark on epic quests hosted by other players
            </p>
          </div>
          <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
            + New Character
          </Button>
        </header>

        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg uppercase tracking-wide text-ink">
            Characters
          </h2>
          {characters.length > 0 && (
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsCreateModalOpen(true)}
            >
              + New Character
            </Button>
          )}
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <span className="animate-quill-scratch text-4xl">&#9998;</span>
            <span className="ml-4 font-body text-ink-soft">Loading your characters...</span>
          </div>
        ) : error ? (
          <div className="rounded border-3 border-blood-red bg-parchment-100 p-6 text-center">
            <p className="font-body text-blood-red">{error}</p>
            <Button variant="ghost" onClick={fetchCharacters} className="mt-4">
              Try again
            </Button>
          </div>
        ) : characters.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 text-ink-soft">
              &#9876; &#9552;&#9552;&#9552;&#9552;&#9552;&#9552; &#9876;
            </div>
            <h2 className="font-display text-xl uppercase tracking-wide text-ink">
              No characters yet
            </h2>
            <p className="mt-2 max-w-md font-body text-ink-soft">
              Every hero starts somewhere. Create your first character to begin your adventures.
            </p>
            <Button
              variant="primary"
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-6"
            >
              Create Character
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {characters.map((character) => (
              <CharacterCard
                key={character.id}
                character={character}
                onEdit={setEditingCharacter}
                onDelete={setDeletingCharacter}
              />
            ))}
          </div>
        )}
      </div>

      <CreateCharacterModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSubmit={handleCreateCharacter}
      />

      <CreateCharacterModal
        open={!!editingCharacter}
        onClose={() => setEditingCharacter(null)}
        onSubmit={handleEditCharacter}
        character={editingCharacter}
      />

      <DeleteCharacterDialog
        open={!!deletingCharacter}
        onClose={() => setDeletingCharacter(null)}
        onConfirm={handleDeleteCharacter}
        character={deletingCharacter}
      />
    </>
  )
}
