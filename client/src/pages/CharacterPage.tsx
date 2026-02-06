import * as React from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import type { Character, CharacterResponse, UpdateCharacterRequest } from '@gygax/shared'
import { Button } from '../components/ui'
import { CharacterSheet } from '../components/CharacterSheet'
import { DeleteCharacterDialog } from '../components/DeleteCharacterDialog'
import { exportCharacter } from '../utils/characterExport'

const API_URL = import.meta.env.VITE_API_URL || ''

export function CharacterPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [character, setCharacter] = React.useState<Character | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)

  const fetchCharacter = React.useCallback(async () => {
    if (!id) return

    try {
      const response = await fetch(`${API_URL}/api/characters/${id}`, {
        credentials: 'include',
      })

      if (response.status === 404) {
        setError('Character not found')
        return
      }

      if (response.status === 403) {
        setError('You do not have access to this character')
        return
      }

      if (!response.ok) {
        throw new Error('Failed to fetch character')
      }

      const data: CharacterResponse = await response.json()
      setCharacter(data.character)
    } catch {
      setError('Failed to load character')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    fetchCharacter()
  }, [fetchCharacter])

  const handleUpdate = async (data: UpdateCharacterRequest) => {
    if (!character) return

    const response = await fetch(`${API_URL}/api/characters/${character.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error('Failed to update character')
    }

    const result: CharacterResponse = await response.json()
    setCharacter(result.character)
  }

  const handleAvatarUpload = async (file: File) => {
    if (!character) return

    const formData = new FormData()
    formData.append('image', file)

    const response = await fetch(`${API_URL}/api/characters/${character.id}/avatar`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Failed to upload avatar')
    }

    const result: CharacterResponse = await response.json()
    setCharacter(result.character)
  }

  const handleAvatarRemove = async () => {
    if (!character) return

    const response = await fetch(`${API_URL}/api/characters/${character.id}/avatar`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to remove avatar')
    }

    const result: CharacterResponse = await response.json()
    setCharacter(result.character)
  }

  const handleDelete = async () => {
    if (!character) return

    const response = await fetch(`${API_URL}/api/characters/${character.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to delete character')
    }

    navigate('/')
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center paper-texture">
        <span className="animate-quill-scratch text-4xl">&#9998;</span>
        <span className="ml-4 font-body text-ink-soft">Loading character...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen paper-texture">
        <div className="mx-auto max-w-2xl p-6 md:p-8">
          <div className="rounded border-3 border-blood-red bg-parchment-100 p-6 text-center">
            <p className="font-body text-blood-red">{error}</p>
            <Button variant="ghost" onClick={() => navigate('/')} className="mt-4">
              Return to Dashboard
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!character) {
    return null
  }

  return (
    <div className="min-h-screen paper-texture">
      {/* Header */}
      <header className="border-b-3 border-ink bg-parchment-100">
        <div className="mx-auto flex max-w-4xl items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Link to="/adventure" className="font-body text-sm text-ink-soft hover:text-ink">
              &larr; Back to Quest
            </Link>
            <div className="h-4 w-px bg-ink-faded" />
            <h1 className="font-display text-lg uppercase tracking-wide text-ink">
              {character.name}
            </h1>
            <span className="font-body text-sm text-ink-soft">
              Level {character.level} {character.class}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => exportCharacter(character)}>
              Export
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsDeleteDialogOpen(true)}
              className="text-blood-red"
            >
              Delete
            </Button>
          </div>
        </div>
      </header>

      {/* Character Sheet */}
      <main className="p-6 md:p-8">
        <CharacterSheet
          character={character}
          onUpdate={handleUpdate}
          onAvatarUpload={handleAvatarUpload}
          onAvatarRemove={handleAvatarRemove}
        />
      </main>

      {/* Delete Dialog */}
      <DeleteCharacterDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        character={character}
      />
    </div>
  )
}
