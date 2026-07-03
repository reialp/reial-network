'use client'

import { useRef, useEffect, useState } from 'react'

interface WatchPlayerProps {
  embedUrl: string
  title: string
}

export default function WatchPlayer({ embedUrl, title }: WatchPlayerProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState(false)

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

  const handleLoad = () => {
    setIsLoading(false)
  }

  const handleError = () => {
    setIsLoading(false)
    setError(true)
  }

  return (
    <div className="relative w-full aspect-video bg-[#0a0a0a] rounded-lg sm:rounded-xl overflow-hidden border border-white/5">
      {/* Loading state */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a1a] z-10">
          <div className="text-center">
            <div className="w-8 h-8 sm:w-10 sm:h-10 border-3 sm:border-4 border-[#f5c518] border-t-transparent rounded-full animate-spin mx-auto mb-2 sm:mb-3" />
            <p className="text-gray-400 text-xs sm:text-sm">Loading video...</p>
          </div>
        </div>
      )}

      {/* Error state */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-[#1a1a1a] z-10">
          <div className="text-center px-4">
            <div className="text-4xl sm:text-5xl mb-2 sm:mb-3">⚠️</div>
            <p className="text-gray-400 text-sm sm:text-base">Failed to load video</p>
            <p className="text-gray-500 text-xs sm:text-sm mt-1">Please try refreshing the page</p>
          </div>
        </div>
      )}

      <iframe
        src={embedUrl}
        className="w-full h-full"
        allowFullScreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        sandbox="allow-scripts allow-same-origin allow-presentation allow-forms"
        title={title}
        onLoad={handleLoad}
        onError={handleError}
      />
    </div>
  )
}
