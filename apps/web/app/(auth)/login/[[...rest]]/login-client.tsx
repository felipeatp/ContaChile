"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { signIn } from "@/lib/auth-client"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Eye, EyeOff } from "lucide-react"

import { mapAuthError } from "@/lib/auth-errors"

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const rawReturnUrl = searchParams.get("returnBackUrl") || "/dashboard"
  // Normalize to relative path — passing absolute URLs to signIn.social()
  // can cause trustedOrigins mismatches in Better Auth on CF Workers.
  const returnUrl = (() => {
    try { return new URL(rawReturnUrl).pathname } catch { return rawReturnUrl }
  })()
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    const res = await signIn.email({ email, password })

    if (res.error) {
      setError(mapAuthError(res.error.message || ""))
      setLoading(false)
      return
    }

    router.push(returnUrl)
  }

  async function handleGoogle() {
    setLoading(true)
    await signIn.social({ provider: "google", callbackURL: returnUrl })
  }

  async function handleMicrosoft() {
    setLoading(true)
    await signIn.social({ provider: "microsoft", callbackURL: returnUrl })
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-2">
          <h1 className="font-display text-2xl font-semibold tracking-tightest">
            Iniciar sesión
          </h1>
          <p className="text-sm text-muted-foreground">
            Accede a tu cuenta de ContAI
          </p>
        </div>

        {error && (
          <div className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Email</label>
            <Input
              id="email"
              type="email"
              placeholder="tu@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="space-y-1.5">
            <label htmlFor="password" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">Contraseña</label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
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
          </div>
          <Button type="submit" className="w-full" disabled={loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Iniciar sesión
          </Button>
        </form>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-paper px-2 text-muted-foreground">O</span>
          </div>
        </div>

        <div className="space-y-2">
          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleGoogle}
            disabled={loading}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
              <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
              <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
              <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
              <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
            </svg>
            Continuar con Google
          </Button>

          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleMicrosoft}
            disabled={loading}
          >
            <svg viewBox="0 0 21 21" className="h-4 w-4" aria-hidden="true">
              <rect x="1" y="1" width="9" height="9" fill="#F25022"/>
              <rect x="11" y="1" width="9" height="9" fill="#7FBA00"/>
              <rect x="1" y="11" width="9" height="9" fill="#00A4EF"/>
              <rect x="11" y="11" width="9" height="9" fill="#FFB900"/>
            </svg>
            Continuar con Microsoft
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          ¿No tienes cuenta?{" "}
          <Link href="/sign-up" className="text-foreground hover:underline">
            Regístrate
          </Link>
        </p>
      </div>
    </div>
  )
}

export default function LoginClient() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  )
}
