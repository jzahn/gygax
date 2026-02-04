import { useState, useCallback } from 'react'
import * as Dialog from '@radix-ui/react-dialog'

interface CreateChannelDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  participants: Array<{
    userId: string
    userName: string
    avatarUrl: string | null
    characterName?: string
  }>
  currentUserId: string
  onCreateChannel: (participantIds: string[], name?: string) => Promise<void>
}

export function CreateChannelDialog({
  open,
  onOpenChange,
  participants,
  currentUserId,
  onCreateChannel,
}: CreateChannelDialogProps) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [channelName, setChannelName] = useState('')
  const [isCreating, setIsCreating] = useState(false)

  // Filter out current user from participant list
  const availableParticipants = participants.filter((p) => p.userId !== currentUserId)

  const toggleParticipant = (userId: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(userId)) {
        next.delete(userId)
      } else {
        next.add(userId)
      }
      return next
    })
  }

  const handleCreate = async () => {
    if (selectedIds.size === 0) return

    setIsCreating(true)
    try {
      const name = selectedIds.size > 1 && channelName.trim() ? channelName.trim() : undefined
      await onCreateChannel(Array.from(selectedIds), name)
      // Reset and close
      setSelectedIds(new Set())
      setChannelName('')
      onOpenChange(false)
    } finally {
      setIsCreating(false)
    }
  }

  const handleOpenChange = useCallback((open: boolean) => {
    if (!open) {
      // Reset state when closing
      setSelectedIds(new Set())
      setChannelName('')
    }
    onOpenChange(open)
  }, [onOpenChange])

  const showNameField = selectedIds.size > 1

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-ink/50 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-50 w-full max-w-md card-texture border-3 border-ink shadow-brutal p-6">
          <Dialog.Title className="text-display text-lg mb-4 text-center">
            Start a Conversation
          </Dialog.Title>

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-display uppercase tracking-wider mb-2">
                Select participants:
              </label>
              <div className="border-2 border-ink bg-parchment-100 max-h-48 overflow-y-auto">
                {availableParticipants.length === 0 ? (
                  <div className="p-3 text-center text-ink-faded italic">
                    No other participants available
                  </div>
                ) : (
                  availableParticipants.map((p) => (
                    <label
                      key={p.userId}
                      className="flex items-center gap-3 p-2 hover:bg-parchment-200 cursor-pointer border-b border-parchment-200 last:border-b-0"
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.userId)}
                        onChange={() => toggleParticipant(p.userId)}
                        className="w-4 h-4"
                      />
                      <span className="font-body">
                        {p.userName}
                        {p.characterName && (
                          <span className="text-ink-faded text-sm ml-1">
                            ({p.characterName})
                          </span>
                        )}
                      </span>
                    </label>
                  ))
                )}
              </div>
            </div>

            {showNameField && (
              <div>
                <label className="block text-sm font-display uppercase tracking-wider mb-2">
                  Channel name (optional):
                </label>
                <input
                  type="text"
                  value={channelName}
                  onChange={(e) => setChannelName(e.target.value)}
                  placeholder="Leave blank for auto-generated"
                  className="input-brutal w-full px-3 py-2 border-2 border-ink bg-parchment-100 font-input text-sm"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3 mt-6">
            <Dialog.Close asChild>
              <button className="btn-brutal px-4 py-2 border-2 border-ink bg-parchment-200 font-display text-sm uppercase tracking-wider">
                Cancel
              </button>
            </Dialog.Close>
            <button
              onClick={handleCreate}
              disabled={selectedIds.size === 0 || isCreating}
              className="btn-brutal px-4 py-2 border-2 border-ink bg-ink text-parchment-100 font-display text-sm uppercase tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isCreating ? 'Creating...' : 'Create'}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
