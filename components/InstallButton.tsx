'use client'

import { useEffect, useState } from 'react'

export default function InstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)
  const [showButton, setShowButton] = useState(false)
  const [isInstalled, setIsInstalled] = useState(false)

  useEffect(() => {
    // Check if the app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true)
      return
    }

    // Listen for the install prompt
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e)
      setShowButton(true)
    }

    window.addEventListener('beforeinstallprompt', handler)

    // Check if the app was installed
    const installedHandler = () => {
      setIsInstalled(true)
      setShowButton(false)
    }

    window.addEventListener('appinstalled', installedHandler)

    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installedHandler)
    }
  }, [])

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt()
      const result = await deferredPrompt.userChoice
      if (result.outcome === 'accepted') {
        setShowButton(false)
        setIsInstalled(true)
      }
      setDeferredPrompt(null)
    }
  }

  // Don't show if already installed
  if (isInstalled) return null

  // Don't show if not available
  if (!showButton) return null

  return (
    <div className="fixed bottom-6 left-4 right-4 z-50 flex justify-center">
      <button
        onClick={handleInstall}
        className="bg-[#f5c518] text-black px-6 py-3 rounded-full font-semibold shadow-2xl shadow-[#f5c518]/30 hover:scale-105 transition-all duration-300 flex items-center gap-2"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Install Cheki App
      </button>
    </div>
  )
}
