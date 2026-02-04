import * as React from 'react'
import type { SessionToken, SessionTokenType, SessionParticipantWithDetails, NPC } from '@gygax/shared'
import { Button, Input } from './ui'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog'

interface TokenToolsProps {
  tokens: SessionToken[]
  participants: SessionParticipantWithDetails[]
  npcs: NPC[]
  selectedTokenId: string | null
  onPlacePCToken: (participantId: string) => void
  onPlaceNPCToken: (name: string, npcId?: string) => void
  onPlaceMonsterToken: (name: string) => void
  onSelectToken: (tokenId: string | null) => void
  onRemoveToken: (tokenId: string) => void
  disabled?: boolean
}

type PlacingMode = 'pc' | 'npc' | 'monster' | null

const TOKEN_TYPE_COLORS: Record<SessionTokenType, string> = {
  PC: '#22c55e',
  NPC: '#3b82f6',
  MONSTER: '#ef4444',
}

export function TokenTools({
  tokens,
  participants,
  npcs,
  selectedTokenId,
  onPlacePCToken,
  onPlaceNPCToken,
  onPlaceMonsterToken,
  onSelectToken,
  onRemoveToken,
  disabled = false,
}: TokenToolsProps) {
  const [placingMode, setPlacingMode] = React.useState<PlacingMode>(null)
  const [selectedParticipantId, setSelectedParticipantId] = React.useState<string | null>(null)
  const [tokenName, setTokenName] = React.useState('')
  const [selectedNpcId, setSelectedNpcId] = React.useState<string | null>(null)

  const handleOpenPCDialog = () => {
    setPlacingMode('pc')
    setSelectedParticipantId(null)
  }

  const handleOpenNPCDialog = () => {
    setPlacingMode('npc')
    setTokenName('')
    setSelectedNpcId(null)
  }

  const handleOpenMonsterDialog = () => {
    setPlacingMode('monster')
    setTokenName('')
  }

  const handleCloseDialog = () => {
    setPlacingMode(null)
    setSelectedParticipantId(null)
    setTokenName('')
    setSelectedNpcId(null)
  }

  const handlePlacePC = () => {
    if (selectedParticipantId) {
      onPlacePCToken(selectedParticipantId)
      handleCloseDialog()
    }
  }

  const handlePlaceNPC = () => {
    const name = selectedNpcId
      ? npcs.find((n) => n.id === selectedNpcId)?.name || tokenName
      : tokenName

    if (name.trim()) {
      onPlaceNPCToken(name.trim(), selectedNpcId || undefined)
      handleCloseDialog()
    }
  }

  const handlePlaceMonster = () => {
    if (tokenName.trim()) {
      onPlaceMonsterToken(tokenName.trim())
      handleCloseDialog()
    }
  }

  const handleDeleteSelected = () => {
    if (selectedTokenId) {
      onRemoveToken(selectedTokenId)
      onSelectToken(null)
    }
  }

  // Filter participants who don't already have a PC token
  const existingPCCharacterIds = new Set(
    tokens.filter((t) => t.type === 'PC' && t.characterId).map((t) => t.characterId)
  )
  const availableParticipants = participants.filter(
    (p) => !existingPCCharacterIds.has(p.characterId)
  )

  return (
    <div className="flex flex-col gap-2">
      {/* Token placement buttons */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={handleOpenPCDialog}
          disabled={disabled || availableParticipants.length === 0}
          className="flex-1"
          title="Add player character token"
        >
          <span className="mr-1" style={{ color: TOKEN_TYPE_COLORS.PC }}>&#9679;</span>
          +PC
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleOpenNPCDialog}
          disabled={disabled}
          className="flex-1"
          title="Add NPC token"
        >
          <span className="mr-1" style={{ color: TOKEN_TYPE_COLORS.NPC }}>&#9679;</span>
          +NPC
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={handleOpenMonsterDialog}
          disabled={disabled}
          className="flex-1"
          title="Add monster token"
        >
          <span className="mr-1" style={{ color: TOKEN_TYPE_COLORS.MONSTER }}>&#9679;</span>
          +Monster
        </Button>
      </div>

      {/* Active tokens list (horizontal chips on mobile) */}
      {tokens.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {tokens.map((token) => (
            <button
              key={token.id}
              type="button"
              onClick={() => onSelectToken(selectedTokenId === token.id ? null : token.id)}
              className={`flex items-center gap-1 border-2 px-2 py-0.5 font-body text-xs ${
                selectedTokenId === token.id
                  ? 'border-ink bg-ink text-parchment-100'
                  : 'border-ink bg-parchment-100 text-ink hover:bg-parchment-200'
              }`}
              title={token.name}
            >
              <span style={{ color: token.color }}>&#9679;</span>
              <span className="max-w-16 truncate">{token.name}</span>
            </button>
          ))}
        </div>
      )}

      {/* Delete selected token button */}
      {selectedTokenId && (
        <Button
          variant="ghost"
          size="sm"
          onClick={handleDeleteSelected}
          disabled={disabled}
          className="text-blood-red hover:bg-blood-red hover:text-parchment-100"
        >
          &#128465; Remove Selected
        </Button>
      )}

      {/* PC Token Dialog */}
      <Dialog open={placingMode === 'pc'} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Place PC Token</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <p className="font-body text-sm text-ink">
              Select a player to place their character token on the map.
            </p>
            <div className="flex flex-col gap-1">
              {availableParticipants.length === 0 ? (
                <p className="font-body text-sm text-ink-soft">
                  All players already have tokens on the map.
                </p>
              ) : (
                availableParticipants.map((p) => (
                  <label
                    key={p.id}
                    className={`flex cursor-pointer items-center gap-2 border-2 p-2 ${
                      selectedParticipantId === p.id
                        ? 'border-ink bg-ink/10'
                        : 'border-ink/30 hover:border-ink'
                    }`}
                  >
                    <input
                      type="radio"
                      name="participant"
                      value={p.id}
                      checked={selectedParticipantId === p.id}
                      onChange={() => setSelectedParticipantId(p.id)}
                      className="sr-only"
                    />
                    <span
                      className={`h-4 w-4 border-2 border-ink ${
                        selectedParticipantId === p.id ? 'bg-ink' : 'bg-parchment-100'
                      }`}
                    />
                    <span className="font-body text-sm text-ink">
                      {p.user.name} - {p.character.name} ({p.character.class} {p.character.level})
                    </span>
                  </label>
                ))
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handlePlacePC}
              disabled={!selectedParticipantId}
            >
              Place
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* NPC Token Dialog */}
      <Dialog open={placingMode === 'npc'} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Place NPC Token</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              label="Token Name"
              value={tokenName}
              onChange={(e) => {
                setTokenName(e.target.value)
                setSelectedNpcId(null)
              }}
              placeholder="Enter name..."
            />
            {npcs.length > 0 && (
              <>
                <p className="font-body text-xs text-ink-soft">Or select from Adventure NPCs:</p>
                <div className="max-h-32 overflow-y-auto border-2 border-ink/30">
                  {npcs.map((npc) => (
                    <button
                      key={npc.id}
                      type="button"
                      onClick={() => {
                        setSelectedNpcId(npc.id)
                        setTokenName(npc.name)
                      }}
                      className={`w-full px-2 py-1 text-left font-body text-sm ${
                        selectedNpcId === npc.id
                          ? 'bg-ink/10 text-ink'
                          : 'text-ink hover:bg-parchment-200'
                      }`}
                    >
                      {npc.name}
                    </button>
                  ))}
                </div>
              </>
            )}
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handlePlaceNPC}
              disabled={!tokenName.trim()}
            >
              Place
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Monster Token Dialog */}
      <Dialog open={placingMode === 'monster'} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Place Monster Token</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col gap-3">
            <Input
              label="Monster Name"
              value={tokenName}
              onChange={(e) => setTokenName(e.target.value)}
              placeholder="e.g., Goblin Scout"
            />
          </div>
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handlePlaceMonster}
              disabled={!tokenName.trim()}
            >
              Place
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
