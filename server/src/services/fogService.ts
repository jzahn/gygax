import type { PrismaClient } from '../../prisma/generated/prisma/index.js'
import type { CellCoord, FogState } from '@gygax/shared'

// Determine fog storage level for a map
// Returns: { type: 'campaign', id } | { type: 'adventure', id } | { type: 'session' }
async function getFogStorageLevel(
  prisma: PrismaClient,
  mapId: string
): Promise<{ type: 'campaign'; id: string } | { type: 'adventure'; id: string } | { type: 'session' }> {
  const map = await prisma.map.findUnique({
    where: { id: mapId },
    select: { campaignId: true, adventureId: true },
  })

  if (map?.campaignId) {
    // Campaign world map - fog persists at campaign level
    return { type: 'campaign', id: map.campaignId }
  } else if (map?.adventureId) {
    // Adventure map - fog persists at adventure level
    return { type: 'adventure', id: map.adventureId }
  } else {
    // Fallback to session level (shouldn't happen in practice)
    return { type: 'session' }
  }
}

// Get fog state for a map - handles campaign, adventure, and session maps
export async function getFogState(
  prisma: PrismaClient,
  sessionId: string,
  mapId: string
): Promise<FogState> {
  const storageLevel = await getFogStorageLevel(prisma, mapId)

  if (storageLevel.type === 'campaign') {
    const state = await prisma.campaignMapState.findUnique({
      where: {
        campaignId_mapId: {
          campaignId: storageLevel.id,
          mapId,
        },
      },
    })
    return {
      mapId,
      revealedCells: state ? (state.revealedCells as CellCoord[]) : [],
    }
  } else if (storageLevel.type === 'adventure') {
    const state = await prisma.adventureMapState.findUnique({
      where: {
        adventureId_mapId: {
          adventureId: storageLevel.id,
          mapId,
        },
      },
    })
    return {
      mapId,
      revealedCells: state ? (state.revealedCells as CellCoord[]) : [],
    }
  } else {
    const state = await prisma.sessionMapState.findUnique({
      where: {
        sessionId_mapId: {
          sessionId,
          mapId,
        },
      },
    })
    return {
      mapId,
      revealedCells: state ? (state.revealedCells as CellCoord[]) : [],
    }
  }
}

// Check if two cell coordinates are equal
function cellsEqual(a: CellCoord, b: CellCoord): boolean {
  if (a.col !== undefined && a.row !== undefined && b.col !== undefined && b.row !== undefined) {
    return a.col === b.col && a.row === b.row
  }
  if (a.q !== undefined && a.r !== undefined && b.q !== undefined && b.r !== undefined) {
    return a.q === b.q && a.r === b.r
  }
  return false
}

// Reveal cells on a map (returns newly revealed cells)
export async function revealCells(
  prisma: PrismaClient,
  sessionId: string,
  mapId: string,
  cells: CellCoord[]
): Promise<CellCoord[]> {
  const storageLevel = await getFogStorageLevel(prisma, mapId)

  if (storageLevel.type === 'campaign') {
    let state = await prisma.campaignMapState.findUnique({
      where: { campaignId_mapId: { campaignId: storageLevel.id, mapId } },
    })

    if (!state) {
      state = await prisma.campaignMapState.create({
        data: { campaignId: storageLevel.id, mapId, revealedCells: [] },
      })
    }

    const currentRevealed = state.revealedCells as CellCoord[]
    const newlyRevealed = cells.filter(
      (cell) => !currentRevealed.some((existing) => cellsEqual(existing, cell))
    )

    if (newlyRevealed.length === 0) return []

    await prisma.campaignMapState.update({
      where: { campaignId_mapId: { campaignId: storageLevel.id, mapId } },
      data: { revealedCells: [...currentRevealed, ...newlyRevealed] },
    })

    return newlyRevealed
  } else if (storageLevel.type === 'adventure') {
    let state = await prisma.adventureMapState.findUnique({
      where: { adventureId_mapId: { adventureId: storageLevel.id, mapId } },
    })

    if (!state) {
      state = await prisma.adventureMapState.create({
        data: { adventureId: storageLevel.id, mapId, revealedCells: [] },
      })
    }

    const currentRevealed = state.revealedCells as CellCoord[]
    const newlyRevealed = cells.filter(
      (cell) => !currentRevealed.some((existing) => cellsEqual(existing, cell))
    )

    if (newlyRevealed.length === 0) return []

    await prisma.adventureMapState.update({
      where: { adventureId_mapId: { adventureId: storageLevel.id, mapId } },
      data: { revealedCells: [...currentRevealed, ...newlyRevealed] },
    })

    return newlyRevealed
  } else {
    let state = await prisma.sessionMapState.findUnique({
      where: { sessionId_mapId: { sessionId, mapId } },
    })

    if (!state) {
      state = await prisma.sessionMapState.create({
        data: { sessionId, mapId, revealedCells: [] },
      })
    }

    const currentRevealed = state.revealedCells as CellCoord[]
    const newlyRevealed = cells.filter(
      (cell) => !currentRevealed.some((existing) => cellsEqual(existing, cell))
    )

    if (newlyRevealed.length === 0) return []

    await prisma.sessionMapState.update({
      where: { sessionId_mapId: { sessionId, mapId } },
      data: { revealedCells: [...currentRevealed, ...newlyRevealed] },
    })

    return newlyRevealed
  }
}

