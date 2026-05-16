"use client"

import { useState } from "react"
import Link from "next/link"
import { useDocuments } from "@/hooks/use-documents"
import { DocumentTable } from "@/components/documents/document-table"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Loader2, Package, Search, ChevronLeft, ChevronRight } from "lucide-react"

const DTE_TYPE_OPTIONS = [
  { value: "", label: "Todos los tipos" },
  { value: "33", label: "33 - Factura" },
  { value: "34", label: "34 - Factura Exenta" },
  { value: "39", label: "39 - Boleta" },
  { value: "41", label: "41 - Boleta Exenta" },
  { value: "43", label: "43 - Liquidación-Factura" },
  { value: "46", label: "46 - Factura de Compra" },
  { value: "52", label: "52 - Guía de Despacho" },
  { value: "56", label: "56 - Nota de Débito" },
  { value: "61", label: "61 - Nota de Crédito" },
]

const STATUS_OPTIONS = [
  { value: "", label: "Todos" },
  { value: "PENDING", label: "Pendientes" },
  { value: "ACCEPTED", label: "Aceptados" },
  { value: "REJECTED", label: "Rechazados" },
  { value: "FAILED", label: "Fallidos" },
]

export default function DocumentsPage() {
  const [status, setStatus] = useState<string>("")
  const [type, setType] = useState<string>("")
  const [from, setFrom] = useState<string>("")
  const [to, setTo] = useState<string>("")
  const [search, setSearch] = useState<string>("")
  const [page, setPage] = useState<number>(1)
  const limit = 20

  const { data, isLoading } = useDocuments({
    status: status || undefined,
    type: type ? parseInt(type, 10) : undefined,
    from: from || undefined,
    to: to || undefined,
    search: search || undefined,
    page,
    limit,
  })

  const [envioLoading, setEnvioLoading] = useState(false)

  const handleGenerateEnvio = async () => {
    const pendingWithXml = data?.documents?.filter(
      (d: any) => d.status === "PENDING" && d.xmlContent
    )
    if (!pendingWithXml || pendingWithXml.length === 0) {
      alert("No hay documentos pendientes con XML firmado para enviar")
      return
    }

    setEnvioLoading(true)
    try {
      const res = await fetch("/api/dte/envio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: pendingWithXml.map((d: any) => d.id) }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || "Error al generar EnvioDTE")
        setEnvioLoading(false)
        return
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `EnvioDTE-${Date.now()}.xml`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch {
      alert("Error al generar EnvioDTE")
    }
    setEnvioLoading(false)
  }

  const totalPages = data?.totalPages ?? 1

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Masthead */}
      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-3">
            <span className="eyebrow">Ventas · Documentos</span>
            <span className="h-px w-10 bg-foreground/20" />
            <span className="eyebrow text-muted-foreground/60">
              {data?.total ?? 0} en archivo
            </span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
            Archivo de{" "}
            <em className="text-primary not-italic font-medium">DTEs emitidos</em>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Facturas, boletas y notas. Filtra por estado SII, tipo, período y busca por RUT, nombre o folio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={handleGenerateEnvio} disabled={envioLoading}>
            {envioLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
            Generar EnvioDTE
          </Button>
          <Link href="/emit">
            <Button>Emitir DTE</Button>
          </Link>
        </div>
      </section>

      {/* Filtros */}
      <section className="card-editorial p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="eyebrow">Filtros</span>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-3">
          <div>
            <label className="text-[0.65rem] uppercase tracking-eyebrow font-semibold text-muted-foreground/80 mb-1 block">Estado</label>
            <select
              value={status}
              onChange={(e) => { setStatus(e.target.value); setPage(1) }}
              className="h-10 w-full px-3 text-sm"
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[0.65rem] uppercase tracking-eyebrow font-semibold text-muted-foreground/80 mb-1 block">Tipo DTE</label>
            <select
              value={type}
              onChange={(e) => { setType(e.target.value); setPage(1) }}
              className="h-10 w-full px-3 text-sm"
            >
              {DTE_TYPE_OPTIONS.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[0.65rem] uppercase tracking-eyebrow font-semibold text-muted-foreground/80 mb-1 block">Desde</label>
            <Input
              type="date"
              value={from}
              onChange={(e) => { setFrom(e.target.value); setPage(1) }}
            />
          </div>
          <div>
            <label className="text-[0.65rem] uppercase tracking-eyebrow font-semibold text-muted-foreground/80 mb-1 block">Hasta</label>
            <Input
              type="date"
              value={to}
              onChange={(e) => { setTo(e.target.value); setPage(1) }}
            />
          </div>
          <div>
            <label className="text-[0.65rem] uppercase tracking-eyebrow font-semibold text-muted-foreground/80 mb-1 block">Buscar</label>
            <div className="relative">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground/60" />
              <Input
                placeholder="RUT, nombre o folio"
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1) }}
                className="pl-9"
              />
            </div>
          </div>
        </div>
      </section>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <DocumentTable documents={data?.documents || []} />

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2">
              <p className="text-xs text-muted-foreground font-mono tabular">
                {(page - 1) * limit + 1}–{Math.min(page * limit, data?.total ?? 0)} de {data?.total ?? 0} documentos
              </p>
              <div className="flex items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                >
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                <span className="text-xs font-mono tabular text-muted-foreground">
                  {page} / {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
