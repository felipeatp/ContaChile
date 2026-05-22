"use client"

import { useEffect, useState } from "react"
import { useRouter, useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, Building2, AlertTriangle, CheckCircle } from "lucide-react"

export default function InvitacionPage() {
  const router = useRouter()
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [accepting, setAccepting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [company, setCompany] = useState<{ name: string; rut: string } | null>(null)
  const [accepted, setAccepted] = useState(false)

  useEffect(() => {
    fetch(`/api/invitations/${token}`)
      .then((r) => r.json())
      .then((data) => {
        if (data.error) {
          setError(data.error)
        } else {
          setCompany(data.company)
        }
        setLoading(false)
      })
      .catch(() => {
        setError("Error al verificar la invitación")
        setLoading(false)
      })
  }, [token])

  const handleAccept = async () => {
    setAccepting(true)
    setError(null)

    try {
      const res = await fetch(`/api/invitations/${token}/accept`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Error al aceptar invitación")
      } else {
        setAccepted(true)
        setTimeout(() => {
          router.push("/contador/dashboard")
        }, 2000)
      }
    } catch {
      setError("Error de red")
    } finally {
      setAccepting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error && !company) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <AlertTriangle className="h-12 w-12 mx-auto text-destructive" />
          <h1 className="font-display text-2xl font-semibold">Invitación inválida</h1>
          <p className="text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (accepted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md w-full text-center space-y-4">
          <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
          <h1 className="font-display text-2xl font-semibold">¡Invitación aceptada!</h1>
          <p className="text-muted-foreground">
            Ahora eres contador de <strong>{company?.name}</strong>. Redirigiendo...
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-md w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="font-display text-3xl font-semibold tracking-tightest">
            Invitación recibida
          </h1>
          <p className="text-muted-foreground">
            Te han invitado a gestionar la contabilidad de esta empresa.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-card p-6 space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center">
              <Building2 className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-medium">{company?.name}</p>
              <p className="text-xs text-muted-foreground font-mono">{company?.rut}</p>
            </div>
          </div>
        </div>

        {error && (
          <div className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        <Button onClick={handleAccept} disabled={accepting} className="w-full">
          {accepting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
          Aceptar invitación
        </Button>

        <p className="text-xs text-center text-muted-foreground">
          Al aceptar, tendrás acceso a los libros contables, reportes y declaraciones tributarias de esta empresa.
        </p>
      </div>
    </div>
  )
}
