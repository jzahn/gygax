import * as React from 'react'
import { cn } from '@/lib/utils'

interface FocalPointPickerProps {
  imageUrl: string
  focusX: number
  focusY: number
  onChange: (focusX: number, focusY: number) => void
  className?: string
}

export function FocalPointPicker({
  imageUrl,
  focusX,
  focusY,
  onChange,
  className,
}: FocalPointPickerProps) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = React.useState(false)

  const updateFocalPoint = React.useCallback(
    (clientX: number, clientY: number) => {
      if (!containerRef.current) return

      const rect = containerRef.current.getBoundingClientRect()
      const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100))
      const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100))

      onChange(Math.round(x * 10) / 10, Math.round(y * 10) / 10)
    },
    [onChange]
  )

  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsDragging(true)
    updateFocalPoint(e.clientX, e.clientY)
  }

  const handleMouseMove = React.useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return
      updateFocalPoint(e.clientX, e.clientY)
    },
    [isDragging, updateFocalPoint]
  )

  const handleMouseUp = React.useCallback(() => {
    setIsDragging(false)
  }, [])

  React.useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  return (
    <div className={cn('space-y-2', className)}>
      <div
        ref={containerRef}
        onMouseDown={handleMouseDown}
        className="relative cursor-crosshair overflow-hidden border-2 border-ink select-none"
      >
        <img
          src={imageUrl}
          alt="Focal point selection"
          className="block w-full"
          draggable={false}
        />
        {/* Crosshair overlay */}
        <div
          className="pointer-events-none absolute"
          style={{
            left: `${focusX}%`,
            top: `${focusY}%`,
            transform: 'translate(-50%, -50%)',
          }}
        >
          {/* Outer ring */}
          <div className="absolute -left-4 -top-4 h-8 w-8 rounded-full border-2 border-parchment-100 shadow-lg" />
          {/* Inner ring */}
          <div className="absolute -left-3 -top-3 h-6 w-6 rounded-full border-2 border-ink" />
          {/* Center dot */}
          <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-candleGlow shadow" />
          {/* Crosshair lines */}
          <div className="absolute -left-6 top-0 h-px w-4 -translate-y-1/2 bg-parchment-100 shadow" />
          <div className="absolute -right-6 top-0 h-px w-4 -translate-y-1/2 bg-parchment-100 shadow" />
          <div className="absolute left-0 -top-6 h-4 w-px -translate-x-1/2 bg-parchment-100 shadow" />
          <div className="absolute left-0 -bottom-6 h-4 w-px -translate-x-1/2 bg-parchment-100 shadow" />
        </div>
      </div>
      <p className="text-center font-body text-xs text-ink-soft">
        Click or drag to set the focal point
      </p>
    </div>
  )
}
