import * as React from 'react'
import type { Map, GridType, MapContent } from '@gygax/shared'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from './ui/dialog'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { Label } from './ui/label'
import { Textarea } from './ui/textarea'
import { readMapExportFile, ImportedMapData } from '../utils/mapExport'

export interface MapFormData {
  name: string
  description: string
  gridType: GridType
  width: number
  height: number
  content?: MapContent | null
}

interface CreateMapModalProps {
  open: boolean
  onClose: () => void
  onSubmit: (data: MapFormData) => Promise<void>
  map?: Map | null
}

const MAX_NAME_LENGTH = 100
const MAX_DESCRIPTION_LENGTH = 1000
const MIN_DIMENSION = 5
const MAX_DIMENSION = 100
const DEFAULT_DIMENSION = 30

export function CreateMapModal({ open, onClose, onSubmit, map }: CreateMapModalProps) {
  const [name, setName] = React.useState('')
  const [description, setDescription] = React.useState('')
  const [gridType, setGridType] = React.useState<GridType>('SQUARE')
  const [width, setWidth] = React.useState(DEFAULT_DIMENSION)
  const [height, setHeight] = React.useState(DEFAULT_DIMENSION)
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [errors, setErrors] = React.useState<{
    name?: string
    description?: string
    width?: string
    height?: string
  }>({})

  // Import state
  const [importedData, setImportedData] = React.useState<ImportedMapData | null>(null)
  const [importFileName, setImportFileName] = React.useState<string | null>(null)
  const [importError, setImportError] = React.useState<string | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)

  const isEditing = !!map
  const hasImport = importedData !== null

  React.useEffect(() => {
    if (open) {
      if (map) {
        setName(map.name)
        setDescription(map.description || '')
        setGridType(map.gridType)
        setWidth(map.width)
        setHeight(map.height)
      } else {
        setName('')
        setDescription('')
        setGridType('SQUARE')
        setWidth(DEFAULT_DIMENSION)
        setHeight(DEFAULT_DIMENSION)
      }
      setErrors({})
      setImportedData(null)
      setImportFileName(null)
      setImportError(null)
    }
  }, [open, map])

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setImportError(null)
    const result = await readMapExportFile(file)

    if (!result.success) {
      setImportError(result.error)
      setImportedData(null)
      setImportFileName(null)
      // Reset file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
      return
    }

    // Pre-fill form with imported data
    setImportedData(result.data)
    setImportFileName(file.name)
    setName(result.data.name)
    setDescription(result.data.description || '')
    setGridType(result.data.gridType)
    setWidth(result.data.width)
    setHeight(result.data.height)
    setErrors({})
  }

  const handleClearImport = () => {
    setImportedData(null)
    setImportFileName(null)
    setImportError(null)
    setName('')
    setDescription('')
    setGridType('SQUARE')
    setWidth(DEFAULT_DIMENSION)
    setHeight(DEFAULT_DIMENSION)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const validateForm = (): boolean => {
    const newErrors: typeof errors = {}

    const trimmedName = name.trim()
    if (!trimmedName) {
      newErrors.name = 'Name is required'
    } else if (trimmedName.length > MAX_NAME_LENGTH) {
      newErrors.name = `Name must be ${MAX_NAME_LENGTH} characters or less`
    }

    const trimmedDescription = description.trim()
    if (trimmedDescription.length > MAX_DESCRIPTION_LENGTH) {
      newErrors.description = `Description must be ${MAX_DESCRIPTION_LENGTH} characters or less`
    }

    if (width < MIN_DIMENSION || width > MAX_DIMENSION) {
      newErrors.width = `Width must be between ${MIN_DIMENSION} and ${MAX_DIMENSION}`
    }

    if (height < MIN_DIMENSION || height > MAX_DIMENSION) {
      newErrors.height = `Height must be between ${MIN_DIMENSION} and ${MAX_DIMENSION}`
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!validateForm()) {
      return
    }

    setIsSubmitting(true)
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim(),
        gridType,
        width,
        height,
        content: importedData?.content,
      })
      onClose()
    } catch {
      // Error handling done in parent
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleWidthChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    if (!isNaN(value)) {
      setWidth(Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, value)))
    }
  }

  const handleHeightChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseInt(e.target.value, 10)
    if (!isNaN(value)) {
      setHeight(Math.max(MIN_DIMENSION, Math.min(MAX_DIMENSION, value)))
    }
  }

  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Edit Map' : 'Chart New Territory'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Import section - only show when creating */}
          {!isEditing && (
            <>
              <div className="space-y-2">
                <Label className="font-display text-xs uppercase tracking-wide">
                  Import from File <span className="font-body text-ink-faded">(optional)</span>
                </Label>
                <div className="flex items-center gap-2">
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json,.gygax.json"
                    onChange={handleFileChange}
                    className="hidden"
                    id="mapFileImport"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    Choose File
                  </Button>
                  <span className="font-body text-sm text-ink-soft">
                    {importFileName || 'No file selected'}
                  </span>
                  {hasImport && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleClearImport}
                      className="ml-auto text-ink-soft hover:text-ink"
                    >
                      Clear
                    </Button>
                  )}
                </div>
                {importError && (
                  <p className="font-body text-sm text-blood-red">{importError}</p>
                )}
                <p className="font-body text-xs text-ink-faded">
                  Import a .gygax.json file to pre-fill the form
                </p>
              </div>

              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-ink-faded" />
                <span className="font-body text-xs text-ink-faded">or</span>
                <div className="h-px flex-1 bg-ink-faded" />
              </div>
            </>
          )}

          <div className="space-y-2">
            <Label htmlFor="mapName" className="font-display text-xs uppercase tracking-wide">
              Map Name
            </Label>
            <Input
              id="mapName"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="What shall this realm be called?"
              error={!!errors.name}
              maxLength={MAX_NAME_LENGTH + 10}
            />
            {errors.name && <p className="font-body text-sm text-blood-red">{errors.name}</p>}
          </div>

          <div className="space-y-2">
            <Label htmlFor="mapDescription" className="font-display text-xs uppercase tracking-wide">
              Description <span className="font-body text-ink-faded">(optional)</span>
            </Label>
            <Textarea
              id="mapDescription"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the nature of this territory..."
              rows={3}
              error={!!errors.description}
              maxLength={MAX_DESCRIPTION_LENGTH + 10}
            />
            {errors.description && (
              <p className="font-body text-sm text-blood-red">{errors.description}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label className="font-display text-xs uppercase tracking-wide">
              Grid Type
              {(isEditing || hasImport) && (
                <span className="font-body text-ink-faded"> (cannot be changed)</span>
              )}
            </Label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => !isEditing && !hasImport && setGridType('SQUARE')}
                disabled={isEditing || hasImport}
                className={`flex flex-col items-center gap-1 rounded border-2 p-3 transition-colors ${
                  gridType === 'SQUARE'
                    ? 'border-ink bg-parchment-200'
                    : 'border-ink-soft bg-parchment-100 hover:border-ink'
                } ${isEditing || hasImport ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <SquareGridIcon className="h-8 w-8" />
                <span className="font-display text-xs uppercase tracking-wide">Square</span>
                <span className="font-body text-xs text-ink-soft">Indoor/Dungeon</span>
              </button>
              <button
                type="button"
                onClick={() => !isEditing && !hasImport && setGridType('HEX')}
                disabled={isEditing || hasImport}
                className={`flex flex-col items-center gap-1 rounded border-2 p-3 transition-colors ${
                  gridType === 'HEX'
                    ? 'border-ink bg-parchment-200'
                    : 'border-ink-soft bg-parchment-100 hover:border-ink'
                } ${isEditing || hasImport ? 'cursor-not-allowed opacity-60' : ''}`}
              >
                <HexGridIcon className="h-8 w-8" />
                <span className="font-display text-xs uppercase tracking-wide">Hex</span>
                <span className="font-body text-xs text-ink-soft">Outdoor/Wilderness</span>
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label className="font-display text-xs uppercase tracking-wide">Dimensions</Label>
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Label htmlFor="mapWidth" className="font-body text-xs text-ink-soft">
                  Width
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="mapWidth"
                    type="number"
                    value={width}
                    onChange={handleWidthChange}
                    min={MIN_DIMENSION}
                    max={MAX_DIMENSION}
                    error={!!errors.width}
                    className="w-20"
                  />
                  <span className="font-body text-sm text-ink-soft">cells</span>
                </div>
              </div>
              <div className="flex-1">
                <Label htmlFor="mapHeight" className="font-body text-xs text-ink-soft">
                  Height
                </Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="mapHeight"
                    type="number"
                    value={height}
                    onChange={handleHeightChange}
                    min={MIN_DIMENSION}
                    max={MAX_DIMENSION}
                    error={!!errors.height}
                    className="w-20"
                  />
                  <span className="font-body text-sm text-ink-soft">cells</span>
                </div>
              </div>
            </div>
            {(errors.width || errors.height) && (
              <p className="font-body text-sm text-blood-red">{errors.width || errors.height}</p>
            )}
            <p className="font-body text-xs text-ink-faded">
              Range: {MIN_DIMENSION}-{MAX_DIMENSION} cells
            </p>
          </div>

          <DialogFooter className="pt-4">
            <div className="flex w-full justify-end gap-2">
              <Button type="button" variant="ghost" onClick={onClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" loading={isSubmitting}>
                {isEditing ? 'Save' : 'Create'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function SquareGridIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} stroke="currentColor" strokeWidth="1.5" fill="none">
      <rect x="2" y="2" width="28" height="28" />
      <line x1="2" y1="11" x2="30" y2="11" />
      <line x1="2" y1="21" x2="30" y2="21" />
      <line x1="11" y1="2" x2="11" y2="30" />
      <line x1="21" y1="2" x2="21" y2="30" />
    </svg>
  )
}

function HexGridIcon({ className }: { className?: string }) {
  // Flat-top hexagon icon
  return (
    <svg viewBox="0 0 32 32" className={className} stroke="currentColor" strokeWidth="1.5" fill="none">
      {/* Center flat-top hex */}
      <polygon points="26,16 21,25 11,25 6,16 11,7 21,7" />
    </svg>
  )
}
