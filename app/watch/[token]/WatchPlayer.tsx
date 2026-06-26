'use client'

import { useRef, useEffect } from 'react'

interface WatchPlayerProps {
  embedUrl: string
  title: string
}

export default function WatchPlayer({ embedUrl, title }: WatchPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault()
    }

    container.addEventListener('contextmenu', handleContextMenu)

    return () => {
      container.removeEventListener('contextmenu', handleContextMenu)
    }
  }, [])

  return (
    <div ref={containerRef} className="relative aspect-video bg-[#1a1a1a] rounded-xl overflow-hidden">
      <iframe
        src={embedUrl}
        className="w-full h-full"
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
        title={title}
      />
    </div>
  )
}