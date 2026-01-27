import * as React from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import type {
  CampaignWithAdventures,
  CampaignWithAdventuresResponse,
  CampaignResponse,
  Adventure,
  AdventureResponse,
} from '@gygax/shared'
import { Button, Divider } from '../components/ui'
import { CreateCampaignModal, CampaignFormData } from '../components/CreateCampaignModal'
import { DeleteCampaignDialog } from '../components/DeleteCampaignDialog'
import { AdventureCard } from '../components/AdventureCard'
import { CreateAdventureModal, AdventureFormData } from '../components/CreateAdventureModal'
import { DeleteAdventureDialog } from '../components/DeleteAdventureDialog'

const API_URL = import.meta.env.VITE_API_URL || ''

export function CampaignPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [campaign, setCampaign] = React.useState<CampaignWithAdventures | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)
  const [isCreateAdventureModalOpen, setIsCreateAdventureModalOpen] = React.useState(false)
  const [editingAdventure, setEditingAdventure] = React.useState<Adventure | null>(null)
  const [deletingAdventure, setDeletingAdventure] = React.useState<Adventure | null>(null)

  const fetchCampaign = React.useCallback(async () => {
    if (!id) return

    try {
      const response = await fetch(`${API_URL}/api/campaigns/${id}`, {
        credentials: 'include',
      })

      if (response.status === 404) {
        setError('Campaign not found')
        return
      }

      if (response.status === 403) {
        setError('You do not have access to this campaign')
        return
      }

      if (!response.ok) {
        throw new Error('Failed to fetch campaign')
      }

      const data: CampaignWithAdventuresResponse = await response.json()
      setCampaign(data.campaign)
    } catch {
      setError('Failed to load campaign')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    fetchCampaign()
  }, [fetchCampaign])

  // Scroll to top when navigating to this page
  React.useEffect(() => {
    window.scrollTo(0, 0)
  }, [id])

  const handleEditCampaign = async (data: CampaignFormData) => {
    if (!campaign) return

    const response = await fetch(`${API_URL}/api/campaigns/${campaign.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: data.name, description: data.description || null }),
    })

    if (!response.ok) {
      throw new Error('Failed to update campaign')
    }

    const result: CampaignResponse = await response.json()
    let updatedCampaign = { ...result.campaign, adventures: campaign.adventures }

    if (data.bannerImage instanceof File) {
      // Uploading new image with hotspot
      const formData = new FormData()
      formData.append('image', data.bannerImage)
      formData.append('hotspotX', data.hotspotX.toString())
      formData.append('hotspotY', data.hotspotY.toString())

      const bannerResponse = await fetch(`${API_URL}/api/campaigns/${campaign.id}/banner`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (bannerResponse.ok) {
        const bannerResult: CampaignResponse = await bannerResponse.json()
        updatedCampaign = { ...bannerResult.campaign, adventures: campaign.adventures }
      }
    } else if (data.bannerImage === null && campaign.bannerImageUrl) {
      // Explicitly removing banner image
      const bannerResponse = await fetch(`${API_URL}/api/campaigns/${campaign.id}/banner`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (bannerResponse.ok) {
        const bannerResult: CampaignResponse = await bannerResponse.json()
        updatedCampaign = { ...bannerResult.campaign, adventures: campaign.adventures }
      }
    } else if (data.bannerImage === undefined && campaign.bannerImageUrl) {
      // Check if hotspot changed for existing image
      const hotspotChanged =
        data.hotspotX !== (campaign.bannerHotspotX ?? 50) ||
        data.hotspotY !== (campaign.bannerHotspotY ?? 50)

      if (hotspotChanged) {
        const hotspotResponse = await fetch(
          `${API_URL}/api/campaigns/${campaign.id}/banner/hotspot`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ hotspotX: data.hotspotX, hotspotY: data.hotspotY }),
          }
        )

        if (hotspotResponse.ok) {
          const hotspotResult: CampaignResponse = await hotspotResponse.json()
          updatedCampaign = { ...hotspotResult.campaign, adventures: campaign.adventures }
        }
      }
    }

    setCampaign(updatedCampaign)
    setIsEditModalOpen(false)
  }

  const handleDeleteCampaign = async () => {
    if (!campaign) return

    const response = await fetch(`${API_URL}/api/campaigns/${campaign.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to delete campaign')
    }

    navigate('/')
  }

  const handleCreateAdventure = async (data: AdventureFormData) => {
    if (!campaign) return

    const response = await fetch(`${API_URL}/api/campaigns/${campaign.id}/adventures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: data.name,
        description: data.description || null,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to create adventure')
    }

    const result: AdventureResponse = await response.json()
    let adventure = result.adventure

    if (data.coverImage instanceof File) {
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
        adventure = coverResult.adventure
      }
    }

    setCampaign((prev) =>
      prev ? { ...prev, adventures: [adventure, ...prev.adventures] } : null
    )
    setIsCreateAdventureModalOpen(false)
  }

  const handleEditAdventure = async (data: AdventureFormData) => {
    if (!editingAdventure) return

    const response = await fetch(`${API_URL}/api/adventures/${editingAdventure.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: data.name, description: data.description || null }),
    })

    if (!response.ok) {
      throw new Error('Failed to update adventure')
    }

    const result: AdventureResponse = await response.json()
    let adventure = result.adventure

    if (data.coverImage instanceof File) {
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
        adventure = coverResult.adventure
      }
    } else if (data.coverImage === null && editingAdventure.coverImageUrl) {
      const coverResponse = await fetch(`${API_URL}/api/adventures/${adventure.id}/cover`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (coverResponse.ok) {
        const coverResult: AdventureResponse = await coverResponse.json()
        adventure = coverResult.adventure
      }
    } else if (data.coverImage === undefined && editingAdventure.coverImageUrl) {
      const focusChanged =
        data.focusX !== (editingAdventure.coverImageFocusX ?? 50) ||
        data.focusY !== (editingAdventure.coverImageFocusY ?? 50)

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
          adventure = focusResult.adventure
        }
      }
    }

    setCampaign((prev) =>
      prev
        ? {
            ...prev,
            adventures: prev.adventures.map((a) => (a.id === adventure.id ? adventure : a)),
          }
        : null
    )
    setEditingAdventure(null)
  }

  const handleDeleteAdventure = async () => {
    if (!deletingAdventure) return

    const response = await fetch(`${API_URL}/api/adventures/${deletingAdventure.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to delete adventure')
    }

    setCampaign((prev) =>
      prev
        ? {
            ...prev,
            adventures: prev.adventures.filter((a) => a.id !== deletingAdventure.id),
          }
        : null
    )
    setDeletingAdventure(null)
  }

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center paper-texture">
        <span className="animate-quill-scratch text-4xl">&#9998;</span>
        <span className="ml-4 font-body text-ink-soft">Loading campaign...</span>
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

  if (!campaign) {
    return null
  }

  return (
    <div className="min-h-screen paper-texture">
      {campaign.bannerImageUrl ? (
        <div className="relative h-48 overflow-hidden border-b-3 border-ink md:h-64">
          <img
            src={campaign.bannerImageUrl}
            alt={campaign.name}
            className="h-full w-full object-cover"
            style={{
              objectPosition: `${campaign.bannerHotspotX ?? 50}% ${campaign.bannerHotspotY ?? 50}%`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
            <div className="mx-auto max-w-6xl">
              <Link
                to="/"
                className="mb-2 inline-block font-body text-sm text-parchment-200 hover:text-parchment-100"
              >
                &larr; Back to Dashboard
              </Link>
              <h1 className="font-display text-2xl uppercase tracking-wide text-parchment-100 drop-shadow-lg md:text-4xl">
                {campaign.name}
              </h1>
            </div>
          </div>
        </div>
      ) : (
        <div className="border-b-3 border-ink bg-parchment-200">
          <div className="mx-auto max-w-6xl p-6 md:p-8">
            <Link
              to="/"
              className="mb-2 inline-block font-body text-sm text-ink-soft hover:text-ink"
            >
              &larr; Back to Dashboard
            </Link>
            <div className="flex items-center gap-4">
              <div className="text-ink-soft">&#9876; &#9552;&#9552;&#9552; &#9876;</div>
              <h1 className="font-display text-2xl uppercase tracking-wide text-ink md:text-4xl">
                {campaign.name}
              </h1>
            </div>
          </div>
        </div>
      )}

      <div className="mx-auto max-w-6xl p-6 md:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            {campaign.description && (
              <p className="max-w-2xl font-body text-ink-soft">{campaign.description}</p>
            )}
          </div>
          <Button variant="default" onClick={() => setIsEditModalOpen(true)}>
            Edit Campaign
          </Button>
        </div>

        <Divider className="my-8" />

        {/* Adventures Section */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg uppercase tracking-wide text-ink">Adventures</h2>
            <Button
              variant="default"
              size="sm"
              onClick={() => setIsCreateAdventureModalOpen(true)}
            >
              + New Adventure
            </Button>
          </div>

          {campaign.adventures.length === 0 ? (
            <div className="rounded border-3 border-dashed border-ink-soft bg-parchment-200 p-8 text-center">
              <div className="mb-4 text-2xl text-ink-soft">&#128214;</div>
              <p className="font-body text-ink">No adventures yet</p>
              <p className="mt-1 font-body text-sm text-ink-soft">
                Create your first adventure to begin building this campaign.
              </p>
              <Button
                variant="default"
                className="mt-4"
                onClick={() => setIsCreateAdventureModalOpen(true)}
              >
                Create Adventure
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {campaign.adventures.map((adventure) => (
                <AdventureCard
                  key={adventure.id}
                  adventure={adventure}
                  onEdit={setEditingAdventure}
                  onDelete={setDeletingAdventure}
                />
              ))}
            </div>
          )}
        </div>

        {/* World Map Placeholder */}
        <div className="rounded border-3 border-dashed border-ink-soft bg-parchment-200 p-8 text-center">
          <div className="mb-4 text-2xl text-ink-soft">&#127758;</div>
          <h2 className="font-display text-lg uppercase tracking-wide text-ink">World Map</h2>
          <p className="mt-2 font-body text-ink-soft">
            Campaign-level world map coming in a future update.
          </p>
        </div>
      </div>

      <CreateCampaignModal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleEditCampaign}
        onDelete={() => {
          setIsEditModalOpen(false)
          setIsDeleteDialogOpen(true)
        }}
        campaign={campaign}
      />

      <DeleteCampaignDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteCampaign}
        campaign={campaign}
        adventureCount={campaign.adventures.length}
      />

      <CreateAdventureModal
        open={isCreateAdventureModalOpen}
        onClose={() => setIsCreateAdventureModalOpen(false)}
        onSubmit={handleCreateAdventure}
      />

      <CreateAdventureModal
        open={!!editingAdventure}
        onClose={() => setEditingAdventure(null)}
        onSubmit={handleEditAdventure}
        onDelete={() => {
          if (editingAdventure) {
            setDeletingAdventure(editingAdventure)
            setEditingAdventure(null)
          }
        }}
        adventure={editingAdventure}
      />

      <DeleteAdventureDialog
        open={!!deletingAdventure}
        onClose={() => setDeletingAdventure(null)}
        onConfirm={handleDeleteAdventure}
        adventure={deletingAdventure}
      />
    </div>
  )
}
