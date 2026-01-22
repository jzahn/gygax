import * as React from 'react'
import { useNavigate } from 'react-router'
import type { Campaign } from '@gygax/shared'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from './ui/dropdown-menu'
import { cn } from '@/lib/utils'

interface CampaignCardProps {
  campaign: Campaign
  onEdit: (campaign: Campaign) => void
  onDelete: (campaign: Campaign) => void
}

function formatRelativeTime(dateString: string): string {
  const date = new Date(dateString)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

  if (diffDays === 0) {
    return 'Today'
  } else if (diffDays === 1) {
    return 'Yesterday'
  } else if (diffDays < 7) {
    return `${diffDays} days ago`
  } else if (diffDays < 30) {
    const weeks = Math.floor(diffDays / 7)
    return weeks === 1 ? '1 week ago' : `${weeks} weeks ago`
  } else if (diffDays < 365) {
    const months = Math.floor(diffDays / 30)
    return months === 1 ? '1 month ago' : `${months} months ago`
  } else {
    const years = Math.floor(diffDays / 365)
    return years === 1 ? '1 year ago' : `${years} years ago`
  }
}

export function CampaignCard({ campaign, onEdit, onDelete }: CampaignCardProps) {
  const navigate = useNavigate()

  const handleCardClick = () => {
    navigate(`/campaigns/${campaign.id}`)
  }

  const handleMenuClick = (e: React.MouseEvent) => {
    e.stopPropagation()
  }

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation()
    onEdit(campaign)
  }

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation()
    onDelete(campaign)
  }

  return (
    <div
      onClick={handleCardClick}
      className="group cursor-pointer border-3 border-ink bg-parchment-100 shadow-brutal card-texture transition-all hover:-translate-y-1 hover:shadow-brutal-lg"
    >
      <div className="aspect-[2/3] overflow-hidden border-b-3 border-ink">
        {campaign.coverImageUrl ? (
          <img
            src={campaign.coverImageUrl}
            alt={campaign.name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center bg-parchment-200">
            <div className="mb-2 text-ink-soft">&#9876; &#9876;</div>
            <span className="px-4 text-center font-display text-lg uppercase tracking-wide text-ink">
              {campaign.name.length > 20 ? campaign.name.slice(0, 20) + '...' : campaign.name}
            </span>
          </div>
        )}
      </div>

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="font-display text-base uppercase tracking-wide text-ink line-clamp-1">
            {campaign.name}
          </h3>
          <DropdownMenu>
            <DropdownMenuTrigger asChild onClick={handleMenuClick}>
              <button className="flex-shrink-0 p-1 text-ink-soft hover:text-ink">
                <span className="text-lg leading-none">&#8942;</span>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onClick={handleEdit}>Edit</DropdownMenuItem>
              <DropdownMenuItem onClick={handleDelete} className="text-blood-red">
                Delete
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <p
          className={cn(
            'mt-1 font-body text-sm line-clamp-2',
            campaign.description ? 'text-ink-soft' : 'italic text-ink-faded'
          )}
        >
          {campaign.description || 'No description'}
        </p>

        <p className="mt-2 font-body text-xs text-ink-faded">
          Last modified: {formatRelativeTime(campaign.updatedAt)}
        </p>
      </div>
    </div>
  )
}
