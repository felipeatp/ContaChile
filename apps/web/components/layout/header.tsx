"use client"

import { UserButton } from "@clerk/nextjs"
import { usePathname } from "next/navigation"

const pageTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/documents": "Documentos",
  "/emit": "Emitir DTE",
  "/settings": "Configuración",
}

export function Header() {
  const pathname = usePathname()
  const title = pageTitles[pathname] || "ContaChile"

  return (
    <header className="sticky top-0 z-30 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container flex h-14 items-center justify-between">
        <h1 className="text-lg font-semibold">{title}</h1>
        <div className="flex items-center space-x-4">
          <UserButton />
        </div>
      </div>
    </header>
  )
}
