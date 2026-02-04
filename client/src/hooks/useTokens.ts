import { useState, useEffect, useCallback } from 'react'
import type {
  CellCoord,
  SessionToken,
  SessionTokenType,
  WSMessage,
  WSTokenState,
  WSTokenPlaced,
  WSTokenMoved,
  WSTokenRemoved,
} from '@gygax/shared'

interface UseTokensOptions {
  mapId: string | null
  isDm: boolean
  lastMessage: WSMessage | null
  tokenState: WSTokenState | null  // Dedicated token state from socket (avoids message batching issues)
  sendMessage: (type: string, payload: unknown) => void
  isConnected: boolean
}

interface UseTokensReturn {
  tokens: SessionToken[]
  selectedTokenId: string | null
  selectToken: (tokenId: string | null) => void
  placeToken: (
    type: SessionTokenType,
    name: string,
    position: CellCoord,
    options?: {
      characterId?: string
      npcId?: string
      color?: string
      imageUrl?: string
    }
  ) => void
  moveToken: (tokenId: string, position: CellCoord) => void
  removeToken: (tokenId: string) => void
  getTokenAt: (coord: CellCoord) => SessionToken | undefined
}

// Check if two cell coordinates are equal
function cellsEqual(a: CellCoord, b: CellCoord): boolean {
  // Square grid comparison
  if (a.col !== undefined && a.row !== undefined && b.col !== undefined && b.row !== undefined) {
    return a.col === b.col && a.row === b.row
  }
  // Hex grid comparison
  if (a.q !== undefined && a.r !== undefined && b.q !== undefined && b.r !== undefined) {
    return a.q === b.q && a.r === b.r
  }
  return false
}

export function useTokens({
  mapId,
  isDm,
  lastMessage,
  tokenState,
  sendMessage,
  isConnected,
}: UseTokensOptions): UseTokensReturn {
  const [tokens, setTokens] = useState<SessionToken[]>([])
  const [selectedTokenId, setSelectedTokenId] = useState<string | null>(null)

  // Reset when map changes
  useEffect(() => {
    setTokens([])
    setSelectedTokenId(null)

    // Request token state for the new map (backup in case proactive send is missed)
    if (mapId && isConnected) {
      sendMessage('token:get-state', { mapId })
    }
  }, [mapId, isConnected, sendMessage])

  // Apply token state from dedicated socket state (handles proactive sends reliably)
  useEffect(() => {
    if (tokenState && tokenState.mapId === mapId) {
      setTokens(tokenState.tokens)
    }
  }, [tokenState, mapId])

  // Handle incremental token updates via lastMessage
  useEffect(() => {
    if (!lastMessage) return

    switch (lastMessage.type) {
      case 'token:placed': {
        const payload = lastMessage.payload as WSTokenPlaced
        if (payload.token.mapId === mapId) {
          setTokens((prev) => [...prev, payload.token])
        }
        break
      }
      case 'token:moved': {
        const payload = lastMessage.payload as WSTokenMoved
        setTokens((prev) =>
          prev.map((token) =>
            token.id === payload.tokenId ? { ...token, position: payload.position } : token
          )
        )
        break
      }
      case 'token:removed': {
        const payload = lastMessage.payload as WSTokenRemoved
        setTokens((prev) => prev.filter((token) => token.id !== payload.tokenId))
        if (selectedTokenId === payload.tokenId) {
          setSelectedTokenId(null)
        }
        break
      }
    }
  }, [lastMessage, mapId, selectedTokenId])

  // Select a token
  const selectToken = useCallback((tokenId: string | null) => {
    setSelectedTokenId(tokenId)
  }, [])

  // Place a new token (DM only)
  const placeToken = useCallback(
    (
      type: SessionTokenType,
      name: string,
      position: CellCoord,
      options?: {
        characterId?: string
        npcId?: string
        color?: string
        imageUrl?: string
      }
    ) => {
      if (!isDm || !mapId) return
      sendMessage('token:place', {
        mapId,
        type,
        name,
        position,
        ...options,
      })
    },
    [isDm, mapId, sendMessage]
  )

  // Move a token (DM only)
  const moveToken = useCallback(
    (tokenId: string, position: CellCoord) => {
      if (!isDm) return
      sendMessage('token:move', { tokenId, position })
    },
    [isDm, sendMessage]
  )

  // Remove a token (DM only)
  const removeToken = useCallback(
    (tokenId: string) => {
      if (!isDm) return
      sendMessage('token:remove', { tokenId })
    },
    [isDm, sendMessage]
  )

  // Get token at a specific coordinate
  const getTokenAt = useCallback(
    (coord: CellCoord): SessionToken | undefined => {
      return tokens.find((token) => cellsEqual(token.position, coord))
    },
    [tokens]
  )

  return {
    tokens,
    selectedTokenId,
    selectToken,
    placeToken,
    moveToken,
    removeToken,
    getTokenAt,
  }
}
