'use client'

import { useEffect } from 'react'

export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker
      .register('/sw.js', { scope: '/' })
      .then((registration) => {
        console.log(
          'Cheki service worker registered:',
          registration.scope
        )
      })
      .catch((error) => {
        console.error(
          'Cheki service worker registration failed:',
          error
        )
      })
  }, [])

  return null
}
