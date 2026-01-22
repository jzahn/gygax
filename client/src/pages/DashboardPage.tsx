import * as React from 'react'
import { useNavigate } from 'react-router'
import type { Campaign, CampaignListResponse, CampaignResponse } from '@gygax/shared'
import { useAuth } from '../hooks'
import { Button, Divider } from '../components/ui'
import { CampaignCard } from '../components/CampaignCard'
import { CreateCampaignModal, CampaignFormData } from '../components/CreateCampaignModal'
import { DeleteCampaignDialog } from '../components/DeleteCampaignDialog'

const API_URL = import.meta.env.VITE_API_URL || ''

export function DashboardPage() {
  const navigate = useNavigate()
  const { user, logout } = useAuth()
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([])
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)

  const [isCreateModalOpen, setIsCreateModalOpen] = React.useState(false)
  const [editingCampaign, setEditingCampaign] = React.useState<Campaign | null>(null)
  const [deletingCampaign, setDeletingCampaign] = React.useState<Campaign | null>(null)

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
      setError('Failed to load campaigns')
    } finally {
      setIsLoading(false)
    }
  }, [])

  React.useEffect(() => {
    fetchCampaigns()
  }, [fetchCampaigns])

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

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
    let campaign = result.campaign

    if (data.coverImage) {
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
        campaign = coverResult.campaign
      }
    }

    setCampaigns((prev) => [campaign, ...prev])
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
    let campaign = result.campaign

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
        campaign = coverResult.campaign
      }
    } else if (data.coverImage === null && editingCampaign.coverImageUrl) {
      // Explicitly removing cover image
      const coverResponse = await fetch(`${API_URL}/api/campaigns/${campaign.id}/cover`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (coverResponse.ok) {
        const coverResult: CampaignResponse = await coverResponse.json()
        campaign = coverResult.campaign
      }
    } else if (data.coverImage === undefined && editingCampaign.coverImageUrl) {
      // Check if focal point changed for existing image
      const focusChanged =
        data.focusX !== (editingCampaign.coverImageFocusX ?? 50) ||
        data.focusY !== (editingCampaign.coverImageFocusY ?? 50)

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
          campaign = focusResult.campaign
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
  }

  const openEditModal = (campaign: Campaign) => {
    setEditingCampaign(campaign)
  }

  const openDeleteDialog = (campaign: Campaign) => {
    setDeletingCampaign(campaign)
  }

  return (
    <div className="min-h-screen paper-texture">
      <div className="mx-auto max-w-6xl p-6 md:p-8">
        <header className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="font-display text-2xl uppercase tracking-wide text-ink md:text-3xl">
              Your Campaigns
            </h1>
            <p className="mt-1 font-body italic text-ink-soft">
              Select a realm to continue your work, or forge a new one
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="primary" onClick={() => setIsCreateModalOpen(true)}>
              + New Campaign
            </Button>
            <Button variant="ghost" onClick={handleLogout}>
              Depart
            </Button>
          </div>
        </header>

        <Divider className="mb-8" />

        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <span className="animate-quill-scratch text-4xl">&#9998;</span>
            <span className="ml-4 font-body text-ink-soft">Loading your realms...</span>
          </div>
        ) : error ? (
          <div className="rounded border-3 border-blood-red bg-parchment-100 p-6 text-center">
            <p className="font-body text-blood-red">{error}</p>
            <Button variant="ghost" onClick={fetchCampaigns} className="mt-4">
              Try again
            </Button>
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <div className="mb-4 text-ink-soft">&#9876; &#9552;&#9552;&#9552;&#9552;&#9552;&#9552; &#9876;</div>
            <h2 className="font-display text-xl uppercase tracking-wide text-ink">
              No campaigns yet
            </h2>
            <p className="mt-2 max-w-md font-body text-ink-soft">
              Every great adventure begins with a single step. Create your first campaign to begin.
            </p>
            <Button
              variant="primary"
              onClick={() => setIsCreateModalOpen(true)}
              className="mt-6"
            >
              Create Campaign
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {campaigns.map((campaign) => (
              <CampaignCard
                key={campaign.id}
                campaign={campaign}
                onEdit={openEditModal}
                onDelete={openDeleteDialog}
              />
            ))}
          </div>
        )}

        <footer className="mt-16 text-center">
          <p className="font-body text-sm text-ink-faded">
            Signed in as <span className="font-medium">{user?.name}</span>
          </p>
        </footer>
      </div>

      <CreateCampaignModal
        open={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
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
      />
    </div>
  )
}
