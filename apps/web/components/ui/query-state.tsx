"use client"

import { Loader2, AlertTriangle, Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"

interface QueryStateProps {
  isLoading: boolean
  isError: boolean
  isEmpty?: boolean
  onRetry?: () => void
  emptyMessage?: string
  errorMessage?: string
  children: React.ReactNode
}

export function QueryState({
  isLoading,
  isError,
  isEmpty = false,
  onRetry,
  emptyMessage = "Sin datos para mostrar",
  errorMessage = "No pudimos cargar la información.",
  children,
}: QueryStateProps) {
  if (isLoading) {
    return (
      <div role="status" aria-live="polite" className="flex items-center justify-center h-48">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="sr-only">Cargando…</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-48 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive/70" />
        <p className="text-sm text-muted-foreground max-w-sm">{errorMessage}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Reintentar
          </Button>
        )}
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 h-48 text-center">
        <Inbox className="h-8 w-8 text-muted-foreground/50" />
        <p className="font-display text-lg text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return <>{children}</>
}
