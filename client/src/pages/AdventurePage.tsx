import * as React from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import type {
  Adventure,
  AdventureResponse,
  Map,
  MapListResponse,
  MapResponse,
  NPCListItem,
  NPCListResponse,
  NPCResponse,
  Backdrop,
  BackdropListResponse,
  BackdropResponse,
  Note,
  NoteListResponse,
  NoteResponse,
  SessionListItem,
  SessionListResponse,
  SessionResponse,
  SessionAccessType,
} from '@gygax/shared'
import { Button, Divider, Dialog, DialogContent, DialogHeader, DialogTitle } from '../components/ui'
import { CreateAdventureModal, AdventureFormData } from '../components/CreateAdventureModal'
import { DeleteAdventureDialog } from '../components/DeleteAdventureDialog'
import { MapCard } from '../components/MapCard'
import { MapPreview } from '../components/MapPreview'
import { CreateMapModal, MapFormData } from '../components/CreateMapModal'
import { DeleteMapDialog } from '../components/DeleteMapDialog'
import { NPCCard } from '../components/NPCCard'
import { CreateNPCModal, NPCFormData } from '../components/CreateNPCModal'
import { DeleteNPCDialog } from '../components/DeleteNPCDialog'
import { exportNPC } from '../utils/npcExport'
import { BackdropCard } from '../components/BackdropCard'
import { CreateBackdropModal, BackdropFormData } from '../components/CreateBackdropModal'
import { EditBackdropModal, EditBackdropFormData } from '../components/EditBackdropModal'
import { BackdropPreviewModal } from '../components/BackdropPreviewModal'
import { DeleteBackdropDialog } from '../components/DeleteBackdropDialog'
import { NoteCard } from '../components/NoteCard'
import { CreateNoteModal, NoteFormData } from '../components/CreateNoteModal'
import { DeleteNoteDialog } from '../components/DeleteNoteDialog'
import { SessionTypeChip } from '../components/SessionTypeChip'

const API_URL = import.meta.env.VITE_API_URL || ''

