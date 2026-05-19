"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"
import { Building2, ChevronDown, Check } from "lucide-react"
import { Button } from "@/components/ui/button"

export type CompanyItem = {
  id: string
  name: string
  rut: string
  role: string
  joinedAt: string
}

function getCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp("(^| )" + name + "=([^;]+)"))
  return match ? decodeURIComponent(match[2]) : null
}

function setCookie(name: string, value: string, days = 365) {
  const expires = new Date(Date.now() + days * 86400000).toUTCString()
  document.cookie = `${name}=${encodeURIComponent(value)}; expires=${expires}; path=/; SameSite=Lax`
}

export function CompanySelector() {
  const pathname = usePathname()
  const [companies, setCompanies] = useState<CompanyItem[]>([])
  const [loading, setLoading] = useState(true)
  const [open, setOpen] = useState(false)
  const [activeId, setActiveId] = useState<string | null>(null)

  const isContador = pathname.startsWith("/contador")

  useEffect(() => {
    if (!isContador) return
    // Leer cookie solo en cliente
    setActiveId(getCookie("active-company-id"))
    fetch("/api/companies")
      .then((r) => r.json())
      .then((data) => {
        setCompanies(data.companies || [])
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [isContador])

  useEffect(() => {
    // Sincronizar con cookie
    const cookieId = getCookie("active-company-id")
    if (cookieId && cookieId !== activeId) {
      setActiveId(cookieId)
    }
  }, [activeId])

  if (!isContador) return null
  if (loading) return null
  if (companies.length <= 1) return null

  const activeCompany = companies.find((c) => c.id === activeId) || companies[0]

  const handleSelect = (id: string) => {
    setActiveId(id)
    setCookie("active-company-id", id)
    setOpen(false)
    window.location.reload()
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        size="sm"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 min-w-[140px]"
      >
        <Building2 className="h-4 w-4 shrink-0" />
        <span className="truncate max-w-[120px]">{activeCompany?.name || "Empresa"}</span>
        <ChevronDown className="h-3 w-3 shrink-0" />
      </Button>

      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-2 w-64 rounded-md border border-border bg-paper shadow-lg z-50">
            <div className="px-3 py-2 border-b border-border">
              <p className="text-sm font-medium">Mis empresas</p>
              <p className="text-xs text-muted-foreground">{companies.length} cliente{companies.length !== 1 ? "s" : ""}</p>
            </div>
            <div className="divide-y divide-border">
              {companies.map((company) => (
                <button
                  key={company.id}
                  onClick={() => handleSelect(company.id)}
                  className="w-full flex items-center justify-between px-3 py-2 text-sm hover:bg-secondary/50 transition-colors text-left"
                >
                  <div>
                    <p className="font-medium">{company.name}</p>
                    <p className="text-xs text-muted-foreground font-mono">{company.rut}</p>
                  </div>
                  {company.id === activeId && (
                    <Check className="h-4 w-4 text-primary shrink-0" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
