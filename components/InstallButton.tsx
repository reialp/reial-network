'use client'

import { useEffect, useState } from 'react'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISS_KEY = 'cheki-install-prompt-dismissed'

export default function InstallButton() {
  const [installPrompt, setInstallPrompt] =
    useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [isBrowser, setIsBrowser] = useState(false)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      Boolean(
        (window.navigator as Navigator & { standalone?: boolean }).standalone
      )

    const dismissed = window.localStorage.getItem(DISMISS_KEY) === 'true'
    const userAgent = window.navigator.userAgent.toLowerCase()

    setIsInstalled(standalone)
    setIsDismissed(dismissed)
    setIsIOS(/iphone|ipad|ipod/.test(userAgent))
    setIsBrowser(true)

    const handleBeforeInstallPrompt = (event: Event) => {
      event.preventDefault()
      setInstallPrompt(event as BeforeInstallPromptEvent)
    }

    const handleAppInstalled = () => {
      setIsInstalled(true)
      setInstallPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    window.addEventListener('appinstalled', handleAppInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const closeInstallPrompt = () => {
    window.localStorage.setItem(DISMISS_KEY, 'true')
    setIsDismissed(true)
    setInstallPrompt(null)
  }

  const handleInstall = async () => {
    if (installPrompt) {
      await installPrompt.prompt()
      const result = await installPrompt.userChoice

      if (result.outcome === 'accepted') {
        setIsInstalled(true)
      }

      setInstallPrompt(null)
      return
    }

    if (isIOS) {
      window.alert(
        'To install Cheki on iPhone or iPad, tap the Share button in Safari, then choose “Add to Home Screen”.'
      )
      return
    }

    window.alert(
      'To install Cheki, open your browser menu and choose “Install app” or “Add to Home screen”.'
    )
  }

  if (!isBrowser || isInstalled || isDismissed) return null

  return (
    <div className="fixed bottom-6 left-4 right-4 z-50 flex justify-center">
      <div className="relative flex items-center gap-3 rounded-full bg-[#f5c518] px-5 py-3 text-black shadow-2xl shadow-[#f5c518]/30">
        <button
          type="button"
          onClick={handleInstall}
          className="flex items-center gap-2 pr-6 font-semibold transition-transform duration-300 hover:scale-105"
        >
          <svg
            className="h-5 w-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          Install Cheki App
        </button>

        <button
          type="button"
          onClick={closeInstallPrompt}
          aria-label="Close install prompt"
          title="Close"
          className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-xl leading-none text-black/70 transition-colors hover:bg-black/10 hover:text-black"
        >
          ×
        </button>
      </div>
    </div>
  )
}
