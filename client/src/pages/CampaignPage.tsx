import * as React from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import type { Campaign, CampaignResponse, Map, MapListResponse, MapResponse } from '@gygax/shared'
import { Button, Divider } from '../components/ui'
import { CreateCampaignModal, CampaignFormData } from '../components/CreateCampaignModal'
import { DeleteCampaignDialog } from '../components/DeleteCampaignDialog'
import { MapCard } from '../components/MapCard'
import { CreateMapModal, MapFormData } from '../components/CreateMapModal'
import { DeleteMapDialog } from '../components/DeleteMapDialog'

const API_URL = import.meta.env.VITE_API_URL || ''

export function CampaignPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [campaign, setCampaign] = React.useState<Campaign | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)
  const [maps, setMaps] = React.useState<Map[]>([])
  const [isLoadingMaps, setIsLoadingMaps] = React.useState(true)
  const [isCreateMapModalOpen, setIsCreateMapModalOpen] = React.useState(false)
  const [editingMap, setEditingMap] = React.useState<Map | null>(null)
  const [deletingMap, setDeletingMap] = React.useState<Map | null>(null)

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

      const data: CampaignResponse = await response.json()
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

  const fetchMaps = React.useCallback(async () => {
    if (!id) return

    try {
      const response = await fetch(`${API_URL}/api/campaigns/${id}/maps`, {
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
    if (campaign) {
      fetchMaps()
    }
  }, [campaign, fetchMaps])

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
    let updatedCampaign = result.campaign

    if (data.coverImage instanceof File) {
      // Uploading new image with focal point
      const formData = new FormData()
      formData.append('image', data.coverImage)
      formData.append('focusX', data.focusX.toString())
      formData.append('focusY', data.focusY.toString())

      const coverResponse = await fetch(`${API_URL}/api/campaigns/${campaign.id}/cover`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      if (coverResponse.ok) {
        const coverResult: CampaignResponse = await coverResponse.json()
        updatedCampaign = coverResult.campaign
      }
    } else if (data.coverImage === null && campaign.coverImageUrl) {
      // Explicitly removing cover image
      const coverResponse = await fetch(`${API_URL}/api/campaigns/${campaign.id}/cover`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (coverResponse.ok) {
        const coverResult: CampaignResponse = await coverResponse.json()
        updatedCampaign = coverResult.campaign
      }
    } else if (data.coverImage === undefined && campaign.coverImageUrl) {
      // Check if focal point changed for existing image
      const focusChanged =
        data.focusX !== (campaign.coverImageFocusX ?? 50) ||
        data.focusY !== (campaign.coverImageFocusY ?? 50)

      if (focusChanged) {
        const focusResponse = await fetch(
          `${API_URL}/api/campaigns/${campaign.id}/cover/focus`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ focusX: data.focusX, focusY: data.focusY }),
          }
        )

        if (focusResponse.ok) {
          const focusResult: CampaignResponse = await focusResponse.json()
          updatedCampaign = focusResult.campaign
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

  const handleCreateMap = async (data: MapFormData) => {
    if (!campaign) return

    const response = await fetch(`${API_URL}/api/campaigns/${campaign.id}/maps`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: data.name,
        description: data.description || null,
        gridType: data.gridType,
        width: data.width,
        height: data.height,
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
      {campaign.coverImageUrl ? (
        <div className="relative h-64 overflow-hidden border-b-3 border-ink md:h-80">
          <img
            src={campaign.coverImageUrl}
            alt={campaign.name}
            className="h-full w-full object-cover"
            style={{
              objectPosition: `${campaign.coverImageFocusX ?? 50}% ${campaign.coverImageFocusY ?? 50}%`,
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-ink/80 to-transparent" />
          <div className="absolute bottom-0 left-0 right-0 p-6 md:p-8">
            <div className="mx-auto max-w-6xl">
              <Link
                to="/"
                className="mb-2 inline-block font-body text-sm text-parchment-200 hover:text-parchment-100"
              >
                &larr; Back to campaigns
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
              &larr; Back to campaigns
            </Link>
            <div className="flex items-center gap-4">
              <div className="text-ink-soft">&#9876; &#9876;</div>
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
          ) : maps.length === 0 ? (
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

        {/* Coming Soon Section */}
        <div className="rounded border-3 border-dashed border-ink-soft bg-parchment-200 p-8 text-center">
          <div className="mb-4 text-2xl text-ink-soft">&#128506;</div>
          <h2 className="font-display text-lg uppercase tracking-wide text-ink">Coming Soon</h2>
          <p className="mt-2 font-body text-ink-soft">
            Encounters and session tools will appear here in future updates.
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
    </div>
  )
}
