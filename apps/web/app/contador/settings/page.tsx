"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Loader2, User, Mail, Shield, ArrowLeftRight, Building2 } from "lucide-react"
import { Stat } from "@/components/ui/stat"

type UserData = {
  id: string
  name: string
  email: string
  emailVerified: boolean
  image?: string | null
  createdAt: string
}

type SessionData = {
  user: UserData
  session: { createdAt: string; expiresAt: string }
}

export default function ContadorSettingsPage() {
  const router = useRouter()
  const [session, setSession] = useState<SessionData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/auth/get-session")
      .then((r) => r.json())
      .then((data) => {
        setSession(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const user = session?.user

  return (
    <div className="space-y-8 animate-fade-up">
      <section>
        <span className="eyebrow">Contador</span>
        <h1 className="font-display text-3xl font-semibold tracking-tightest mt-2">
          Configuración
        </h1>
        <p className="text-muted-foreground mt-2">
          Datos de tu cuenta y preferencias del portal contable.
        </p>
      </section>

      {user ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Stat
              label="Nombre"
              value={user.name || "—"}
              icon={<User className="h-4 w-4" />}
            />
            <Stat
              label="Email"
              value={user.email}
              icon={<Mail className="h-4 w-4" />}
            />
            <Stat
              label="Verificado"
              value={user.emailVerified ? "Sí" : "No"}
              icon={<Shield className="h-4 w-4" />}
              tone={user.emailVerified ? "positive" : "default"}
            />
          </div>

          <section className="rounded-lg border border-border p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold">Perfil</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-1">
                <label className="text-[0.65rem] font-semibold uppercase tracking-eyebrow text-foreground/70">ID de usuario</label>
                <p className="font-mono text-sm text-muted-foreground">{user.id}</p>
              </div>
              <div className="space-y-1">
                <label className="text-[0.65rem] font-semibold uppercase tracking-eyebrow text-foreground/70">Miembro desde</label>
                <p className="text-sm text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString("es-CL", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border p-6 space-y-4">
            <h2 className="font-display text-lg font-semibold">Acciones</h2>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => router.push("/selector")}>
                <ArrowLeftRight className="mr-2 h-4 w-4" />
                Cambiar a vista Empresa
              </Button>
              <Button variant="outline" onClick={() => router.push("/contador/clientes")}>
                <Building2 className="mr-2 h-4 w-4" />
                Ver mis clientes
              </Button>
            </div>
          </section>
        </>
      ) : (
        <div className="rounded-lg border border-border p-12 text-center">
          <p className="text-muted-foreground">No se pudo cargar la sesión.</p>
        </div>
      )}
    </div>
  )
}