export function AdventurePage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [adventure, setAdventure] = React.useState<Adventure | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)
  const [maps, setMaps] = React.useState<Map[]>([])
  const [isLoadingMaps, setIsLoadingMaps] = React.useState(true)
  const [isCreateMapModalOpen, setIsCreateMapModalOpen] = React.useState(false)
  const [editingMap, setEditingMap] = React.useState<Map | null>(null)
  const [deletingMap, setDeletingMap] = React.useState<Map | null>(null)
  const [npcs, setNpcs] = React.useState<NPCListItem[]>([])
  const [isLoadingNpcs, setIsLoadingNpcs] = React.useState(true)
  const [isCreateNpcModalOpen, setIsCreateNpcModalOpen] = React.useState(false)
  const [editingNpc, setEditingNpc] = React.useState<NPCListItem | null>(null)
  const [deletingNpc, setDeletingNpc] = React.useState<NPCListItem | null>(null)
  const [backdrops, setBackdrops] = React.useState<Backdrop[]>([])
  const [isLoadingBackdrops, setIsLoadingBackdrops] = React.useState(true)
  const [isCreateBackdropModalOpen, setIsCreateBackdropModalOpen] = React.useState(false)
  const [editingBackdrop, setEditingBackdrop] = React.useState<Backdrop | null>(null)
  const [deletingBackdrop, setDeletingBackdrop] = React.useState<Backdrop | null>(null)
  const [previewingBackdrop, setPreviewingBackdrop] = React.useState<Backdrop | null>(null)
  const [notes, setNotes] = React.useState<Note[]>([])
  const [isLoadingNotes, setIsLoadingNotes] = React.useState(true)
  const [isCreateNoteModalOpen, setIsCreateNoteModalOpen] = React.useState(false)
  const [viewingNote, setViewingNote] = React.useState<Note | null>(null)
  const [editingNote, setEditingNote] = React.useState<Note | null>(null)
  const [deletingNote, setDeletingNote] = React.useState<Note | null>(null)
  const [campaignWorldMap, setCampaignWorldMap] = React.useState<Map | null>(null)

  // Session state
  const [existingSession, setExistingSession] = React.useState<SessionListItem | null>(null)
  const [isAccessTypeModalOpen, setIsAccessTypeModalOpen] = React.useState(false)
  const [isCreatingSession, setIsCreatingSession] = React.useState(false)

  const fetchAdventure = React.useCallback(async () => {
    if (!id) return

    try {
      const response = await fetch(`${API_URL}/api/adventures/${id}`, {
        credentials: 'include',
      })

      if (response.status === 404) {
        setError('Adventure not found')
        return
      }

      if (response.status === 403) {
        setError('You do not have access to this adventure')
        return
      }

      if (!response.ok) {
        throw new Error('Failed to fetch adventure')
      }

      const data: AdventureResponse = await response.json()
      setAdventure(data.adventure)
    } catch {
      setError('Failed to load adventure')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    fetchAdventure()
  }, [fetchAdventure])

  const fetchMaps = React.useCallback(async () => {
    if (!id) return

    try {
      const response = await fetch(`${API_URL}/api/adventures/${id}/maps`, {
        credentials: 'include',
      })

      if (!response.ok) {
        return
      }

      const data: MapListResponse = await response.json()
      setMaps(data.maps)
    } catch {
      // Silently fail - maps section will show empty
    } finally {
      setIsLoadingMaps(false)
    }
  }, [id])

  React.useEffect(() => {
    if (adventure) {
      fetchMaps()
    }
  }, [adventure, fetchMaps])

  const fetchNpcs = React.useCallback(async () => {
    if (!id) return

    try {
      const response = await fetch(`${API_URL}/api/adventures/${id}/npcs`, {
        credentials: 'include',
      })

      if (!response.ok) {
        return
      }

      const data: NPCListResponse = await response.json()
      setNpcs(data.npcs)
    } catch {
      // Silently fail - npcs section will show empty
    } finally {
      setIsLoadingNpcs(false)
    }
  }, [id])

  React.useEffect(() => {
    if (adventure) {
      fetchNpcs()
    }
  }, [adventure, fetchNpcs])

  const fetchBackdrops = React.useCallback(async () => {
    if (!id) return

    try {
      const response = await fetch(`${API_URL}/api/adventures/${id}/backdrops`, {
        credentials: 'include',
      })

      if (!response.ok) {
        return
      }

      const data: BackdropListResponse = await response.json()
      setBackdrops(data.backdrops)
    } catch {
      // Silently fail - backdrops section will show empty
    } finally {
      setIsLoadingBackdrops(false)
    }
  }, [id])

  React.useEffect(() => {
    if (adventure) {
      fetchBackdrops()
    }
  }, [adventure, fetchBackdrops])

  const fetchNotes = React.useCallback(async () => {
    if (!id) return

    try {
      const response = await fetch(`${API_URL}/api/adventures/${id}/notes`, {
        credentials: 'include',
      })

      if (!response.ok) {
        return
      }

      const data: NoteListResponse = await response.json()
      setNotes(data.notes)
    } catch {
      // Silently fail - notes section will show empty
    } finally {
      setIsLoadingNotes(false)
    }
  }, [id])

  React.useEffect(() => {
    if (adventure) {
      fetchNotes()
    }
  }, [adventure, fetchNotes])

  // Fetch campaign world map if adventure belongs to a campaign
  const fetchCampaignWorldMap = React.useCallback(async () => {
    if (!adventure?.campaignId) return

    try {
      const response = await fetch(`${API_URL}/api/campaigns/${adventure.campaignId}/world-map`, {
        credentials: 'include',
      })

      if (!response.ok) return

      const data: MapResponse = await response.json()
      setCampaignWorldMap(data.map)
    } catch {
      // Silently fail
    }
  }, [adventure?.campaignId])

  React.useEffect(() => {
    if (adventure) {
      fetchCampaignWorldMap()
    }
  }, [adventure, fetchCampaignWorldMap])

  // Fetch existing session for this adventure
  const fetchSession = React.useCallback(async () => {
    if (!id) return

    try {
      const response = await fetch(`${API_URL}/api/sessions?adventureId=${id}`, {
        credentials: 'include',
      })

      if (!response.ok) return

      const data: SessionListResponse = await response.json()
      // Find any forming/active/paused session
      const activeSession = data.sessions.find(
        (s) => s.status !== 'ENDED'
      )
      setExistingSession(activeSession || null)
    } catch {
      // Silently fail
    }
  }, [id])

  React.useEffect(() => {
    if (adventure) {
      fetchSession()
    }
  }, [adventure, fetchSession])

  const handleCreateSession = async (accessType: SessionAccessType) => {
    if (!id) return

    setIsCreatingSession(true)
    try {
      const response = await fetch(`${API_URL}/api/adventures/${id}/sessions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ accessType }),
      })

      if (!response.ok) {
        throw new Error('Failed to create session')
      }

      const data: SessionResponse = await response.json()
      navigate(`/sessions/${data.session.id}`)
    } catch {
      // Could add error handling
    } finally {
      setIsCreatingSession(false)
      setIsAccessTypeModalOpen(false)
    }
  }

  const getSessionButtonText = () => {
    if (!existingSession) return 'Create Session'
    switch (existingSession.status) {
      case 'FORMING':
        return 'View Session'
      case 'ACTIVE':
        return 'Resume Session'
      case 'PAUSED':
        return 'Return to Session'
      default:
        return 'Create Session'
    }
  }

  const handleSessionButtonClick = () => {
    if (existingSession) {
      navigate(`/sessions/${existingSession.id}`)
    } else {
      setIsAccessTypeModalOpen(true)
    }
  }

  // Scroll to top when navigating to this page
  React.useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  const handleEditAdventure = async (data: AdventureFormData) => {
    if (!adventure) return

    const response = await fetch(`${API_URL}/api/adventures/${adventure.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: data.name, description: data.description || null }),
    })

    if (!response.ok) {
      throw new Error('Failed to update adventure')
    }

    const result: AdventureResponse = await response.json()
    let updatedAdventure = result.adventure

    if (data.coverImage instanceof File) {
      // Uploading new image with focal point
      const formData = new FormData()
      formData.append('image', data.coverImage)
      formData.append('focusX', data.focusX.toString())
      formData.append('focusY', data.focusY.toString())

      const coverResponse = await fetch(`${API_URL}/api/adventures/${adventure.id}/cover`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (coverResponse.ok) {
        const coverResult: AdventureResponse = await coverResponse.json()
        updatedAdventure = coverResult.adventure
      }
    } else if (data.coverImage === null && adventure.coverImageUrl) {
      // Explicitly removing cover image
      const coverResponse = await fetch(`${API_URL}/api/adventures/${adventure.id}/cover`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (coverResponse.ok) {
        const coverResult: AdventureResponse = await coverResponse.json()
        updatedAdventure = coverResult.adventure
      }
    } else if (data.coverImage === undefined && adventure.coverImageUrl) {
      // Check if focal point changed for existing image
      const focusChanged =
        data.focusX !== (adventure.coverImageFocusX ?? 50) ||
        data.focusY !== (adventure.coverImageFocusY ?? 50)

      if (focusChanged) {
        const focusResponse = await fetch(
          `${API_URL}/api/adventures/${adventure.id}/cover/focus`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ focusX: data.focusX, focusY: data.focusY }),
          }
        )

        if (focusResponse.ok) {
          const focusResult: AdventureResponse = await focusResponse.json()
          updatedAdventure = focusResult.adventure
        }
      }
    }

    setAdventure(updatedAdventure)
    setIsEditModalOpen(false)
  }

  const handleDeleteAdventure = async () => {
    if (!adventure) return

    const response = await fetch(`${API_URL}/api/adventures/${adventure.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to delete adventure')
    }

    navigate('/')
  }

  const handleCreateMap = async (data: MapFormData) => {
    if (!adventure) return

    const response = await fetch(`${API_URL}/api/adventures/${adventure.id}/maps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: data.name,
        description: data.description || null,
        gridType: data.gridType,
        width: data.width,
        height: data.height,
        content: data.content,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to create map')
    }

    const result: MapResponse = await response.json()
    setMaps((prev) => [result.map, ...prev])
    setIsCreateMapModalOpen(false)
  }

  const handleEditMap = async (data: MapFormData) => {
    if (!editingMap) return

    const response = await fetch(`${API_URL}/api/maps/${editingMap.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: data.name,
        description: data.description || null,
        width: data.width,
        height: data.height,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to update map')
    }

    const result: MapResponse = await response.json()
    setMaps((prev) => prev.map((m) => (m.id === result.map.id ? result.map : m)))
    setEditingMap(null)
  }

  const handleDeleteMap = async () => {
    if (!deletingMap) return

    const response = await fetch(`${API_URL}/api/maps/${deletingMap.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to delete map')
    }

    setMaps((prev) => prev.filter((m) => m.id !== deletingMap.id))
    setDeletingMap(null)
  }

  const handleCreateNpc = async (data: NPCFormData) => {
    if (!adventure) return

    const response = await fetch(`${API_URL}/api/adventures/${adventure.id}/npcs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error('Failed to create NPC')
    }

    const result: NPCResponse = await response.json()
    // Convert full NPC to list item
    const listItem: NPCListItem = {
      id: result.npc.id,
      name: result.npc.name,
      description: result.npc.description,
      class: result.npc.class,
      level: result.npc.level,
      avatarUrl: result.npc.avatarUrl,
      adventureId: result.npc.adventureId,
      createdAt: result.npc.createdAt,
      updatedAt: result.npc.updatedAt,
    }
    setNpcs((prev) => [listItem, ...prev])
    setIsCreateNpcModalOpen(false)
  }

  const handleEditNpc = async (data: NPCFormData) => {
    if (!editingNpc) return

    const response = await fetch(`${API_URL}/api/npcs/${editingNpc.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: data.name,
        description: data.description || null,
        class: data.class || null,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to update NPC')
    }

    const result: NPCResponse = await response.json()
    const listItem: NPCListItem = {
      id: result.npc.id,
      name: result.npc.name,
      description: result.npc.description,
      class: result.npc.class,
      level: result.npc.level,
      avatarUrl: result.npc.avatarUrl,
      adventureId: result.npc.adventureId,
      createdAt: result.npc.createdAt,
      updatedAt: result.npc.updatedAt,
    }
    setNpcs((prev) => prev.map((n) => (n.id === listItem.id ? listItem : n)))
    setEditingNpc(null)
  }

  const handleDeleteNpc = async () => {
    if (!deletingNpc) return

    const response = await fetch(`${API_URL}/api/npcs/${deletingNpc.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to delete NPC')
    }

    setNpcs((prev) => prev.filter((n) => n.id !== deletingNpc.id))
    setDeletingNpc(null)
  }

  const handleExportNpc = async (npc: NPCListItem) => {
    // Fetch full NPC data for export
    try {
      const response = await fetch(`${API_URL}/api/npcs/${npc.id}`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch NPC')
      }

      const data: NPCResponse = await response.json()
      exportNPC(data.npc)
    } catch {
      // Could add toast notification here
      console.error('Failed to export NPC')
    }
  }

  const handleCreateBackdrop = async (data: BackdropFormData) => {
    if (!adventure || !data.image) return

    const formData = new FormData()
    formData.append('image', data.image)
    formData.append('name', data.name)
    if (data.title) formData.append('title', data.title)
    formData.append('titleX', data.titleX.toString())
    formData.append('titleY', data.titleY.toString())
    if (data.description) formData.append('description', data.description)
    formData.append('focusX', data.focusX.toString())
    formData.append('focusY', data.focusY.toString())

    const response = await fetch(`${API_URL}/api/adventures/${adventure.id}/backdrops`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    })

    if (!response.ok) {
      throw new Error('Failed to create backdrop')
    }

    const result: BackdropResponse = await response.json()
    setBackdrops((prev) => [result.backdrop, ...prev])
    setIsCreateBackdropModalOpen(false)
  }

  const handleEditBackdrop = async (data: EditBackdropFormData) => {
    if (!editingBackdrop || !adventure) return

    // Update metadata via PATCH
    const patchResponse = await fetch(
      `${API_URL}/api/adventures/${adventure.id}/backdrops/${editingBackdrop.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: data.name,
          title: data.title,
          titleX: data.titleX,
          titleY: data.titleY,
          description: data.description,
          focusX: data.focusX,
          focusY: data.focusY,
        }),
      }
    )

    if (!patchResponse.ok) {
      throw new Error('Failed to update backdrop')
    }

    let result: BackdropResponse = await patchResponse.json()

    // Replace image if provided
    if (data.replaceImage) {
      const formData = new FormData()
      formData.append('image', data.replaceImage)

      const imageResponse = await fetch(
        `${API_URL}/api/adventures/${adventure.id}/backdrops/${editingBackdrop.id}/image`,
        {
          method: 'POST',
          credentials: 'include',
          body: formData,
        }
      )

      if (imageResponse.ok) {
        result = await imageResponse.json()
      }
    }

    setBackdrops((prev) => prev.map((b) => (b.id === result.backdrop.id ? result.backdrop : b)))
    setEditingBackdrop(null)
  }

  const handleCreateNote = async (data: NoteFormData) => {
    if (!adventure) return

    const response = await fetch(`${API_URL}/api/adventures/${adventure.id}/notes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    })

    if (!response.ok) {
      throw new Error('Failed to create note')
    }

    const result: NoteResponse = await response.json()
    setNotes((prev) => [result.note, ...prev])
    setIsCreateNoteModalOpen(false)
  }

  const handleEditNote = async (data: NoteFormData) => {
    if (!editingNote || !adventure) return

    const response = await fetch(
      `${API_URL}/api/adventures/${adventure.id}/notes/${editingNote.id}`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: data.title,
          content: data.content || null,
        }),
      }
    )

    if (!response.ok) {
      throw new Error('Failed to update note')
    }

    const result: NoteResponse = await response.json()
    setNotes((prev) => prev.map((n) => (n.id === result.note.id ? result.note : n)))
    setEditingNote(null)
  }

  const handleDeleteNote = async () => {
    if (!deletingNote || !adventure) return

    const response = await fetch(
      `${API_URL}/api/adventures/${adventure.id}/notes/${deletingNote.id}`,
      {
        method: 'DELETE',
        credentials: 'include',
      }
    )

    if (!response.ok) {
      throw new Error('Failed to delete note')
    }

    setNotes((prev) => prev.filter((n) => n.id !== deletingNote.id))
    setDeletingNote(null)
  }

  const handleDeleteBackdrop = async () => {
    if (!deletingBackdrop || !adventure) return

    const response = await fetch(
      `${API_URL}/api/adventures/${adventure.id}/backdrops/${deletingBackdrop.id}`,
      {
        method: 'DELETE',
        credentials: 'include',
      }
    )

    if (!response.ok) {
      throw new Error('Failed to delete backdrop')
    }

    setBackdrops((prev) => prev.filter((b) => b.id !== deletingBackdrop.id))
    setDeletingBackdrop(null)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center paper-texture">
        <span className="animate-quill-scratch text-4xl">&#9998;</span>
        <span className="ml-4 font-body text-ink-soft">Loading adventure...</span>
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

  if (!adventure) {
    return null
  }

  return (
    <div className="min-h-screen paper-texture">
      {adventure.coverImageUrl ? (
        <div className="relative h-64 overflow-hidden border-b-3 border-ink md:h-80">
          <img
            src={adventure.coverImageUrl}
            alt={adventure.name}
            className="h-full w-full object-cover"
            style={{
              objectPosition: `${adventure.coverImageFocusX ?? 50}% ${adventure.coverImageFocusY ?? 50}%`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
            <div className="mx-auto max-w-6xl">
              <Link
                to={adventure.campaignId ? `/campaigns/${adventure.campaignId}` : '/'}
                className="mb-2 inline-block font-body text-sm text-parchment-200 hover:text-parchment-100"
              >
                &larr; {adventure.campaignId ? 'Back to Campaign' : 'Back to Dashboard'}
              </Link>
              <h1 className="font-display text-2xl uppercase tracking-wide text-parchment-100 drop-shadow-lg md:text-4xl">
                {adventure.name}
              </h1>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-b-3 border-ink bg-parchment-200">
          <div className="mx-auto max-w-6xl p-6 md:p-8">
            <Link
              to={adventure.campaignId ? `/campaigns/${adventure.campaignId}` : '/'}
              className="mb-2 inline-block font-body text-sm text-ink-soft hover:text-ink"
            >
              &larr; {adventure.campaignId ? 'Back to Campaign' : 'Back to Dashboard'}
            </Link>
            <div className="flex items-center gap-4">
              <div className="text-ink-soft">&#9876; &#9876;</div>
              <h1 className="font-display text-2xl uppercase tracking-wide text-ink md:text-4xl">
                {adventure.name}
              </h1>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {adventure.description && (
              <p className="max-w-2xl font-body text-ink-soft">{adventure.description}</p>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="primary" onClick={handleSessionButtonClick}>
              {getSessionButtonText()}
            </Button>
            <Button variant="default" onClick={() => setIsEditModalOpen(true)}>
              Edit
            </Button>
          </div>
        </div>

        <Divider className="my-8" />

        {/* Maps Section */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg uppercase tracking-wide text-ink">Maps</h2>
            <Button variant="default" size="sm" onClick={() => setIsCreateMapModalOpen(true)}>
              + New Map
            </Button>
          </div>

          {isLoadingMaps ? (
            <div className="rounded border-3 border-dashed border-ink-soft bg-parchment-200 p-8 text-center">
              <span className="animate-quill-scratch text-2xl">&#9998;</span>
              <p className="mt-2 font-body text-ink-soft">Loading maps...</p>
            </div>
          ) : maps.length === 0 && !campaignWorldMap ? (
            <div className="rounded border-3 border-dashed border-ink-soft bg-parchment-200 p-8 text-center">
              <div className="mb-4 text-2xl text-ink-soft">&#128506;</div>
              <p className="font-body text-ink">No maps yet</p>
              <p className="mt-1 font-body text-sm text-ink-soft">
                Create your first map to begin charting this realm.
              </p>
              <Button
                variant="default"
                className="mt-4"
                onClick={() => setIsCreateMapModalOpen(true)}
              >
                Create Map
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {campaignWorldMap && (
                <Link
                  to={`/maps/${campaignWorldMap.id}`}
                  className="group block border-3 border-ink bg-parchment-100 shadow-brutal card-texture transition-all hover:-translate-y-1 hover:shadow-brutal-lg"
                >
                  <div className="relative border-b-3 border-ink bg-white">
                    <div className="aspect-video w-full">
                      <MapPreview map={campaignWorldMap} />
                    </div>
                    <span
                      className="absolute left-2 top-2 border-2 border-ink bg-white/80 px-1.5 py-0.5 font-display text-xs uppercase tracking-wide text-ink"
                    >
                      &#127758; Campaign Map
                    </span>
                  </div>
                  <div className="p-3">
                    <h3 className="line-clamp-1 font-display text-sm uppercase tracking-wide text-ink">
                      {campaignWorldMap.name}
                    </h3>
                    <p className="mt-1 font-body text-xs text-ink-soft">
                      {campaignWorldMap.width}&times;{campaignWorldMap.height} &bull;{' '}
                      {campaignWorldMap.gridType === 'HEX' ? 'Hex' : 'Square'} grid
                    </p>
                  </div>
                </Link>
              )}
              {maps.map((map) => (
                <MapCard
                  key={map.id}
                  map={map}
                  onEdit={() => setEditingMap(map)}
                  onDelete={() => setDeletingMap(map)}
                />
              ))}
            </div>
          )}
        </div>

        {/* NPCs Section */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg uppercase tracking-wide text-ink">NPCs</h2>
            <Button variant="default" size="sm" onClick={() => setIsCreateNpcModalOpen(true)}>
              + New NPC
            </Button>
          </div>

          {isLoadingNpcs ? (
            <div className="rounded border-3 border-dashed border-ink-soft bg-parchment-200 p-8 text-center">
              <span className="animate-quill-scratch text-2xl">&#9998;</span>
              <p className="mt-2 font-body text-ink-soft">Loading NPCs...</p>
            </div>
          ) : npcs.length === 0 ? (
            <div className="rounded border-3 border-dashed border-ink-soft bg-parchment-200 p-8 text-center">
              <div className="mb-4 text-2xl text-ink-soft">&#9786;</div>
              <p className="font-body text-ink">No NPCs yet</p>
              <p className="mt-1 font-body text-sm text-ink-soft">
                Create your first NPC to populate this adventure.
              </p>
              <Button
                variant="default"
                className="mt-4"
                onClick={() => setIsCreateNpcModalOpen(true)}
              >
                Create NPC
              </Button>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {npcs.map((npc) => (
                <NPCCard
                  key={npc.id}
                  npc={npc}
                  onEdit={() => setEditingNpc(npc)}
                  onDelete={() => setDeletingNpc(npc)}
                  onExport={() => handleExportNpc(npc)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Backdrops Section */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg uppercase tracking-wide text-ink">Backdrops</h2>
            <Button variant="default" size="sm" onClick={() => setIsCreateBackdropModalOpen(true)}>
              + New Backdrop
            </Button>
          </div>

          {isLoadingBackdrops ? (
            <div className="rounded border-3 border-dashed border-ink-soft bg-parchment-200 p-8 text-center">
              <span className="animate-quill-scratch text-2xl">&#9998;</span>
              <p className="mt-2 font-body text-ink-soft">Loading backdrops...</p>
            </div>
          ) : backdrops.length === 0 ? (
            <div className="rounded border-3 border-dashed border-ink-soft bg-parchment-200 p-8 text-center">
              <div className="mb-4 text-2xl text-ink-soft">&#127748;</div>
              <p className="font-body text-ink">No backdrops yet</p>
              <p className="mt-1 font-body text-sm text-ink-soft">
                Upload scene images, battle illustrations, or town views.
              </p>
              <Button
                variant="default"
                className="mt-4"
                onClick={() => setIsCreateBackdropModalOpen(true)}
              >
                Create Backdrop
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {backdrops.map((backdrop) => (
                <BackdropCard
                  key={backdrop.id}
                  backdrop={backdrop}
                  onEdit={() => setEditingBackdrop(backdrop)}
                  onDelete={() => setDeletingBackdrop(backdrop)}
                  onPreview={() => setPreviewingBackdrop(backdrop)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Notes Section */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg uppercase tracking-wide text-ink">Notes</h2>
            <Button variant="default" size="sm" onClick={() => setIsCreateNoteModalOpen(true)}>
              + New Note
            </Button>
          </div>

          {isLoadingNotes ? (
            <div className="rounded border-3 border-dashed border-ink-soft bg-parchment-200 p-8 text-center">
              <span className="animate-quill-scratch text-2xl">&#9998;</span>
              <p className="mt-2 font-body text-ink-soft">Loading notes...</p>
            </div>
          ) : notes.length === 0 ? (
            <div className="rounded border-3 border-dashed border-ink-soft bg-parchment-200 p-8 text-center">
              <div className="mb-4 text-2xl text-ink-soft">&#128221;</div>
              <p className="font-body text-ink">No notes yet</p>
              <p className="mt-1 font-body text-sm text-ink-soft">
                Jot down plot points, NPC details, or session summaries.
              </p>
              <Button
                variant="default"
                className="mt-4"
                onClick={() => setIsCreateNoteModalOpen(true)}
              >
                Create Note
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {notes.map((note) => (
                <NoteCard
                  key={note.id}
                  note={note}
                  onView={() => setViewingNote(note)}
                  onEdit={() => setEditingNote(note)}
                  onDelete={() => setDeletingNote(note)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Coming Soon Section */}
        <div className="rounded border-3 border-dashed border-ink-soft bg-parchment-200 p-8 text-center">
          <div className="mb-4 text-2xl text-ink-soft">&#128506;</div>
          <h2 className="font-display text-lg uppercase tracking-wide text-ink">Coming Soon</h2>
          <p className="mt-2 font-body text-ink-soft">
            Encounters and session tools will appear here in future updates.
          </p>
        </div>
      </div>

      <CreateAdventureModal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleEditAdventure}
        onDelete={() => {
          setIsEditModalOpen(false)
          setIsDeleteDialogOpen(true)
        }}
        adventure={adventure}
      />

      <DeleteAdventureDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteAdventure}
        adventure={adventure}
      />

      <CreateMapModal
        open={isCreateMapModalOpen}
        onClose={() => setIsCreateMapModalOpen(false)}
        onSubmit={handleCreateMap}
      />

      <CreateMapModal
        open={!!editingMap}
        onClose={() => setEditingMap(null)}
        onSubmit={handleEditMap}
        map={editingMap}
      />

      <DeleteMapDialog
        open={!!deletingMap}
        onClose={() => setDeletingMap(null)}
        onConfirm={handleDeleteMap}
        map={deletingMap}
      />

      <CreateNPCModal
        open={isCreateNpcModalOpen}
        onClose={() => setIsCreateNpcModalOpen(false)}
        onSubmit={handleCreateNpc}
      />

      <CreateNPCModal
        open={!!editingNpc}
        onClose={() => setEditingNpc(null)}
        onSubmit={handleEditNpc}
        npc={editingNpc}
      />

      <DeleteNPCDialog
        open={!!deletingNpc}
        onClose={() => setDeletingNpc(null)}
        onConfirm={handleDeleteNpc}
        npc={deletingNpc}
      />

      <CreateBackdropModal
        open={isCreateBackdropModalOpen}
        onClose={() => setIsCreateBackdropModalOpen(false)}
        onSubmit={handleCreateBackdrop}
      />

      <EditBackdropModal
        open={!!editingBackdrop}
        onClose={() => setEditingBackdrop(null)}
        onSubmit={handleEditBackdrop}
        backdrop={editingBackdrop}
      />

      <BackdropPreviewModal
        open={!!previewingBackdrop}
        onClose={() => setPreviewingBackdrop(null)}
        backdrop={previewingBackdrop}
      />

      <DeleteBackdropDialog
        open={!!deletingBackdrop}
        onClose={() => setDeletingBackdrop(null)}
        onConfirm={handleDeleteBackdrop}
        backdrop={deletingBackdrop}
      />

      <CreateNoteModal
        open={isCreateNoteModalOpen}
        onClose={() => setIsCreateNoteModalOpen(false)}
        onSubmit={handleCreateNote}
      />

      <CreateNoteModal
        open={!!viewingNote}
        onClose={() => setViewingNote(null)}
        onSubmit={async (data) => {
          if (!viewingNote || !adventure) return
          const response = await fetch(
            `${API_URL}/api/adventures/${adventure.id}/notes/${viewingNote.id}`,
            {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ title: data.title, content: data.content || null }),
            }
          )
          if (!response.ok) throw new Error('Failed to update note')
          const result: NoteResponse = await response.json()
          setNotes((prev) => prev.map((n) => (n.id === result.note.id ? result.note : n)))
          setViewingNote(null)
        }}
        note={viewingNote}
      />

      <CreateNoteModal
        open={!!editingNote}
        onClose={() => setEditingNote(null)}
        onSubmit={handleEditNote}
        note={editingNote}
        initialEditing
      />

      <DeleteNoteDialog
        open={!!deletingNote}
        onClose={() => setDeletingNote(null)}
        onConfirm={handleDeleteNote}
        note={deletingNote}
      />

      {/* Access Type Selection Modal */}
      <Dialog
        open={isAccessTypeModalOpen}
        onOpenChange={(isOpen) => !isOpen && setIsAccessTypeModalOpen(false)}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Start New Session</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="font-body text-sm text-ink">Who can join this session?</p>

            <div className="space-y-2">
              <button
                type="button"
                onClick={() => handleCreateSession('OPEN')}
                disabled={isCreatingSession}
                className="flex w-full items-start gap-3 border-3 border-ink bg-parchment-100 p-3 text-left transition-colors hover:bg-parchment-200 disabled:opacity-50"
              >
                <SessionTypeChip accessType="OPEN" />
                <div>
                  <p className="font-body text-sm text-ink">Anyone can browse and join</p>
                </div>
              </button>

              {adventure.campaignId && (
                <button
                  type="button"
                  onClick={() => handleCreateSession('CAMPAIGN')}
                  disabled={isCreatingSession}
                  className="flex w-full items-start gap-3 border-3 border-ink bg-parchment-100 p-3 text-left transition-colors hover:bg-parchment-200 disabled:opacity-50"
                >
                  <SessionTypeChip accessType="CAMPAIGN" />
                  <div>
                    <p className="font-body text-sm text-ink">Only campaign members can join</p>
                  </div>
                </button>
              )}

              <button
                type="button"
                onClick={() => handleCreateSession('INVITE')}
                disabled={isCreatingSession}
                className="flex w-full items-start gap-3 border-3 border-ink bg-parchment-100 p-3 text-left transition-colors hover:bg-parchment-200 disabled:opacity-50"
              >
                <SessionTypeChip accessType="INVITE" />
                <div>
                  <p className="font-body text-sm text-ink">You'll invite specific players</p>
                </div>
              </button>
            </div>

            <div className="flex justify-end pt-2">
              <Button
                variant="ghost"
                onClick={() => setIsAccessTypeModalOpen(false)}
                disabled={isCreatingSession}
              >
                Cancel
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
