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
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet"
import { cn } from "@/lib/utils"

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/documents", label: "Documentos", icon: FileText },
  { href: "/emit", label: "Emitir DTE", icon: PlusCircle },
  { href: "/purchases", label: "Compras", icon: ShoppingCart },
  { href: "/f29", label: "F29", icon: FileBarChart },
  { href: "/f22", label: "F22 Anual", icon: FileBarChart },
  { href: "/libro-ventas", label: "Libro Ventas", icon: BookOpen },
  { href: "/libro-compras", label: "Libro Compras", icon: ShoppingCart },
  { href: "/contabilidad/puc", label: "Plan de Cuentas", icon: BookOpen },
  { href: "/ai", label: "Agentes IA", icon: Bot },
  { href: "/settings", label: "Configuración", icon: Settings },
]

function SidebarContent({ collapsed }: { collapsed: boolean }) {
  const pathname = usePathname()

  return (
    <div className="flex h-full flex-col">
      <div className={cn(
        "flex items-center h-16 px-4 border-b",
        collapsed ? "justify-center" : "justify-between"
      )}>
        {!collapsed && (
          <Link href="/" className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">CC</span>
            </div>
            <span className="font-bold text-lg">ContaChile</span>
          </Link>
        )}
        {collapsed && (
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
            <span className="text-primary-foreground font-bold text-sm">CC</span>
          </div>
        )}
      </div>

      <nav className="flex-1 px-2 py-4 space-y-1">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/")

          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                collapsed ? "justify-center" : "justify-start"
              )}
              title={collapsed ? item.label : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" />
              {!collapsed && <span className="ml-3">{item.label}</span>}
            </Link>
          )
        })}
      </nav>
    </div>
  )
}

export function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <>
      {/* Mobile hamburger */}
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0">
            <SidebarContent collapsed={false} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop sidebar */}
      <aside
        className={cn(
          "hidden lg:flex fixed left-0 top-0 h-screen flex-col border-r bg-background transition-all duration-300 z-40",
          collapsed ? "w-16" : "w-64"
        )}
      >
        <SidebarContent collapsed={collapsed} />

        <div className="border-t p-2">
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

      {/* Main content offset */}
      <div className={cn(
        "hidden lg:block transition-all duration-300",
        collapsed ? "lg:ml-16" : "lg:ml-64"
      )} />
    </>
  )
}
