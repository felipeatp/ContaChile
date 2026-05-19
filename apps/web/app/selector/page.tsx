'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { Building2, Briefcase, Loader2 } from 'lucide-react'
import { useSession } from '@/lib/auth-client'

export default function SelectorPage() {
  const router = useRouter()
  const { data: session, isPending } = useSession()
  const [selected, setSelected] = useState<'empresa' | 'contador' | null>(null)

  useEffect(() => {
    if (!isPending && !session) {
      router.push('/login')
    }
  }, [session, isPending, router])

  function choose(role: 'empresa' | 'contador') {
    setSelected(role)
    localStorage.setItem('preferred_role', role)
    if (role === 'empresa') {
      router.push('/dashboard')
    } else {
      router.push('/contador/dashboard')
    }
  }

  if (isPending) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!session) return null

  return (
    <div className="min-h-screen flex items-center justify-center bg-paper">
      <div className="w-full max-w-lg space-y-8 p-6">
        <div className="text-center space-y-2">
          <h1 className="font-display text-2xl font-bold">¿Cómo quieres entrar?</h1>
          <p className="text-muted-foreground">
            Tu cuenta tiene acceso tanto como empresa como contador. Elige con qué perfil quieres trabajar hoy.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <button
            onClick={() => choose('empresa')}
            disabled={selected === 'empresa'}
            className={`rounded-lg border p-6 text-left space-y-4 transition-all hover:border-primary/50 hover:bg-secondary/20 ${
              selected === 'empresa' ? 'border-primary bg-secondary/30' : 'border-border'
            }`}
          >
            <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center">
              <Building2 className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-lg">Empresa</p>
              <p className="text-sm text-muted-foreground mt-1">
                Emitir DTE, gestionar compras, inventario, remuneraciones y tesorería.
              </p>
            </div>
          </button>

          <button
            onClick={() => choose('contador')}
            disabled={selected === 'contador'}
            className={`rounded-lg border p-6 text-left space-y-4 transition-all hover:border-primary/50 hover:bg-secondary/20 ${
              selected === 'contador' ? 'border-primary bg-secondary/30' : 'border-border'
            }`}
          >
            <div className="h-12 w-12 rounded-md bg-primary/10 flex items-center justify-center">
              <Briefcase className="h-6 w-6 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-lg">Contador</p>
              <p className="text-sm text-muted-foreground mt-1">
                Revisar contabilidad, estados financieros, impuestos y conciliación de clientes.
              </p>
            </div>
          </button>
        </div>

        <p className="text-center text-sm text-muted-foreground">
          Podrás cambiar de perfil en cualquier momento desde el menú de usuario.
        </p>
      </div>
    </div>
  )
}