// Reveal all cells on a map
export async function revealAll(
  prisma: PrismaClient,
  sessionId: string,
  mapId: string,
  allCells: CellCoord[]
): Promise<CellCoord[]> {
  const storageLevel = await getFogStorageLevel(prisma, mapId)

  if (storageLevel.type === 'campaign') {
    const state = await prisma.campaignMapState.findUnique({
      where: { campaignId_mapId: { campaignId: storageLevel.id, mapId } },
    })

    const currentRevealed = state ? (state.revealedCells as CellCoord[]) : []
    const newlyRevealed = allCells.filter(
      (cell) => !currentRevealed.some((existing) => cellsEqual(existing, cell))
    )

    await prisma.campaignMapState.upsert({
      where: { campaignId_mapId: { campaignId: storageLevel.id, mapId } },
      create: { campaignId: storageLevel.id, mapId, revealedCells: allCells },
      update: { revealedCells: allCells },
    })

    return newlyRevealed
  } else if (storageLevel.type === 'adventure') {
    const state = await prisma.adventureMapState.findUnique({
      where: { adventureId_mapId: { adventureId: storageLevel.id, mapId } },
    })

    const currentRevealed = state ? (state.revealedCells as CellCoord[]) : []
    const newlyRevealed = allCells.filter(
      (cell) => !currentRevealed.some((existing) => cellsEqual(existing, cell))
    )

    await prisma.adventureMapState.upsert({
      where: { adventureId_mapId: { adventureId: storageLevel.id, mapId } },
      create: { adventureId: storageLevel.id, mapId, revealedCells: allCells },
      update: { revealedCells: allCells },
    })

    return newlyRevealed
  } else {
    const state = await prisma.sessionMapState.findUnique({
      where: { sessionId_mapId: { sessionId, mapId } },
    })

    const currentRevealed = state ? (state.revealedCells as CellCoord[]) : []
    const newlyRevealed = allCells.filter(
      (cell) => !currentRevealed.some((existing) => cellsEqual(existing, cell))
    )

    await prisma.sessionMapState.upsert({
      where: { sessionId_mapId: { sessionId, mapId } },
      create: { sessionId, mapId, revealedCells: allCells },
      update: { revealedCells: allCells },
    })

    return newlyRevealed
  }
}

// Hide all cells on a map (reset fog to fully hidden)
export async function hideAll(
  prisma: PrismaClient,
  sessionId: string,
  mapId: string
): Promise<void> {
  const storageLevel = await getFogStorageLevel(prisma, mapId)

  if (storageLevel.type === 'campaign') {
    await prisma.campaignMapState.upsert({
      where: { campaignId_mapId: { campaignId: storageLevel.id, mapId } },
      create: { campaignId: storageLevel.id, mapId, revealedCells: [] },
      update: { revealedCells: [] },
    })
  } else if (storageLevel.type === 'adventure') {
    await prisma.adventureMapState.upsert({
      where: { adventureId_mapId: { adventureId: storageLevel.id, mapId } },
      create: { adventureId: storageLevel.id, mapId, revealedCells: [] },
      update: { revealedCells: [] },
    })
  } else {
    await prisma.sessionMapState.upsert({
      where: { sessionId_mapId: { sessionId, mapId } },
      create: { sessionId, mapId, revealedCells: [] },
      update: { revealedCells: [] },
    })
  }
}
