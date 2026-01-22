import * as React from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import type { Campaign, CampaignResponse } from '@gygax/shared'
import { Button, Divider } from '../components/ui'
import { CreateCampaignModal } from '../components/CreateCampaignModal'
import { DeleteCampaignDialog } from '../components/DeleteCampaignDialog'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export function CampaignPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [campaign, setCampaign] = React.useState<Campaign | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)

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

  const handleEditCampaign = async (data: {
    name: string
    description: string
    coverImage: File | null | undefined
  }) => {
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
      const formData = new FormData()
      formData.append('image', data.coverImage)

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
      const coverResponse = await fetch(`${API_URL}/api/campaigns/${campaign.id}/cover`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (coverResponse.ok) {
        const coverResult: CampaignResponse = await coverResponse.json()
        updatedCampaign = coverResult.campaign
      }
    }
    // When coverImage is undefined, keep existing image (no API call)

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

        <div className="rounded border-3 border-dashed border-ink-soft bg-parchment-200 p-8 text-center">
          <div className="mb-4 text-2xl text-ink-soft">&#128506;</div>
          <h2 className="font-display text-lg uppercase tracking-wide text-ink">Coming Soon</h2>
          <p className="mt-2 font-body text-ink-soft">
            Maps, encounters, and session tools will appear here in future updates.
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
    </div>
  )
}
