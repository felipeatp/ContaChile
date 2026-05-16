"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  ShoppingCart,
  FileBarChart,
  BookOpen,
  Settings,
  Bot,
  Users,
  Menu,
  ChevronLeft,
  ChevronRight,
  Landmark,
  Boxes,
  CalendarClock,
  Wallet,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

type NavItem = {
  href: string
  label: string
  icon: typeof LayoutDashboard
}

type NavSection = {
  /** small-caps section header. omit for top-level (Dashboard) */
  label?: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    items: [{ href: "/dashboard", label: "Resumen", icon: LayoutDashboard }],
  },
  {
    label: "Ventas",
    items: [
      { href: "/emit", label: "Emitir DTE", icon: PlusCircle },
      { href: "/ventas/cotizaciones", label: "Cotizaciones", icon: FileText },
      { href: "/documents", label: "Documentos", icon: FileText },
      { href: "/libro-ventas", label: "Libro de Ventas", icon: BookOpen },
    ],
  },
  {
    label: "Compras",
    items: [
      { href: "/purchases", label: "Compras", icon: ShoppingCart },
      { href: "/honorarios", label: "Honorarios", icon: ShoppingCart },
      { href: "/libro-compras", label: "Libro de Compras", icon: BookOpen },
    ],
  },
  {
    label: "Contabilidad",
    items: [
      { href: "/contabilidad/puc", label: "Plan de Cuentas", icon: BookOpen },
      { href: "/contabilidad/libro-diario", label: "Libro Diario", icon: BookOpen },
      { href: "/contabilidad/mayor", label: "Libro Mayor", icon: BookOpen },
      { href: "/contabilidad/reportes/balance-comprobacion", label: "Balance Comprob.", icon: FileBarChart },
      { href: "/contabilidad/reportes/estado-resultados", label: "Estado Resultados", icon: FileBarChart },
      { href: "/contabilidad/reportes/balance-general", label: "Balance General", icon: FileBarChart },
    ],
  },
  {
    label: "Impuestos",
    items: [
      { href: "/f29", label: "F29 Mensual", icon: FileBarChart },
      { href: "/f22", label: "F22 Anual", icon: FileBarChart },
    ],
  },
  {
    label: "Tesorería",
    items: [
      { href: "/banco/conciliacion", label: "Conciliación", icon: Landmark },
    ],
  },
  {
    label: "Inventario",
    items: [
      { href: "/inventario/productos", label: "Productos", icon: Boxes },
      { href: "/inventario/movimientos", label: "Kardex", icon: BookOpen },
    ],
  },
  {
    label: "Remuneraciones",
    items: [
      { href: "/remuneraciones/trabajadores", label: "Trabajadores", icon: Users },
      { href: "/remuneraciones/liquidaciones", label: "Liquidaciones", icon: Wallet },
      { href: "/remuneraciones/exportaciones", label: "PreviRed / DDJJ", icon: CalendarClock },
    ],
  },
  {
    items: [
      { href: "/ai", label: "Agentes IA", icon: Bot },
      { href: "/settings", label: "Configuración", icon: Settings },
    ],
  },
]

function Brand({ collapsed }: { collapsed: boolean }) {
  return (
    <Link
      href="/"
      className={cn(
        "flex items-center gap-2.5",
        collapsed && "justify-center"
      )}
    >
      <div className="relative h-9 w-9 shrink-0 border border-foreground bg-paper flex items-center justify-center">
        <span className="font-display text-base font-black leading-none text-foreground">
          C
        </span>
        <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 bg-primary" />
      </div>
      {!collapsed && (
        <div className="leading-none">
          <span className="block font-display text-lg font-semibold tracking-tightest text-foreground">
            ContaChile
          </span>
          <span className="block eyebrow !text-[0.55rem] !tracking-[0.2em] mt-0.5 text-muted-foreground/70">
            Edición Financiera
          </span>
        </div>
      )}
    </Link>
  )
}

function SidebarContent({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex items-center h-16 px-4 border-b border-border",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        <Brand collapsed={collapsed} />
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-5">
        {navSections.map((section, idx) => (
          <div key={section.label ?? `top-${idx}`} className="space-y-0.5">
            {section.label && !collapsed && (
              <div className="px-3 pb-1 eyebrow !text-[0.62rem]">
                {section.label}
              </div>
            )}
            {section.items.map((item) => {
              const Icon = item.icon
              const isActive =
                pathname === item.href || pathname.startsWith(item.href + "/")

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "group relative flex items-center rounded-sm px-3 py-1.5 text-sm transition-all",
                    isActive
                      ? "text-foreground bg-secondary/60"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/30",
                    collapsed ? "justify-center" : "justify-start"
                  )}
                  title={collapsed ? item.label : undefined}
                >
                  {isActive && !collapsed && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 h-4 w-0.5 bg-primary" />
                  )}
                  <Icon
                    className={cn(
                      "h-4 w-4 shrink-0 transition-colors",
                      isActive ? "text-primary" : ""
                    )}
                  />
                  {!collapsed && (
                    <span
                      className={cn(
                        "ml-3 truncate",
                        isActive && "font-medium"
                      )}
                    >
                      {item.label}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>
    </div>
  )
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-paper">
            <SidebarContent collapsed={false} />
          </SheetContent>
        </Sheet>
      </div>

      <aside
        className={cn(
          "hidden lg:flex fixed left-0 top-0 h-screen flex-col border-r border-border bg-paper transition-all duration-300 z-40",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <SidebarContent collapsed={collapsed} />

        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setCollapsed(!collapsed)}
            className="w-full"
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </aside>

      <div
        className={cn(
          "hidden lg:block transition-all duration-300",
          collapsed ? "lg:ml-16" : "lg:ml-64"
        )}
      />
    </>
  )
}
