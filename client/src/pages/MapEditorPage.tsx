import * as React from 'react'
import { useParams, useNavigate, Link } from 'react-router'
import type { Map, MapResponse, MapContent } from '@gygax/shared'
import { Button } from '../components/ui'
import { MapCanvas } from '../components/MapCanvas'
import { MapToolbar } from '../components/MapToolbar'
import { CreateMapModal, MapFormData } from '../components/CreateMapModal'
import { DeleteMapDialog } from '../components/DeleteMapDialog'
import { useMapDrawing, SaveStatus } from '../hooks/useMapDrawing'
import { preloadTerrainImages } from '../utils/terrainIcons'
import { exportMap } from '../utils/mapExport'

const API_URL = import.meta.env.VITE_API_URL || ''

function SaveStatusIndicator({ status }: { status: SaveStatus }) {
  if (status === 'idle') return null

  return (
    <span
      className={`font-body text-xs ${
        status === 'error' ? 'text-blood-red' : 'text-ink-soft'
      }`}
    >
      {status === 'saving' && 'Saving...'}
      {status === 'saved' && 'Saved'}
      {status === 'error' && 'Save failed'}
    </span>
  )
}

export function MapEditorPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [map, setMap] = React.useState<Map | null>(null)
  const [isLoading, setIsLoading] = React.useState(true)
  const [error, setError] = React.useState<string | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = React.useState(false)
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = React.useState(false)
  const [menuOpen, setMenuOpen] = React.useState(false)
  const [showTerrainColors, setShowTerrainColors] = React.useState(false)
  const menuRef = React.useRef<HTMLDivElement>(null)

  // Save content to API
  const handleSaveContent = React.useCallback(
    async (content: MapContent) => {
      if (!map) {
        console.warn('Cannot save: map not loaded yet')
        throw new Error('Map not loaded')
      }

      const response = await fetch(`${API_URL}/api/maps/${map.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ content }),
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        console.error('Save failed:', response.status, errorData)
        throw new Error(errorData.message || 'Failed to save map content')
      }
    },
    [map]
  )

  // Initialize drawing hook
  const drawing = useMapDrawing({
    initialContent: map?.content ?? null,
    onSave: handleSaveContent,
    gridType: map?.gridType ?? 'SQUARE',
    mapWidth: map?.width ?? 30,
    mapHeight: map?.height ?? 30,
  })

  // Close menu when clicking outside
  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false)
      }
    }

    if (menuOpen) {
      document.addEventListener('mousedown', handleClickOutside)
      return () => document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [menuOpen])

  const fetchMap = React.useCallback(async () => {
    if (!id) return

    try {
      const response = await fetch(`${API_URL}/api/maps/${id}`, {
        credentials: 'include',
      })

      if (response.status === 404) {
        setError('Map not found')
        return
      }

      if (response.status === 403) {
        setError('You do not have access to this map')
        return
      }

      if (!response.ok) {
        throw new Error('Failed to fetch map')
      }

      const data: MapResponse = await response.json()
      setMap(data.map)
    } catch {
      setError('Failed to load map')
    } finally {
      setIsLoading(false)
    }
  }, [id])

  React.useEffect(() => {
    fetchMap()
  }, [fetchMap])

  // Preload terrain images
  React.useEffect(() => {
    preloadTerrainImages()
  }, [])

  const handleEditMap = async (data: MapFormData) => {
    if (!map) return

    const response = await fetch(`${API_URL}/api/maps/${map.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({
        name: data.name,
        description: data.description || null,
        width: data.width,
        height: data.height,
      }),
    })

    if (!response.ok) {
      throw new Error('Failed to update map')
    }

    const result: MapResponse = await response.json()
    setMap(result.map)
    setIsEditModalOpen(false)
  }

  const handleDeleteMap = async () => {
    if (!map) return

    const response = await fetch(`${API_URL}/api/maps/${map.id}`, {
      method: 'DELETE',
      credentials: 'include',
    })

    if (!response.ok) {
      throw new Error('Failed to delete map')
    }

    navigate(`/adventures/${map.adventureId}`)
  }

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-3.5rem)] items-center justify-center">
        <span className="animate-quill-scratch text-4xl">&#9998;</span>
        <span className="ml-4 font-body text-ink-soft">Loading map...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto max-w-2xl p-6 md:p-8">
        <div className="rounded border-3 border-blood-red bg-parchment-100 p-6 text-center">
          <p className="font-body text-blood-red">{error}</p>
          <Button variant="ghost" onClick={() => navigate('/')} className="mt-4">
            Return to Dashboard
          </Button>
        </div>
      </div>
    )
  }

  if (!map) {
    return null
  }

  return (
    <div className="flex h-[calc(100vh-3.5rem)] flex-col">
      {/* Header */}
      <header className="flex items-center justify-between border-b-3 border-ink bg-parchment-100 px-4 py-3">
        <div className="flex items-center gap-4">
          <Link
            to={`/adventures/${map.adventureId}`}
            className="font-body text-sm text-ink-soft hover:text-ink"
          >
            &larr; Back to Adventure
          </Link>
          <div className="h-4 w-px bg-ink-faded" />
          <h1 className="font-display text-lg uppercase tracking-wide text-ink">{map.name}</h1>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" onClick={() => setIsEditModalOpen(true)}>
            Edit
          </Button>
          <div className="relative" ref={menuRef}>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setMenuOpen(!menuOpen)}
              aria-label="Map options"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 16 16"
                fill="currentColor"
                className="rotate-90"
              >
                <circle cx="3" cy="8" r="1.5" />
                <circle cx="8" cy="8" r="1.5" />
                <circle cx="13" cy="8" r="1.5" />
              </svg>
            </Button>

            {menuOpen && (
              <div className="absolute right-0 top-full z-10 mt-1 min-w-[120px] rounded border-2 border-ink bg-parchment-100 py-1 shadow-brutal">
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    exportMap(map)
                  }}
                  className="block w-full px-3 py-1.5 text-left font-body text-sm hover:bg-parchment-200"
                >
                  Export
                </button>
                <button
                  onClick={() => {
                    setMenuOpen(false)
                    setIsDeleteDialogOpen(true)
                  }}
                  className="block w-full px-3 py-1.5 text-left font-body text-sm text-blood-red hover:bg-parchment-200"
                >
                  Delete Map
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Main content - Canvas + Toolbar */}
      <main className="flex flex-1 overflow-hidden">
        <div className="min-w-0 flex-1 p-4">
          <MapCanvas
            map={map}
            className="h-full w-full"
            drawingState={drawing.state}
            onHexClick={drawing.stampTerrain}
            onHexHover={drawing.setHoveredHex}
            // Path callbacks
            onStartPath={drawing.startPath}
            onAddPathPoint={drawing.addPathPoint}
            onFinishPath={drawing.finishPath}
            onSelectPath={drawing.selectPath}
            onDeletePath={drawing.deletePath}
            onUpdatePathVertex={drawing.updatePathVertex}
            onStartDraggingVertex={drawing.startDraggingVertex}
            onStopDraggingVertex={drawing.stopDraggingVertex}
            // Label callbacks
            onCreateLabel={drawing.createLabel}
            onStartEditingLabel={drawing.startEditingLabel}
            onFinishEditingLabel={drawing.finishEditingLabel}
            onCancelEditingLabel={drawing.cancelEditingLabel}
            onSelectLabel={drawing.selectLabel}
            onDeleteLabel={drawing.deleteLabel}
            onUpdateLabelPosition={drawing.updateLabelPosition}
            onStartDraggingLabel={drawing.startDraggingLabel}
            onStopDraggingLabel={drawing.stopDraggingLabel}
            // Wall callbacks (square grid)
            onPaintWall={drawing.paintWall}
            onEraseWall={drawing.eraseWall}
            onHoveredCellChange={drawing.setHoveredCell}
            // Feature callbacks (square grid)
            onPlaceFeature={drawing.placeFeature}
            onSelectFeature={drawing.selectFeature}
            onDeleteFeature={drawing.deleteFeature}
            onUpdateFeaturePosition={drawing.updateFeaturePosition}
            onStartDraggingFeature={drawing.startDraggingFeature}
            onStopDraggingFeature={drawing.stopDraggingFeature}
            // Selection
            onClearSelection={drawing.clearSelection}
            // Display options
            showTerrainColors={showTerrainColors}
          />
        </div>
        <MapToolbar
          tool={drawing.state.tool}
          selectedTerrain={drawing.state.selectedTerrain}
          selectedPathType={drawing.state.selectedPathType}
          selectedLabelSize={drawing.state.selectedLabelSize}
          gridType={map.gridType}
          // Wall props (square grid)
          wallMode={drawing.state.wallMode}
          onWallModeChange={drawing.setWallMode}
          // Feature props (square grid)
          selectedFeatureType={drawing.state.selectedFeatureType}
          onFeatureTypeChange={drawing.setSelectedFeatureType}
          onFeatureRotate={drawing.rotateFeature}
          // Common props
          onToolChange={drawing.setTool}
          onTerrainChange={drawing.setSelectedTerrain}
          onPathTypeChange={drawing.setSelectedPathType}
          onLabelSizeChange={drawing.setSelectedLabelSize}
        />
      </main>

      {/* Footer/Status Bar */}
      <footer className="flex items-center justify-between border-t-3 border-ink bg-parchment-100 px-4 py-2">
        <div className="flex items-center gap-4 font-body text-xs text-ink-soft">
          {map.description && <span>{map.description}</span>}
          <SaveStatusIndicator status={drawing.state.saveStatus} />
        </div>
        <div className="flex items-center gap-4">
          {map.gridType === 'HEX' && (
            <label className="flex cursor-pointer items-center gap-2 font-body text-xs text-ink-soft">
              <span>Color tint</span>
              <button
                type="button"
                role="switch"
                aria-checked={showTerrainColors}
                onClick={() => setShowTerrainColors(!showTerrainColors)}
                className={`relative h-5 w-10 rounded-full border-2 border-ink transition-colors ${
                  showTerrainColors ? 'bg-ink' : 'bg-parchment-200'
                }`}
              >
                <span
                  className={`absolute left-0.5 top-0.5 h-3 w-3 rounded-full border border-ink transition-all ${
                    showTerrainColors ? 'left-[22px] bg-parchment-100' : 'left-0.5 bg-ink-soft'
                  }`}
                />
              </button>
            </label>
          )}
          <div className="font-body text-xs text-ink-soft">
            {map.width}&times;{map.height} &bull; {map.gridType === 'SQUARE' ? 'Square' : 'Hex'} grid
          </div>
        </div>
      </footer>

      {/* Modals */}
      <CreateMapModal
        open={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        onSubmit={handleEditMap}
        map={map}
      />

      <DeleteMapDialog
        open={isDeleteDialogOpen}
        onClose={() => setIsDeleteDialogOpen(false)}
        onConfirm={handleDeleteMap}
        map={map}
      />
    </div>
  )
}
