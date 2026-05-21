'use client'

import { useState, useEffect, useRef, useCallback } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
}

export function useInstallPrompt() {
  const [isInstallable, setIsInstallable] = useState(false)
  const promptRef = useRef<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault()
      promptRef.current = e as BeforeInstallPromptEvent
      setIsInstallable(true)
    }

    const onInstalled = () => {
      promptRef.current = null
      setIsInstallable(false)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstall)
    window.addEventListener('appinstalled', onInstalled)

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstall)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  const promptInstall = useCallback(async () => {
    if (!promptRef.current) return
    await promptRef.current.prompt()
    promptRef.current = null
    setIsInstallable(false)
  }, [])

  return { isInstallable, promptInstall }
}
