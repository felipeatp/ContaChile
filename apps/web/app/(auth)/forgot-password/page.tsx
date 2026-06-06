"use client"

import { useState } from "react"
import Link from "next/link"
import { requestPasswordReset } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, ArrowLeft, MailCheck } from "lucide-react"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    // Anti-enumeración: pase lo que pase, mostramos el mismo mensaje de éxito.
    await requestPasswordReset({ email, redirectTo: "/reset-password" }).catch(() => {})
    setLoading(false)
    setSent(true)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tightest">
            Recuperar contraseña
          </h1>
          <p className="text-sm text-muted-foreground">
            Te enviaremos un enlace para restablecerla
          </p>
        </div>

        {sent ? (
          <div className="rounded-sm border border-sage/30 bg-sage/5 p-4 text-sm text-sage flex items-start gap-3">
            <MailCheck className="h-5 w-5 shrink-0" />
            <p>
              Si existe una cuenta con{" "}
              <span className="font-medium">{email}</span>, te enviamos un enlace
              para restablecer tu contraseña. Revisa tu correo (y la carpeta de spam).
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-sm font-medium leading-none">
                Email
              </label>
              <Input
                id="email"
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Enviar enlace
            </Button>
          </form>
        )}

        <Link
          href="/login"
          className="flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver a iniciar sesión
        </Link>
      </div>
    </div>
  )
}
