'use client'

import { useState, useEffect, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
}

let _promptEvent: BeforeInstallPromptEvent | null = null

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    _promptEvent = e as BeforeInstallPromptEvent
    window.dispatchEvent(new CustomEvent('pwa:installable'))
  })
  window.addEventListener('appinstalled', () => {
    _promptEvent = null
    window.dispatchEvent(new CustomEvent('pwa:installed'))
  })
}

export function useInstallPrompt() {
  const [canPrompt, setCanPrompt] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    setIsIOS(/iphone|ipad|ipod/i.test(navigator.userAgent))
    if (_promptEvent) setCanPrompt(true)

    const onInstallable = () => setCanPrompt(true)
    const onInstalled = () => setCanPrompt(false)
    window.addEventListener('pwa:installable', onInstallable)
    window.addEventListener('pwa:installed', onInstalled)
    return () => {
      window.removeEventListener('pwa:installable', onInstallable)
      window.removeEventListener('pwa:installed', onInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!_promptEvent) return
    await _promptEvent.prompt()
    _promptEvent = null
    setCanPrompt(false)
  }, [])

  return { canPrompt, isIOS, promptInstall }
}
