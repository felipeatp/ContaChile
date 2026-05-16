"use client"

import { UserButton } from "@clerk/nextjs"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { ThemeToggle } from "@/components/layout/theme-toggle"

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

function formatNow(): string {
  const d = new Date()
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

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-paper/95 backdrop-blur-sm supports-[backdrop-filter]:bg-paper/70">
      <div className="container py-4">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            {crumbs.length > 1 && (
              <nav className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground/80">
                {crumbs.slice(0, -1).map((c, i) => (
                  <span key={c.href} className="flex items-center gap-1.5">
                    <Link
                      href={c.href}
                      className="hover:text-foreground transition-colors"
                    >
                      {c.label}
                    </Link>
                    {i < crumbs.length - 2 && (
                      <span className="text-muted-foreground/50">/</span>
                    )}
                    {i === crumbs.length - 2 && (
                      <span className="text-muted-foreground/50">›</span>
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
            <div className="hidden md:flex flex-col items-end leading-tight">
              <span className="eyebrow !text-[0.6rem]">{formatNow()}</span>
              <span className="font-mono text-[0.65rem] text-muted-foreground/70 mt-0.5">
                ed. nº {new Date().getFullYear()}
              </span>
            </div>
            <div className="h-8 w-px bg-border hidden md:block" />
            <ThemeToggle />
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8 ring-1 ring-border",
                },
              }}
            />
          </div>
        </div>
      </div>
    </header>
  )
}
