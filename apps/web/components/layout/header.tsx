"use client"

import { usePathname } from "next/navigation"
import Link from "next/link"
import { useEffect, useState } from "react"
import { useSession, signOut } from "@/lib/auth-client"
import { ThemeToggle } from "@/components/layout/theme-toggle"
import { Button } from "@/components/ui/button"
import { LogOut, User, Bell, Briefcase, Download } from "lucide-react"
import { CompanySelector } from "@/components/layout/company-selector"
import { useInstallPrompt } from "@/lib/use-install-prompt"

const sectionTitles: Record<string, string> = {
  dashboard: "Resumen",
  documents: "Documentos",
  emit: "Emisión de DTE",
  settings: "Configuración",
  purchases: "Compras",
  honorarios: "Honorarios",
  f29: "F29 Mensual",
  f22: "F22 Anual",
  "libro-ventas": "Libro de Ventas",
  "libro-compras": "Libro de Compras",
  contabilidad: "Contabilidad",
  puc: "Plan de Cuentas",
  "libro-diario": "Libro Diario",
  mayor: "Libro Mayor",
  reportes: "Reportes",
  "balance-comprobacion": "Balance de Comprobación",
  "estado-resultados": "Estado de Resultados",
  "balance-general": "Balance General",
  banco: "Tesorería",
  conciliacion: "Conciliación Bancaria",
  inventario: "Inventario",
  productos: "Productos",
  movimientos: "Kardex",
  remuneraciones: "Remuneraciones",
  trabajadores: "Trabajadores",
  liquidaciones: "Liquidaciones",
  exportaciones: "PreviRed / DDJJ",
  ai: "Agentes IA",
  ventas: "Ventas",
  cotizaciones: "Cotizaciones",
  contador: "Contador",
  clientes: "Mis Empresas",
  alertas: "Alertas",
  impuestos: "Impuestos",
  tesoreria: "Tesorería",
}

function buildCrumbs(pathname: string): Array<{ label: string; href: string }> {
  const segments = pathname.split("/").filter(Boolean)
  return segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/")
    const label =
      sectionTitles[seg] ??
      seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ")
    return { label, href }
  })
}

function UserMenu() {
  const { data: session } = useSession()
  const user = session?.user

  if (!user) return null

  const initials = user.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : user.email?.slice(0, 2).toUpperCase() || "??"

  return (
    <div className="relative group">
      <button className="h-8 w-8 rounded-full ring-1 ring-border bg-secondary flex items-center justify-center text-xs font-semibold hover:bg-secondary/80 transition-colors">
        {initials}
      </button>
      <div className="absolute right-0 top-full mt-2 w-48 rounded-md border border-border bg-paper shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <div className="px-3 py-2 border-b border-border">
          <p className="text-sm font-medium truncate">{user.name || user.email}</p>
          <p className="text-xs text-muted-foreground truncate">{user.email}</p>
        </div>
        <Link
          href="/selector"
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary/50 transition-colors"
        >
          <Briefcase className="h-4 w-4" />
          Cambiar perfil
        </Link>
        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-secondary/50 transition-colors"
        >
          <LogOut className="h-4 w-4" />
          Cerrar sesión
        </button>
      </div>
    </div>
  )
}

