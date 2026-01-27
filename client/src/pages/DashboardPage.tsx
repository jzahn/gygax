import * as React from 'react'
import type {
  Adventure,
  AdventureListResponse,
  AdventureResponse,
  CampaignListItem,
  CampaignListResponse,
  CampaignResponse,
} from '@gygax/shared'
import { Button, Divider } from '../components/ui'
import { CampaignCard } from '../components/CampaignCard'
import { CreateCampaignModal, CampaignFormData } from '../components/CreateCampaignModal'
import { DeleteCampaignDialog } from '../components/DeleteCampaignDialog'
import { AdventureCard } from '../components/AdventureCard'
import { CreateAdventureModal, AdventureFormData } from '../components/CreateAdventureModal'
import { DeleteAdventureDialog } from '../components/DeleteAdventureDialog'

const API_URL = import.meta.env.VITE_API_URL || ''

export function DashboardPage() {
  // Campaigns state
  const [campaigns, setCampaigns] = React.useState<CampaignListItem[]>([])
  const [isLoadingCampaigns, setIsLoadingCampaigns] = React.useState(true)
  const [campaignsError, setCampaignsError] = React.useState<string | null>(null)
  const [isCreateCampaignModalOpen, setIsCreateCampaignModalOpen] = React.useState(false)
  const [editingCampaign, setEditingCampaign] = React.useState<CampaignListItem | null>(null)
  const [deletingCampaign, setDeletingCampaign] = React.useState<CampaignListItem | null>(null)

  // Adventures state (standalone only)
  const [adventures, setAdventures] = React.useState<Adventure[]>([])
  const [isLoadingAdventures, setIsLoadingAdventures] = React.useState(true)
  const [adventuresError, setAdventuresError] = React.useState<string | null>(null)
  const [isCreateAdventureModalOpen, setIsCreateAdventureModalOpen] = React.useState(false)
  const [editingAdventure, setEditingAdventure] = React.useState<Adventure | null>(null)
  const [deletingAdventure, setDeletingAdventure] = React.useState<Adventure | null>(null)

  const fetchCampaigns = React.useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/campaigns`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch campaigns')
      }

      const data: CampaignListResponse = await response.json()
      setCampaigns(data.campaigns)
    } catch {
      setCampaignsError('Failed to load campaigns')
    } finally {
      setIsLoadingCampaigns(false)
    }
  }, [])

  const fetchAdventures = React.useCallback(async () => {
    try {
      const response = await fetch(`${API_URL}/api/adventures`, {
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to fetch adventures')
      }

      const data: AdventureListResponse = await response.json()
      setAdventures(data.adventures)
    } catch {
      setAdventuresError('Failed to load adventures')
    } finally {
      setIsLoadingAdventures(false)
    }
  }, [])

  React.useEffect(() => {
    fetchCampaigns()
    fetchAdventures()
  }, [fetchCampaigns, fetchAdventures])

  // Campaign handlers
  const handleCreateCampaign = async (data: CampaignFormData) => {
    const response = await fetch(`${API_URL}/api/campaigns`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: data.name, description: data.description || undefined }),
    })

    if (!response.ok) {
      throw new Error('Failed to create campaign')
    }

    const result: CampaignResponse = await response.json()
    let campaign: CampaignListItem = { ...result.campaign, adventureCount: 0 }

    if (data.bannerImage instanceof File) {
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
        campaign = { ...bannerResult.campaign, adventureCount: 0 }
      }
    }

    setCampaigns((prev) => [campaign, ...prev])
    setIsCreateCampaignModalOpen(false)
  }

  const handleEditCampaign = async (data: CampaignFormData) => {
    if (!editingCampaign) return

    const response = await fetch(`${API_URL}/api/campaigns/${editingCampaign.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: data.name, description: data.description || null }),
    })

    if (!response.ok) {
      throw new Error('Failed to update campaign')
    }

    const result: CampaignResponse = await response.json()
    let campaign: CampaignListItem = {
      ...result.campaign,
      adventureCount: editingCampaign.adventureCount,
    }

    if (data.bannerImage instanceof File) {
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
        campaign = { ...bannerResult.campaign, adventureCount: editingCampaign.adventureCount }
      }
    } else if (data.bannerImage === null && editingCampaign.bannerImageUrl) {
      const bannerResponse = await fetch(`${API_URL}/api/campaigns/${campaign.id}/banner`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (bannerResponse.ok) {
        const bannerResult: CampaignResponse = await bannerResponse.json()
        campaign = { ...bannerResult.campaign, adventureCount: editingCampaign.adventureCount }
      }
    } else if (data.bannerImage === undefined && editingCampaign.bannerImageUrl) {
      const hotspotChanged =
        data.hotspotX !== (editingCampaign.bannerHotspotX ?? 50) ||
        data.hotspotY !== (editingCampaign.bannerHotspotY ?? 50)

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
          campaign = { ...hotspotResult.campaign, adventureCount: editingCampaign.adventureCount }
        }
      }
    }

    setCampaigns((prev) => prev.map((c) => (c.id === campaign.id ? campaign : c)))
    setEditingCampaign(null)
  }

  const handleDeleteCampaign = async () => {
    if (!deletingCampaign) return

    const response = await fetch(`${API_URL}/api/campaigns/${deletingCampaign.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to delete campaign')
    }

    setCampaigns((prev) => prev.filter((c) => c.id !== deletingCampaign.id))
    setDeletingCampaign(null)

    // Refresh standalone adventures as some may have become standalone
    fetchAdventures()
  }

  // Adventure handlers
  const handleCreateAdventure = async (data: AdventureFormData) => {
    const response = await fetch(`${API_URL}/api/adventures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ name: data.name, description: data.description || undefined }),
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

    setAdventures((prev) => [adventure, ...prev])
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

    setAdventures((prev) => prev.map((a) => (a.id === adventure.id ? adventure : a)))
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

    setAdventures((prev) => prev.filter((a) => a.id !== deletingAdventure.id))
    setDeletingAdventure(null)
  }

  const isLoading = isLoadingCampaigns || isLoadingAdventures
  const hasNoCampaigns = !isLoadingCampaigns && campaigns.length === 0
  const hasNoAdventures = !isLoadingAdventures && adventures.length === 0
  const isEmpty = hasNoCampaigns && hasNoAdventures

  return (
    <>
      <div className="mx-auto max-w-6xl p-6 md:p-8">
      <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl uppercase tracking-wide text-ink md:text-3xl">
            Your Realms
          </h1>
          <p className="mt-1 font-body italic text-ink-soft">
            Select a realm to continue your work, or forge a new one
          </p>
        </div>
        <Button variant="primary" onClick={() => setIsCreateCampaignModalOpen(true)}>
          + New Campaign
        </Button>
      </header>

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <span className="animate-quill-scratch text-4xl">&#9998;</span>
            <span className="ml-4 font-body text-ink-soft">Loading your realms...</span>
          </div>
        ) : isEmpty ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 text-ink-soft">&#9876; &#9552;&#9552;&#9552;&#9552;&#9552;&#9552; &#9876;</div>
            <h2 className="font-display text-xl uppercase tracking-wide text-ink">
              No campaigns or adventures yet
            </h2>
            <p className="mt-2 max-w-md font-body text-ink-soft">
              Every great adventure begins with a single step. Create a campaign to organize your adventures, or create a standalone adventure to get started.
            </p>
            <div className="mt-6 flex gap-4">
              <Button variant="primary" onClick={() => setIsCreateCampaignModalOpen(true)}>
                Create Campaign
              </Button>
              <Button variant="default" onClick={() => setIsCreateAdventureModalOpen(true)}>
                Create Adventure
              </Button>
            </div>
          </div>
        ) : (
          <>
            {/* Campaigns Section */}
            <section className="mb-12">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg uppercase tracking-wide text-ink">
                  Campaigns
                </h2>
                {campaigns.length > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setIsCreateCampaignModalOpen(true)}
                  >
                    + New Campaign
                  </Button>
                )}
              </div>

              {campaignsError ? (
                <div className="rounded border-3 border-blood-red bg-parchment-100 p-6 text-center">
                  <p className="font-body text-blood-red">{campaignsError}</p>
                  <Button variant="ghost" onClick={fetchCampaigns} className="mt-4">
                    Try again
                  </Button>
                </div>
              ) : campaigns.length === 0 ? (
                <div className="rounded border-3 border-dashed border-ink-soft bg-parchment-200 p-6 text-center">
                  <p className="font-body text-ink-soft">
                    No campaigns yet.{' '}
                    <button
                      onClick={() => setIsCreateCampaignModalOpen(true)}
                      className="text-ink underline underline-offset-2 hover:text-ink-soft"
                    >
                      Create one
                    </button>{' '}
                    to organize your adventures.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                  {campaigns.map((campaign) => (
                    <CampaignCard
                      key={campaign.id}
                      campaign={campaign}
                      onEdit={setEditingCampaign}
                      onDelete={setDeletingCampaign}
                    />
                  ))}
                </div>
              )}
            </section>

            <Divider className="mb-8" />

            {/* Standalone Adventures Section */}
            <section>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="font-display text-lg uppercase tracking-wide text-ink">
                  Standalone Adventures
                </h2>
                {adventures.length > 0 && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setIsCreateAdventureModalOpen(true)}
                  >
                    + New Adventure
                  </Button>
                )}
              </div>

              {adventuresError ? (
                <div className="rounded border-3 border-blood-red bg-parchment-100 p-6 text-center">
                  <p className="font-body text-blood-red">{adventuresError}</p>
                  <Button variant="ghost" onClick={fetchAdventures} className="mt-4">
                    Try again
                  </Button>
                </div>
              ) : adventures.length === 0 ? (
                <div className="rounded border-3 border-dashed border-ink-soft bg-parchment-200 p-6 text-center">
                  <p className="font-body text-ink-soft">
                    No standalone adventures.{' '}
                    <button
                      onClick={() => setIsCreateAdventureModalOpen(true)}
                      className="text-ink underline underline-offset-2 hover:text-ink-soft"
                    >
                      Create one
                    </button>{' '}
                    or add adventures to a campaign.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {adventures.map((adventure) => (
                    <AdventureCard
                      key={adventure.id}
                      adventure={adventure}
                      onEdit={setEditingAdventure}
                      onDelete={setDeletingAdventure}
                    />
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>

      {/* Campaign Modals */}
      <CreateCampaignModal
        open={isCreateCampaignModalOpen}
        onClose={() => setIsCreateCampaignModalOpen(false)}
        onSubmit={handleCreateCampaign}
      />

      <CreateCampaignModal
        open={!!editingCampaign}
        onClose={() => setEditingCampaign(null)}
        onSubmit={handleEditCampaign}
        onDelete={() => {
          if (editingCampaign) {
            setDeletingCampaign(editingCampaign)
            setEditingCampaign(null)
          }
        }}
        campaign={editingCampaign}
      />

      <DeleteCampaignDialog
        open={!!deletingCampaign}
        onClose={() => setDeletingCampaign(null)}
        onConfirm={handleDeleteCampaign}
        campaign={deletingCampaign}
        adventureCount={deletingCampaign?.adventureCount}
      />

      {/* Adventure Modals */}
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
    </>
  )
}
