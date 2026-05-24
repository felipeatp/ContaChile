'use client'

import { useState, useEffect } from 'react'
import { Download } from 'lucide-react'
import { useInstallPrompt } from '@/lib/use-install-prompt'

export function InstallBanner() {
  const { canPrompt, isIOS, promptInstall } = useInstallPrompt()
  const [showable, setShowable] = useState(false)

  useEffect(() => {
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true
    if (!standalone) setShowable(true)
  }, [])

  if (!showable) return null

  if (isIOS) {
    return (
      <div className="w-full border-b border-border bg-secondary/50 px-4 py-2.5 text-center">
        <p className="text-xs text-muted-foreground">
          Instala ContAI: toca <strong>Compartir</strong> (□↑) → <strong>"Agregar a pantalla de inicio"</strong>
        </p>
      </div>
    )
  }

  return (
    <div className="w-full border-b border-border bg-secondary/50 px-4 py-2 flex items-center justify-between gap-3">
      <p className="text-xs text-muted-foreground">
        {canPrompt
          ? 'Instala ContAI como app en tu dispositivo'
          : 'Toca el ícono ⊕ en la barra del browser para instalar'}
      </p>
      {canPrompt && (
        <button
          onClick={promptInstall}
          className="flex items-center gap-1.5 text-xs font-medium text-foreground bg-paper border border-border rounded-full px-3 py-1 hover:bg-secondary transition-colors shrink-0"
        >
          <Download className="h-3 w-3" />
          Instalar
        </button>
      )}
    </div>
  )
}
