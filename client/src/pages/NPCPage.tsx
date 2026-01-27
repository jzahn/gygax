import * as React from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import type { NPC, NPCResponse, UpdateNPCRequest } from '@gygax/shared'
import { Button } from '../components/ui'
import { CharacterSheet } from '../components/CharacterSheet'
import { DeleteNPCDialog } from '../components/DeleteNPCDialog'
import { exportNPC } from '../utils/npcExport'

const API_URL = import.meta.env.VITE_API_URL || ''

export function NPCPage() {
  const { adventureId, npcId } = useParams<{ adventureId: string; npcId: string }>()
  const navigate = useNavigate()
  const [npc, setNpc] = React.useState<NPC | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)
  const [description, setDescription] = React.useState('')
  const [isSavingDescription, setIsSavingDescription] = React.useState(false)

  const fetchNpc = React.useCallback(async () => {
    if (!npcId) return

    try {
      const response = await fetch(`${API_URL}/api/npcs/${npcId}`, {
        credentials: 'include',
      })

      if (response.status === 404) {
        setError('NPC not found')
        return
      }

      if (response.status === 403) {
        setError('You do not have access to this NPC')
        return
      }

      if (!response.ok) {
        throw new Error('Failed to fetch NPC')
      }

      const data: NPCResponse = await response.json()
      setNpc(data.npc)
      setDescription(data.npc.description || '')
    } catch {
      setError('Failed to load NPC')
    } finally {
      setIsLoading(false)
    }
  }, [npcId])

  React.useEffect(() => {
    fetchNpc()
  }, [fetchNpc])

  const handleUpdate = async (data: UpdateNPCRequest) => {
    if (!npc) return

    const response = await fetch(`${API_URL}/api/npcs/${npc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error('Failed to update NPC')
    }

    const result: NPCResponse = await response.json()
    setNpc(result.npc)
  }

  const handleDescriptionBlur = async () => {
    if (!npc) return
    const trimmed = description.trim()
    if (trimmed === (npc.description || '')) return

    setIsSavingDescription(true)
    try {
      await handleUpdate({ description: trimmed || null })
    } finally {
      setIsSavingDescription(false)
    }
  }

  const handleAvatarUpload = async (file: File) => {
    if (!npc) return

    const formData = new FormData()
    formData.append('image', file)

    const response = await fetch(`${API_URL}/api/npcs/${npc.id}/avatar`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Failed to upload avatar')
    }

    const result: NPCResponse = await response.json()
    setNpc(result.npc)
  }

  const handleAvatarRemove = async () => {
    if (!npc) return

    const response = await fetch(`${API_URL}/api/npcs/${npc.id}/avatar`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to remove avatar')
    }

    const result: NPCResponse = await response.json()
    setNpc(result.npc)
  }

  const handleDelete = async () => {
    if (!npc) return

    const response = await fetch(`${API_URL}/api/npcs/${npc.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to delete NPC')
    }

    navigate(`/adventures/${adventureId}`)
  }

  const handleExport = () => {
    if (!npc) return
    exportNPC(npc)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center paper-texture">
        <span className="animate-quill-scratch text-4xl">&#9998;</span>
        <span className="ml-4 font-body text-ink-soft">Loading NPC...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen paper-texture">
        <div className="mx-auto max-w-2xl p-6 md:p-8">
          <div className="rounded border-3 border-blood-red bg-parchment-100 p-6 text-center">
            <p className="font-body text-blood-red">{error}</p>
            <Button
              variant="ghost"
              onClick={() => navigate(`/adventures/${adventureId}`)}
              className="mt-4"
            >
              Return to Adventure
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!npc) {
    return null
  }

  return (
    <div className="min-h-screen paper-texture">
      {/* Header */}
      <header className="border-b-3 border-ink bg-parchment-100">
        <div className="mx-auto flex max-w-4xl items-center justify-between p-4">
          <div className="flex items-center gap-4">
            <Link
              to={`/adventures/${adventureId}`}
              className="font-body text-sm text-ink-soft hover:text-ink"
            >
              &larr; Back to Adventure
            </Link>
            <div className="h-4 w-px bg-ink-faded" />
            <h1 className="font-display text-lg uppercase tracking-wide text-ink">{npc.name}</h1>
            {npc.class && (
              <span className="font-body text-sm text-ink-soft">
                Level {npc.level} {npc.class}
              </span>
            )}
            {!npc.class && (
              <span className="font-body text-sm text-ink-soft">Level {npc.level}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={handleExport}>
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

      {/* Description Section */}
      <div className="mx-auto max-w-4xl px-6 pt-6 md:px-8 md:pt-8">
        <section className="border-3 border-ink bg-parchment-100 p-4 md:p-6">
          <h2 className="mb-3 font-display text-sm uppercase tracking-wide text-ink">
            DM Description
          </h2>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleDescriptionBlur}
            placeholder="Role, personality, secrets, plot hooks..."
            className="w-full resize-none border-0 border-b-2 border-ink-faded bg-transparent px-1 py-1 font-body text-ink placeholder:text-ink-faded focus:border-ink focus:outline-none"
            rows={3}
          />
          {isSavingDescription && (
            <p className="mt-1 font-body text-xs text-ink-faded">Saving...</p>
          )}
        </section>
      </div>

      {/* Character Sheet */}
      <main className="p-6 md:p-8">
        <CharacterSheet
          character={npc}
          isNPC
          onUpdate={handleUpdate}
          onAvatarUpload={handleAvatarUpload}
          onAvatarRemove={handleAvatarRemove}
        />
      </main>

      {/* Delete Dialog */}
      <DeleteNPCDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDelete}
        npc={npc}
      />
    </div>
  )
}
