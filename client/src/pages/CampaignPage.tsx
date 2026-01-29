import * as React from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import type {
  CampaignWithAdventures,
  CampaignWithAdventuresResponse,
  CampaignResponse,
  Adventure,
  AdventureResponse,
  MapResponse,
  CampaignMemberWithDetails,
  CampaignMembersResponse,
  CampaignMemberResponse,
} from '@gygax/shared'
import { Button, Divider } from '../components/ui'
import { CreateCampaignModal, CampaignFormData } from '../components/CreateCampaignModal'
import { DeleteCampaignDialog } from '../components/DeleteCampaignDialog'
import { AdventureCard } from '../components/AdventureCard'
import { CreateAdventureModal, AdventureFormData } from '../components/CreateAdventureModal'
import { DeleteAdventureDialog } from '../components/DeleteAdventureDialog'
import { CreateMapModal, MapFormData } from '../components/CreateMapModal'
import { DeleteMapDialog } from '../components/DeleteMapDialog'
import { MapPreview } from '../components/MapPreview'
import { AddCampaignMemberModal } from '../components/AddCampaignMemberModal'

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
  const [isCreateWorldMapModalOpen, setIsCreateWorldMapModalOpen] = React.useState(false)
  const [isDeletingWorldMap, setIsDeletingWorldMap] = React.useState(false)
  const [members, setMembers] = React.useState<CampaignMemberWithDetails[]>([])
  const [isLoadingMembers, setIsLoadingMembers] = React.useState(true)
  const [isAddMemberModalOpen, setIsAddMemberModalOpen] = React.useState(false)
  const [removingMemberId, setRemovingMemberId] = React.useState<string | null>(null)

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

  const fetchMembers = React.useCallback(async () => {
    if (!id) return

    try {
      const response = await fetch(`${API_URL}/api/campaigns/${id}/members`, {
        credentials: 'include',
      })

      if (!response.ok) {
        return
      }

      const data: CampaignMembersResponse = await response.json()
      setMembers(data.members)
    } catch {
      // Silently fail - members section will be empty
    } finally {
      setIsLoadingMembers(false)
    }
  }, [id])

  React.useEffect(() => {
    fetchMembers()
  }, [fetchMembers])

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

  const handleCreateWorldMap = async (data: MapFormData) => {
    if (!campaign) return

    const response = await fetch(`${API_URL}/api/campaigns/${campaign.id}/world-map`, {
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
      throw new Error('Failed to create world map')
    }

    const result: MapResponse = await response.json()
    setCampaign((prev) => (prev ? { ...prev, worldMap: result.map } : null))
    setIsCreateWorldMapModalOpen(false)
  }

  const handleDeleteWorldMap = async () => {
    if (!campaign) return

    const response = await fetch(`${API_URL}/api/campaigns/${campaign.id}/world-map`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to delete world map')
    }

    setCampaign((prev) => (prev ? { ...prev, worldMap: null } : null))
    setIsDeletingWorldMap(false)
  }

  const handleAddMember = async (email: string) => {
    if (!campaign) return

    const response = await fetch(`${API_URL}/api/campaigns/${campaign.id}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email }),
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}))
      throw new Error(errorData.message || 'Failed to add member')
    }

    const result: CampaignMemberResponse = await response.json()
    setMembers((prev) => [...prev, result.member])
    setIsAddMemberModalOpen(false)
  }

  const handleRemoveMember = async (memberId: string) => {
    if (!campaign) return

    setRemovingMemberId(memberId)

    try {
      const response = await fetch(`${API_URL}/api/campaigns/${campaign.id}/members/${memberId}`, {
        method: 'DELETE',
        credentials: 'include',
      })

      if (!response.ok) {
        throw new Error('Failed to remove member')
      }

      setMembers((prev) => prev.filter((m) => m.id !== memberId))
    } finally {
      setRemovingMemberId(null)
    }
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

        {/* World Map Section */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg uppercase tracking-wide text-ink">Campaign Map</h2>
          </div>

          {campaign.worldMap ? (
            <Link
              to={`/maps/${campaign.worldMap.id}`}
              className="group block border-3 border-ink bg-parchment-100 shadow-brutal card-texture transition-all hover:-translate-y-1 hover:shadow-brutal-lg"
            >
              <div className="relative border-b-3 border-ink bg-white">
                <div className="h-48 w-full md:h-56">
                  <MapPreview map={campaign.worldMap} />
                </div>
                <span className="absolute left-2 top-2 border-2 border-ink bg-white/80 px-1.5 py-0.5 font-display text-xs uppercase tracking-wide text-ink">
                  &#127758; Campaign Map
                </span>
              </div>
              <div className="flex items-center justify-between p-3">
                <div>
                  <h3 className="line-clamp-1 font-display text-sm uppercase tracking-wide text-ink">
                    {campaign.worldMap.name}
                  </h3>
                  <p className="mt-1 font-body text-xs text-ink-soft">
                    {campaign.worldMap.width}&times;{campaign.worldMap.height} &bull;{' '}
                    {campaign.worldMap.gridType === 'HEX' ? 'Hex' : 'Square'} grid
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault()
                    setIsDeletingWorldMap(true)
                  }}
                  className="text-blood-red opacity-0 group-hover:opacity-100"
                >
                  Delete
                </Button>
              </div>
            </Link>
          ) : (
            <div className="rounded border-3 border-dashed border-ink-soft bg-parchment-200 p-8 text-center">
              <div className="mb-4 text-2xl text-ink-soft">&#127758;</div>
              <p className="font-body text-ink">No world map yet</p>
              <p className="mt-1 font-body text-sm text-ink-soft">
                Chart the world your adventures inhabit.
              </p>
              <Button
                variant="default"
                className="mt-4"
                onClick={() => setIsCreateWorldMapModalOpen(true)}
              >
                Create World Map
              </Button>
            </div>
          )}
        </div>

        {/* Members Section */}
        <div className="mb-8">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg uppercase tracking-wide text-ink">
              Campaign Members
            </h2>
            <Button variant="default" size="sm" onClick={() => setIsAddMemberModalOpen(true)}>
              + Add Member
            </Button>
          </div>

          {isLoadingMembers ? (
            <div className="flex items-center gap-2 py-4">
              <span className="animate-quill-scratch text-xl">&#9998;</span>
              <span className="font-body text-ink-soft">Loading members...</span>
            </div>
          ) : members.length === 0 ? (
            <div className="rounded border-3 border-dashed border-ink-soft bg-parchment-200 p-8 text-center">
              <div className="mb-4 text-2xl text-ink-soft">&#128100;</div>
              <p className="font-body text-ink">No members yet</p>
              <p className="mt-1 font-body text-sm text-ink-soft">
                Add players to your campaign. Members can auto-join Campaign-type sessions.
              </p>
              <Button
                variant="default"
                className="mt-4"
                onClick={() => setIsAddMemberModalOpen(true)}
              >
                Add Member
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center justify-between border-3 border-ink bg-parchment-100 p-3"
                >
                  <div className="flex items-center gap-3">
                    {member.user.avatarUrl ? (
                      <img
                        src={member.user.avatarUrl}
                        alt={member.user.name}
                        className="h-10 w-10 rounded-full border-2 border-ink object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full border-2 border-ink bg-parchment-200">
                        <span className="font-display text-sm uppercase text-ink">
                          {member.user.name.charAt(0)}
                        </span>
                      </div>
                    )}
                    <div>
                      <p className="font-display text-sm uppercase tracking-wide text-ink">
                        {member.user.name}
                      </p>
                      <p className="font-body text-xs text-ink-soft">{member.user.email}</p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleRemoveMember(member.id)}
                    loading={removingMemberId === member.id}
                    loadingText="Removing..."
                    className="text-blood-red"
                  >
                    Remove
                  </Button>
                </div>
              ))}
            </div>
          )}
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

      <CreateMapModal
        open={isCreateWorldMapModalOpen}
        onClose={() => setIsCreateWorldMapModalOpen(false)}
        onSubmit={handleCreateWorldMap}
        title="Chart the World"
        defaultGridType="HEX"
        defaultWidth={40}
        defaultHeight={30}
      />

      <DeleteMapDialog
        open={isDeletingWorldMap}
        onClose={() => setIsDeletingWorldMap(false)}
        onConfirm={handleDeleteWorldMap}
        map={campaign.worldMap}
      />

      <AddCampaignMemberModal
        open={isAddMemberModalOpen}
        onClose={() => setIsAddMemberModalOpen(false)}
        onSubmit={handleAddMember}
      />
    </div>
  )
}
