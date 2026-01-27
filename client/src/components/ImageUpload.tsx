import * as React from 'react'
import { cn } from '@/lib/utils'
import { FocalPointPicker } from './FocalPointPicker'

interface ImageUploadProps {
  value?: File | string | null
  onChange: (file: File | null) => void
  onRemove?: () => void
  focusX?: number
  focusY?: number
  onFocusChange?: (focusX: number, focusY: number) => void
  accept?: string
  maxSize?: number
  error?: string
  className?: string
  /** Compact mode for small avatars - hides focal point picker */
  compact?: boolean
  /** Aspect ratio for the image container (e.g., "1/1", "2/3") */
  aspectRatio?: string
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB

export function ImageUpload({
  value,
  onChange,
  onRemove,
  focusX = 50,
  focusY = 50,
  onFocusChange,
  accept = 'image/jpeg,image/png,image/webp',
  maxSize = MAX_FILE_SIZE,
  error,
  className,
  compact = false,
  aspectRatio,
}: ImageUploadProps) {
  const [isDragging, setIsDragging] = React.useState(false)
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    if (value instanceof File) {
      const url = URL.createObjectURL(value)
      setPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    } else if (typeof value === 'string' && value) {
      setPreviewUrl(value)
    } else {
      setPreviewUrl(null)
    }
  }, [value])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) {
      validateAndSetFile(file)
    }
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      validateAndSetFile(file)
    }
  }

  const validateAndSetFile = (file: File) => {
    const acceptedTypes = accept.split(',').map((t) => t.trim())
    if (!acceptedTypes.includes(file.type)) {
      return
    }
    if (file.size > maxSize) {
      return
    }
    onChange(file)
  }

  const handleRemove = (e: React.MouseEvent) => {
    e.stopPropagation()
    onChange(null)
    onRemove?.()
    if (inputRef.current) {
      inputRef.current.value = ''
    }
  }

  const handleClick = () => {
    inputRef.current?.click()
  }

  // Compact mode for small avatars/portraits
  if (compact) {
    return (
      <div className={cn('group relative', className)}>
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          className={cn(
            'relative cursor-pointer border-3 border-dashed bg-parchment-100 transition-colors',
            isDragging ? 'border-candleGlow bg-parchment-200' : 'border-ink-soft hover:border-ink',
            error && 'border-blood-red',
            !previewUrl && 'flex items-center justify-center'
          )}
          style={aspectRatio && !previewUrl ? { aspectRatio } : undefined}
        >
          {previewUrl ? (
            <>
              <img
                src={previewUrl}
                alt="Avatar"
                className="block w-full"
              />
              {/* Hover overlay with actions */}
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-ink/70 opacity-0 transition-opacity group-hover:opacity-100">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleClick()
                  }}
                  className="font-body text-xs text-parchment-100 underline underline-offset-2"
                >
                  Change
                </button>
                <button
                  type="button"
                  onClick={handleRemove}
                  className="font-body text-xs text-blood-red underline underline-offset-2"
                >
                  Remove
                </button>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center p-4 text-center">
              <div className="text-2xl text-ink-soft">&#128100;</div>
              <p className="font-body text-xs text-ink-soft">Add portrait</p>
            </div>
          )}
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleFileSelect}
            className="hidden"
          />
        </div>
        {error && <p className="mt-1 font-body text-xs text-blood-red">{error}</p>}
      </div>
    )
  }

  // Full mode with focal point picker
  return (
    <div className={cn('space-y-2', className)}>
      <div
        onClick={handleClick}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={cn(
          'relative flex cursor-pointer flex-col items-center justify-center border-3 border-dashed bg-parchment-100 p-4 transition-colors',
          isDragging ? 'border-candleGlow bg-parchment-200' : 'border-ink-soft hover:border-ink',
          error && 'border-blood-red'
        )}
      >
        {previewUrl ? (
          <div className="relative w-full" onClick={(e) => e.stopPropagation()}>
            <FocalPointPicker
              imageUrl={previewUrl}
              focusX={focusX}
              focusY={focusY}
              onChange={onFocusChange ?? (() => {})}
              className="mx-auto max-w-xs"
            />
            <div className="mt-3 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={handleClick}
                className="font-body text-sm text-ink underline underline-offset-2 hover:text-ink-soft"
              >
                Change
              </button>
              <button
                type="button"
                onClick={handleRemove}
                className="font-body text-sm text-blood-red underline underline-offset-2 hover:text-seal-wax"
              >
                Remove
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="mb-2 text-4xl text-ink-soft">&#128220;</div>
            <p className="font-body text-sm text-ink">
              Drag image here or <span className="underline">click to browse</span>
            </p>
            <p className="mt-1 font-body text-xs text-ink-faded">
              400x600px recommended (2:3 ratio, like a module cover)
            </p>
            <p className="font-body text-xs text-ink-faded">JPG, PNG, WebP up to 5MB</p>
          </>
        )}
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleFileSelect}
          className="hidden"
        />
      </div>
      {error && <p className="font-body text-sm text-blood-red">{error}</p>}
    </div>
  )
}