function NotificationBell() {
  const [alerts, setAlerts] = useState<Array<{ code: string; label: string; daysUntil: number }>>([])
  const [open, setOpen] = useState(false)

  useEffect(() => {
    fetch('/api/alerts/upcoming')
      .then((r) => r.json())
      .then((data) => setAlerts(data.alerts || []))
      .catch(() => setAlerts([]))
  }, [])

  const relevant = alerts.filter((a) => a.daysUntil < 0 || a.daysUntil <= 7)
  const count = relevant.length

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="relative h-8 w-8 rounded-full ring-1 ring-border bg-secondary flex items-center justify-center text-xs hover:bg-secondary/80 transition-colors"
        aria-label="Notificaciones"
      >
        <Bell className="h-4 w-4" />
        {count > 0 && (
          <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground flex items-center justify-center">
            {count}
          </span>
        )}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-72 rounded-md border border-border bg-paper shadow-lg z-50 max-h-80 overflow-y-auto">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-sm font-medium">Alertas</p>
            </div>
            {relevant.length === 0 ? (
              <div className="px-3 py-4 text-sm text-muted-foreground text-center">
                Sin alertas pendientes
              </div>
            ) : (
              <div className="divide-y divide-border">
                {relevant.map((alert) => {
                  const overdue = alert.daysUntil < 0
                  const urgent = !overdue && alert.daysUntil <= 2
                  const tone = overdue
                    ? 'text-red-700 bg-red-50'
                    : urgent
                    ? 'text-orange-700 bg-orange-50'
                    : 'text-amber-700 bg-amber-50'
                  const status = overdue
                    ? `Vencido hace ${Math.abs(alert.daysUntil)}d`
                    : alert.daysUntil === 0
                    ? 'Vence hoy'
                    : `Quedan ${alert.daysUntil}d`
                  return (
                    <Link
                      key={alert.code}
                      href="/alertas"
                      onClick={() => setOpen(false)}
                      className={`block px-3 py-2 text-sm hover:bg-secondary/30 transition-colors ${tone}`}
                    >
                      <p className="font-medium">{alert.label}</p>
                      <p className="text-xs opacity-80">{status}</p>
                    </Link>
                  )
                })}
              </div>
            )}
            <div className="px-3 py-2 border-t border-border">
              <Link
                href="/alertas"
                onClick={() => setOpen(false)}
                className="text-xs text-primary hover:underline"
              >
                Ver todas las alertas →
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

function InstallButton() {
  const { isInstallable, promptInstall } = useInstallPrompt()

  if (!isInstallable) return null

  return (
    <button
      onClick={promptInstall}
      className="h-8 w-8 rounded-full ring-1 ring-border bg-secondary flex items-center justify-center hover:bg-secondary/80 transition-colors"
      aria-label="Instalar ContaChile"
      title="Instalar como app"
    >
      <Download className="h-4 w-4" />
    </button>
  )
}

function formatDateEs(d: Date): string {
  return d.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function Header() {
  const pathname = usePathname()
  const crumbs = buildCrumbs(pathname)
  const title = crumbs[crumbs.length - 1]?.label ?? "ContaChile"

  // Hidratación segura: formatear la fecha sólo después del mount para
  // evitar mismatch SSR/CSR (servidor y cliente pueden tener relojes distintos).
  const [dateLabels, setDateLabels] = useState<{
    pretty: string
    year: string
  } | null>(null)

  useEffect(() => {
    const now = new Date()
    setDateLabels({
      pretty: formatDateEs(now),
      year: String(now.getFullYear()),
    })
  }, [])

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-paper/95 backdrop-blur-sm supports-[backdrop-filter]:bg-paper/70">
      <div className="container py-4">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            {crumbs.length > 1 && (
              <nav
                aria-label="Migas de pan"
                className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground/80"
              >
                {crumbs.slice(0, -1).map((c, i) => (
                  <span key={c.href} className="flex items-center gap-1.5">
                    <Link
                      href={c.href}
                      className="hover:text-foreground transition-colors"
                    >
                      {c.label}
                    </Link>
                    {i === crumbs.length - 2 ? (
                      <span aria-hidden="true" className="text-muted-foreground/50">
                        ›
                      </span>
                    ) : (
                      <span aria-hidden="true" className="text-muted-foreground/50">
                        /
                      </span>
                    )}
                  </span>
                ))}
              </nav>
            )}
            <h1 className="font-display text-2xl md:text-3xl font-semibold leading-none tracking-tightest text-foreground truncate">
              {title}
            </h1>
          </div>

          <div className="flex items-center gap-5">
            <div className="hidden md:flex flex-col items-end leading-tight min-w-[12rem]">
              <span className="eyebrow !text-[0.6rem]">
                {dateLabels?.pretty ?? " "}
              </span>
              <span className="font-mono text-[0.65rem] text-muted-foreground/70 mt-0.5">
                {dateLabels?.year ? `ed. nº ${dateLabels.year}` : " "}
              </span>
            </div>
            <div className="h-8 w-px bg-border hidden md:block" />
            <InstallButton />
            <ThemeToggle />
            <CompanySelector />
            <NotificationBell />
            <UserMenu />
          </div>
        </div>
      </div>
    </header>
  )
}
