"use client"

import { Button } from "@/components/ui/button"
import { useFintocWidget } from "./fintoc-widget-loader"
import { Landmark, Loader2 } from "lucide-react"
import { useState } from "react"

interface ConnectBankButtonProps {
  onSuccess: (linkToken: string) => void
  onError?: (err: string) => void
}

const FINTOC_PUBLIC_KEY = process.env.NEXT_PUBLIC_FINTOC_PUBLIC_KEY || ""
const isPlaceholder = !FINTOC_PUBLIC_KEY || FINTOC_PUBLIC_KEY.endsWith("...")

export function ConnectBankButton({ onSuccess, onError }: ConnectBankButtonProps) {
  const { ready, open } = useFintocWidget()
  const [loading, setLoading] = useState(false)

  const handleClick = async () => {
    if (isPlaceholder) {
      onError?.("FINTOC_PUBLIC_KEY no está configurada. Agrega una key real en apps/web/.env.local")
      return
    }

    setLoading(true)
    try {
      // 1. Crear Link Intent en backend
      const intentRes = await fetch("/api/bank/link-intents", { method: "POST" })
      const intentData = await intentRes.json()
      if (!intentRes.ok || !intentData.widgetToken) {
        throw new Error(intentData.error || "No se pudo crear link intent")
      }

      // 2. Abrir widget con widgetToken
      open({
        publicKey: FINTOC_PUBLIC_KEY,
        widgetToken: intentData.widgetToken,
        onSuccess: async (payload) => {
          console.log("Fintoc onSuccess:", payload)
          const exchangeToken = payload.exchange_token
          if (!exchangeToken) {
            onError?.("No se recibió exchange_token del widget")
            return
          }

          // 3. Intercambiar exchange_token por link_token en backend
          const exchangeRes = await fetch("/api/bank/link-intents/exchange", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ exchangeToken }),
          })
          const exchangeData = await exchangeRes.json()
          if (!exchangeRes.ok) {
            throw new Error(exchangeData.error || "Error al intercambiar token")
          }

          onSuccess(exchangeData.linkToken || exchangeData.accounts?.[0])
        },
        onExit: () => {
          setLoading(false)
        },
        onEvent: (event) => {
          console.log("Fintoc event:", event)
        },
      })
    } catch (err) {
      setLoading(false)
      onError?.(err instanceof Error ? err.message : "Error desconocido")
    }
  }

  if (isPlaceholder) {
    return (
      <Button
        variant="outline"
        size="sm"
        className="gap-2 opacity-60"
        disabled
        title="FINTOC_PUBLIC_KEY no está configurada. Agrega una key real en apps/web/.env.local"
      >
        <Landmark className="h-4 w-4" />
        Conectar banco real
      </Button>
    )
  }

  return (
    <Button onClick={handleClick} disabled={!ready || loading} variant="outline" size="sm" className="gap-2">
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Landmark className="h-4 w-4" />}
      Conectar banco real
    </Button>
  )
}
