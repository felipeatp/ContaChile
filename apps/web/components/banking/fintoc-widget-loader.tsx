"use client"

import { useEffect, useRef, useState } from "react"

declare global {
  interface Window {
    Fintoc?: {
      create: (options: FintocWidgetOptions) => { open: () => void; close: () => void; destroy: () => void }
    }
  }
}

interface FintocWidgetOptions {
  publicKey: string
  widgetToken?: string
  holderType?: "individual" | "business"
  product?: "movements" | "subscriptions" | "tax_returns" | "payments" | "refresh_intent"
  webhookUrl?: string
  country?: string
  language?: string
  institutionId?: string
  username?: string
  onSuccess?: (payload: {
    link_token?: string
    exchange_token?: string
    institution?: { id: string; name: string }
    accounts?: Array<{ id: string; name: string; type: string; number: string; balance: number; currency: string }>
  }) => void
  onExit?: () => void
  onEvent?: (event: unknown) => void
}

let scriptPromise: Promise<void> | null = null

function loadFintocScript(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve()
  if (window.Fintoc) return Promise.resolve()
  if (scriptPromise) return scriptPromise

  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement("script")
    script.src = "https://js.fintoc.com/v1/"
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error("No se pudo cargar el widget de Fintoc"))
    document.body.appendChild(script)
  })

  return scriptPromise
}

export function useFintocWidget() {
  const [ready, setReady] = useState(false)
  const widgetRef = useRef<{ open: () => void; close: () => void; destroy: () => void } | null>(null)

  useEffect(() => {
    loadFintocScript().then(() => setReady(true))
  }, [])

  const open = (options: FintocWidgetOptions) => {
    if (!window.Fintoc) {
      console.error("Fintoc no está cargado")
      return
    }
    widgetRef.current?.destroy()
    widgetRef.current = window.Fintoc.create(options)
    widgetRef.current.open()
  }

  const close = () => {
    widgetRef.current?.close()
  }

  useEffect(() => {
    return () => {
      widgetRef.current?.destroy()
    }
  }, [])

  return { ready, open, close }
}

export type { FintocWidgetOptions }
