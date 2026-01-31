import type { ChatChannel } from '@gygax/shared'

interface ChatTabsProps {
  channels: ChatChannel[]
  activeChannelId: string | null
  onSelectChannel: (channelId: string) => void
  onCreateChannel: () => void
}

export function ChatTabs({
  channels,
  activeChannelId,
  onSelectChannel,
  onCreateChannel,
}: ChatTabsProps) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto py-2 px-2 border-b-2 border-ink bg-parchment-200">
      {channels.map((channel) => {
        const isActive = channel.id === activeChannelId
        const displayName = channel.isMain
          ? 'Main'
          : channel.name || channel.participants.map((p) => p.name).join(', ')

        return (
          <button
            key={channel.id}
            onClick={() => onSelectChannel(channel.id)}
            className={`channel-tab ${isActive ? 'active' : ''}`}
          >
            {channel.isMain && <span className="channel-tab-icon">&#9733;</span>}
            {!channel.isMain && <span className="channel-tab-icon">&#128274;</span>}
            <span className="truncate max-w-[100px]">{displayName}</span>
            {channel.unreadCount > 0 && (
              <span className="channel-tab-unread animate-unread-pulse">
                {channel.unreadCount > 99 ? '99+' : channel.unreadCount}
              </span>
            )}
          </button>
        )
      })}
      <button
        onClick={onCreateChannel}
        className="channel-tab hover:bg-parchment-300"
        title="New conversation"
      >
        +
      </button>
    </div>
  )
}
