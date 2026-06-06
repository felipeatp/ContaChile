"use client"

import { Suspense, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { resetPassword } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Eye, EyeOff, AlertCircle, CheckCircle2 } from "lucide-react"
import { getPasswordStrength } from "@/lib/password-strength"
import { mapAuthError } from "@/lib/auth-errors"
import { cn } from "@/lib/utils"

function ResetPasswordForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const token = searchParams.get("token")
  const tokenError = searchParams.get("error")

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  const strength = useMemo(() => getPasswordStrength(password), [password])

  // Enlace inválido o expirado (sin token o Better Auth devolvió error en el callback)
  if (!token || tokenError) {
    return (
      <Shell>
        <div className="rounded-sm border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <p>
            El enlace para restablecer la contraseña es inválido o expiró.
            Solicita uno nuevo.
          </p>
        </div>
        <Link
          href="/forgot-password"
          className="block text-center text-xs text-foreground hover:underline"
        >
          Solicitar un nuevo enlace
        </Link>
      </Shell>
    )
  }

  if (done) {
    return (
      <Shell>
        <div className="rounded-sm border border-sage/30 bg-sage/5 p-4 text-sm text-sage flex items-start gap-3">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <p>Tu contraseña fue actualizada. Ya puedes iniciar sesión.</p>
        </div>
        <Link
          href="/login"
          className="block text-center text-xs text-foreground hover:underline"
        >
          Ir a iniciar sesión
        </Link>
      </Shell>
    )
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (password !== confirm) {
      setError("Las contraseñas no coinciden.")
      return
    }
    setLoading(true)
    const res = await resetPassword({ newPassword: password, token: token! })
    if (res.error) {
      setError(mapAuthError(res.error.message || ""))
      setLoading(false)
      return
    }
    setDone(true)
    setLoading(false)
    setTimeout(() => router.push("/login"), 1500)
  }

  return (
    <Shell>
      {error && (
        <div className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium leading-none">
            Nueva contraseña
          </label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              aria-describedby="password-strength"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
              aria-pressed={showPassword}
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {password.length > 0 && (
            <div id="password-strength" className="space-y-1">
              <div className="flex gap-1">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div
                    key={i}
                    className={cn(
                      "h-1 flex-1 rounded-full transition-colors",
                      i < strength.score ? strength.color : "bg-muted-foreground/20"
                    )}
                  />
                ))}
              </div>
              <p className="text-[0.65rem] text-muted-foreground">
                {strength.label} · Mínimo 8 caracteres, una mayúscula y un número
              </p>
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <label htmlFor="confirm" className="text-sm font-medium leading-none">
            Confirmar contraseña
          </label>
          <Input
            id="confirm"
            type={showPassword ? "text" : "password"}
            placeholder="••••••••"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
            minLength={8}
          />
        </div>
        <Button
          type="submit"
          className="w-full"
          disabled={loading || strength.score < 3}
        >
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Restablecer contraseña
        </Button>
      </form>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tightest">
            Nueva contraseña
          </h1>
          <p className="text-sm text-muted-foreground">
            Elige una contraseña segura para tu cuenta
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function ResetPasswordPage() {
  return (
    <Suspense>
      <ResetPasswordForm />
    </Suspense>
  )
}
