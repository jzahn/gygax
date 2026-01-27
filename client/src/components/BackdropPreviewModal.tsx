import * as React from 'react'
import type { Backdrop } from '@gygax/shared'
import { Dialog, DialogContent } from './ui/dialog'

interface BackdropPreviewModalProps {
  open: boolean
  onClose: () => void
  backdrop: Backdrop | null
}

function BackdropPreviewContent({
  backdrop,
  onClose,
}: {
  backdrop: Backdrop
  onClose: () => void
}) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const imgRef = React.useRef<HTMLImageElement>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [offset, setOffset] = React.useState({ x: 0, y: 0 })
  const dragRef = React.useRef({ startX: 0, startY: 0, startOffsetX: 0, startOffsetY: 0 })
  const [fitMode, setFitMode] = React.useState(false)
  const [naturalSize, setNaturalSize] = React.useState<{ w: number; h: number } | null>(null)
  const [containerSize, setContainerSize] = React.useState<{ w: number; h: number }>({ w: 0, h: 0 })

  // Track container size
  React.useEffect(() => {
    if (!containerRef.current) return
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry) {
        setContainerSize({ w: entry.contentRect.width, h: entry.contentRect.height })
      }
    })
    observer.observe(containerRef.current)
    return () => observer.disconnect()
  }, [])

  const captureNaturalSize = React.useCallback(() => {
    const img = imgRef.current
    if (img && img.naturalWidth > 0) {
      setNaturalSize((prev) => {
        if (prev && prev.w === img.naturalWidth && prev.h === img.naturalHeight) return prev
        return { w: img.naturalWidth, h: img.naturalHeight }
      })
    }
  }, [])

  // Check for cached image on mount
  React.useEffect(() => {
    captureNaturalSize()
  }, [captureNaturalSize])

  // Cover layout: image sized to fill container, focal point determines initial offset
  const coverLayout = React.useMemo(() => {
    if (!naturalSize || containerSize.w === 0 || containerSize.h === 0) return null

    const cw = containerSize.w
    const ch = containerSize.h
    const imageAspect = naturalSize.w / naturalSize.h
    const containerAspect = cw / ch

    let imgW: number
    let imgH: number

    if (imageAspect > containerAspect) {
      imgH = ch
      imgW = ch * imageAspect
    } else {
      imgW = cw
      imgH = cw / imageAspect
    }

    const overflowX = imgW - cw
    const overflowY = imgH - ch
    const focalX = backdrop.focusX / 100
    const focalY = backdrop.focusY / 100
    const baseX = Math.max(-overflowX, Math.min(0, -(overflowX * focalX)))
    const baseY = Math.max(-overflowY, Math.min(0, -(overflowY * focalY)))

    return { imgW, imgH, baseX, baseY }
  }, [naturalSize, containerSize, backdrop.focusX, backdrop.focusY])

  // Contain layout: image fits entirely inside container
  const containLayout = React.useMemo(() => {
    if (!naturalSize || containerSize.w === 0 || containerSize.h === 0) return null

    const cw = containerSize.w
    const ch = containerSize.h
    const imageAspect = naturalSize.w / naturalSize.h
    const containerAspect = cw / ch

    let fw: number
    let fh: number

    if (imageAspect > containerAspect) {
      fw = cw
      fh = cw / imageAspect
    } else {
      fh = ch
      fw = ch * imageAspect
    }

    return { fw, fh, originX: (cw - fw) / 2, originY: (ch - fh) / 2 }
  }, [naturalSize, containerSize])

  // Clamp drag offset
  const clampOffset = React.useCallback(
    (ox: number, oy: number) => {
      if (!coverLayout) return { x: ox, y: oy }
      const cw = containerSize.w
      const ch = containerSize.h
      const minX = -(coverLayout.imgW - cw) - coverLayout.baseX
      const maxX = -coverLayout.baseX
      const minY = -(coverLayout.imgH - ch) - coverLayout.baseY
      const maxY = -coverLayout.baseY
      return {
        x: Math.max(minX, Math.min(maxX, ox)),
        y: Math.max(minY, Math.min(maxY, oy)),
      }
    },
    [coverLayout, containerSize]
  )

  const startDrag = (clientX: number, clientY: number) => {
    if (fitMode) return
    setIsDragging(true)
    dragRef.current = {
      startX: clientX,
      startY: clientY,
      startOffsetX: offset.x,
      startOffsetY: offset.y,
    }
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return
    e.preventDefault()
    startDrag(e.clientX, e.clientY)
  }

  const handleTouchStart = (e: React.TouchEvent) => {
    if (fitMode) return
    if ((e.target as HTMLElement).closest('button')) return
    const touch = e.touches[0]
    startDrag(touch.clientX, touch.clientY)
  }

  React.useEffect(() => {
    if (!isDragging) return

    const handleMouseMove = (e: MouseEvent) => {
      const dx = e.clientX - dragRef.current.startX
      const dy = e.clientY - dragRef.current.startY
      setOffset(clampOffset(dragRef.current.startOffsetX + dx, dragRef.current.startOffsetY + dy))
    }

    const handleMouseUp = () => setIsDragging(false)

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault()
      const touch = e.touches[0]
      const dx = touch.clientX - dragRef.current.startX
      const dy = touch.clientY - dragRef.current.startY
      setOffset(clampOffset(dragRef.current.startOffsetX + dx, dragRef.current.startOffsetY + dy))
    }

    const handleTouchEnd = () => setIsDragging(false)

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchmove', handleTouchMove, { passive: false })
    window.addEventListener('touchend', handleTouchEnd)
    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleTouchMove)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [isDragging, clampOffset])

  const handleToggleFit = () => {
    if (fitMode) {
      setOffset({ x: 0, y: 0 })
    }
    setFitMode((prev) => !prev)
  }

  // Image styles based on mode
  let imgStyle: React.CSSProperties
  if (fitMode && containLayout) {
    imgStyle = {
      position: 'absolute',
      left: containLayout.originX,
      top: containLayout.originY,
      width: containLayout.fw,
      height: containLayout.fh,
    }
  } else if (!fitMode && coverLayout) {
    const imgLeft = coverLayout.baseX + offset.x
    const imgTop = coverLayout.baseY + offset.y
    imgStyle = {
      position: 'absolute',
      left: 0,
      top: 0,
      width: coverLayout.imgW,
      height: coverLayout.imgH,
      transform: `translate(${imgLeft}px, ${imgTop}px)`,
    }
  } else {
    // Fallback before layout computed
    imgStyle = {
      position: 'absolute',
      left: 0,
      top: 0,
      width: '100%',
      height: '100%',
      objectFit: 'cover' as const,
      objectPosition: `${backdrop.focusX}% ${backdrop.focusY}%`,
    }
  }

  // Title position
  let titleEl: React.ReactNode = null
  if (backdrop.title) {
    let titlePxX = 0
    let titlePxY = 0
    let refWidth = 0

    if (fitMode && containLayout) {
      titlePxX = containLayout.originX + (backdrop.titleX / 100) * containLayout.fw
      titlePxY = containLayout.originY + (backdrop.titleY / 100) * containLayout.fh
      refWidth = containLayout.fw
    } else if (!fitMode && coverLayout) {
      const imgLeft = coverLayout.baseX + offset.x
      const imgTop = coverLayout.baseY + offset.y
      titlePxX = imgLeft + (backdrop.titleX / 100) * coverLayout.imgW
      titlePxY = imgTop + (backdrop.titleY / 100) * coverLayout.imgH
      refWidth = coverLayout.imgW
    }

    if (refWidth > 0) {
      const fontSize = Math.max(16, Math.min(48, refWidth * 0.036))
      titleEl = (
        <div
          className="absolute pointer-events-none font-display uppercase tracking-wide text-parchment-100 text-center"
          style={{
            left: titlePxX,
            top: titlePxY,
            transform: 'translate(-50%, -50%)',
            fontSize,
            maxWidth: refWidth * 0.9,
            padding: `${fontSize * 0.3}px ${fontSize * 0.6}px`,
            backgroundColor: 'rgba(0,0,0,0.7)',
            textShadow: '0 0 6px rgba(0,0,0,1), 2px 3px 8px rgba(0,0,0,1)',
          }}
        >
          {backdrop.title}
        </div>
      )
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative select-none overflow-hidden"
      style={{
        height: '80vh',
        cursor: fitMode ? 'default' : isDragging ? 'grabbing' : 'grab',
      }}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
    >
      <img
        ref={imgRef}
        src={backdrop.imageUrl}
        alt={backdrop.name}
        onLoad={captureNaturalSize}
        draggable={false}
        style={imgStyle}
      />
      {titleEl}
      {/* Toolbar buttons */}
      <div className="absolute right-2 top-2 z-10 flex gap-1">
        <button
          onClick={handleToggleFit}
          className="flex h-8 w-8 items-center justify-center bg-ink/70 text-parchment-100 hover:bg-ink/90 cursor-pointer"
          title={fitMode ? 'Zoom to fill' : 'Fit whole image'}
        >
          {fitMode ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="7" cy="7" r="5" />
              <line x1="11" y1="11" x2="15" y2="15" />
              <line x1="5" y1="7" x2="9" y2="7" />
              <line x1="7" y1="5" x2="7" y2="9" />
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="1,5 1,1 5,1" />
              <polyline points="11,1 15,1 15,5" />
              <polyline points="15,11 15,15 11,15" />
              <polyline points="5,15 1,15 1,11" />
            </svg>
          )}
        </button>
        <button
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center bg-ink/70 font-body text-lg text-parchment-100 hover:bg-ink/90 cursor-pointer"
        >
          &#10005;
        </button>
      </div>
    </div>
  )
}

export function BackdropPreviewModal({ open, onClose, backdrop }: BackdropPreviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="max-w-5xl border-3 border-ink bg-ink p-0 overflow-hidden">
        {backdrop && <BackdropPreviewContent backdrop={backdrop} onClose={onClose} />}
      </DialogContent>
    </Dialog>
  )
}
