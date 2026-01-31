import { useState, useCallback, useRef, useEffect } from 'react'

interface UsePanelDragOptions {
  minHeight?: number // Minimum height as percentage of viewport
  maxHeight?: number // Maximum height as percentage of viewport
  collapsedHeight?: number // Collapsed height in pixels
  defaultExpanded?: boolean
}

interface UsePanelDragReturn {
  isExpanded: boolean
  panelHeight: number // Current height in pixels
  isDragging: boolean
  handlers: {
    onTouchStart: (e: React.TouchEvent) => void
    onTouchMove: (e: React.TouchEvent) => void
    onTouchEnd: () => void
    onMouseDown: (e: React.MouseEvent) => void
  }
  expand: () => void
  collapse: () => void
  toggle: () => void
}

export function usePanelDrag({
  minHeight = 40,
  maxHeight = 70,
  collapsedHeight = 44,
  defaultExpanded = false,
}: UsePanelDragOptions = {}): UsePanelDragReturn {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded)
  const [panelHeight, setPanelHeight] = useState(
    defaultExpanded ? window.innerHeight * (minHeight / 100) : collapsedHeight
  )
  const [isDragging, setIsDragging] = useState(false)

  const startYRef = useRef(0)
  const startHeightRef = useRef(0)

  // Calculate min/max in pixels
  const getMinMaxPx = useCallback(() => {
    const vh = window.innerHeight
    return {
      min: vh * (minHeight / 100),
      max: vh * (maxHeight / 100),
    }
  }, [minHeight, maxHeight])

  // Handle touch drag
  const onTouchStart = useCallback(
    (e: React.TouchEvent) => {
      setIsDragging(true)
      startYRef.current = e.touches[0].clientY
      startHeightRef.current = panelHeight
    },
    [panelHeight]
  )

  const onTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!isDragging) return

      const deltaY = startYRef.current - e.touches[0].clientY
      const { min, max } = getMinMaxPx()
      const newHeight = Math.max(collapsedHeight, Math.min(max, startHeightRef.current + deltaY))

      setPanelHeight(newHeight)

      // If dragged past minimum expanded height, consider it expanded
      if (newHeight >= min) {
        setIsExpanded(true)
      } else if (newHeight <= collapsedHeight + 20) {
        setIsExpanded(false)
      }
    },
    [isDragging, getMinMaxPx, collapsedHeight]
  )

  const onTouchEnd = useCallback(() => {
    setIsDragging(false)

    const { min } = getMinMaxPx()

    // Snap to expanded or collapsed
    if (panelHeight > collapsedHeight + (min - collapsedHeight) / 2) {
      // Expand to default height
      setPanelHeight(min)
      setIsExpanded(true)
    } else {
      // Collapse
      setPanelHeight(collapsedHeight)
      setIsExpanded(false)
    }
  }, [panelHeight, getMinMaxPx, collapsedHeight])

  // Handle mouse drag (for desktop testing)
  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true)
      startYRef.current = e.clientY
      startHeightRef.current = panelHeight

      const onMouseMove = (moveEvent: MouseEvent) => {
        const deltaY = startYRef.current - moveEvent.clientY
        const { min, max } = getMinMaxPx()
        const newHeight = Math.max(collapsedHeight, Math.min(max, startHeightRef.current + deltaY))

        setPanelHeight(newHeight)

        if (newHeight >= min) {
          setIsExpanded(true)
        } else if (newHeight <= collapsedHeight + 20) {
          setIsExpanded(false)
        }
      }

      const onMouseUp = () => {
        setIsDragging(false)
        window.removeEventListener('mousemove', onMouseMove)
        window.removeEventListener('mouseup', onMouseUp)

        const { min } = getMinMaxPx()

        // Snap to expanded or collapsed
        if (panelHeight > collapsedHeight + (min - collapsedHeight) / 2) {
          setPanelHeight(min)
          setIsExpanded(true)
        } else {
          setPanelHeight(collapsedHeight)
          setIsExpanded(false)
        }
      }

      window.addEventListener('mousemove', onMouseMove)
      window.addEventListener('mouseup', onMouseUp)
    },
    [panelHeight, getMinMaxPx, collapsedHeight]
  )

  const expand = useCallback(() => {
    const { min } = getMinMaxPx()
    setPanelHeight(min)
    setIsExpanded(true)
  }, [getMinMaxPx])

  const collapse = useCallback(() => {
    setPanelHeight(collapsedHeight)
    setIsExpanded(false)
  }, [collapsedHeight])

  const toggle = useCallback(() => {
    if (isExpanded) {
      collapse()
    } else {
      expand()
    }
  }, [isExpanded, expand, collapse])

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      if (isExpanded) {
        const { min, max } = getMinMaxPx()
        setPanelHeight(Math.max(min, Math.min(max, panelHeight)))
      }
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [isExpanded, panelHeight, getMinMaxPx])

  return {
    isExpanded,
    panelHeight,
    isDragging,
    handlers: {
      onTouchStart,
      onTouchMove,
      onTouchEnd,
      onMouseDown,
    },
    expand,
    collapse,
    toggle,
  }
}
