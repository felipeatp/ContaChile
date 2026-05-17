"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { useDocument } from "@/hooks/use-documents"
import { StatusBadge } from "@/components/documents/status-badge"
import { Button } from "@/components/ui/button"
import { ArrowLeft, Download, Copy, FileCode2, RefreshCw, FilePlus, Loader2 } from "lucide-react"
import { useState } from "react"

const DTE_LABELS: Record<number, string> = {
  33: "Factura electrónica",
  34: "Factura exenta",
  39: "Boleta electrónica",
  41: "Boleta exenta",
  43: "Liquidación-Factura",
  46: "Factura de compra",
  52: "Guía de despacho",
  56: "Nota de débito",
  61: "Nota de crédito",
}

const fmt = (n: number) => `$ ${n.toLocaleString("es-CL")}`

export default function DocumentDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { data: doc, isLoading, refetch } = useDocument(id)
  const [checking, setChecking] = useState(false)
  const [checkMessage, setCheckMessage] = useState<string | null>(null)

  const handleDownloadPDF = async () => {
    try {
      const res = await fetch(`/api/documents/${id}/pdf`)
      if (!res.ok) throw new Error("Error al descargar PDF")
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `dte-${doc?.type}-${doc?.folio}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch {
      alert("Error al descargar el PDF")
    }
  }

  const handleCheckStatus = async () => {
    setChecking(true)
    setCheckMessage(null)
    try {
      const res = await fetch(`/api/documents/${id}/check-status`, { method: "POST" })
      const json = await res.json()
      if (res.ok) {
        setCheckMessage(json.changed ? `Estado actualizado: ${json.status}` : `Estado sin cambios: ${json.status}`)
        refetch()
      } else {
        setCheckMessage(json.error || "Error al verificar estado")
      }
    } catch {
      setCheckMessage("Error de red al verificar estado")
    }
    setChecking(false)
  }

  const handleDownloadXML = async () => {
    try {
      const res = await fetch(`/api/documents/${id}/xml`)
      if (!res.ok) throw new Error("Error al descargar XML")
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `DTE-${doc?.type}-${doc?.folio}.xml`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch {
      alert("Error al descargar el XML")
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!doc) {
    return (
      <div className="card-editorial p-12 text-center">
        <p className="font-display text-lg text-muted-foreground mb-1">
          Documento no encontrado
        </p>
        <p className="text-xs text-muted-foreground/70">
          El folio o tipo no existe en tu archivo.
        </p>
      </div>
    )
  }

  const typeLabel = DTE_LABELS[doc.type] ?? `Tipo ${doc.type}`
  const isError = checkMessage?.toLowerCase().includes("error")

  return (
    <div className="space-y-8 animate-fade-up">
      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-3xl">
          <div className="flex items-center gap-3 mb-3">
            <Link href="/documents" className="inline-flex items-center text-muted-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
              <span className="eyebrow">Volver al archivo</span>
            </Link>
            <span className="h-px w-10 bg-foreground/20" />
            <span className="eyebrow text-muted-foreground/60">
              {typeLabel} · Tipo {doc.type}
            </span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground flex items-baseline gap-3">
            Folio{' '}
            <em className="text-primary not-italic font-medium font-mono tabular-nums">{doc.folio}</em>
            <StatusBadge status={doc.status} />
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Emitido el {new Date(doc.emittedAt).toLocaleString("es-CL")} a {doc.receiverName}.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {doc.status === "PENDING" && (
            <Button variant="outline" size="sm" onClick={handleCheckStatus} disabled={checking}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${checking ? "animate-spin" : ""}`} />
              Verificar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleDownloadXML}>
            <FileCode2 className="mr-1.5 h-3.5 w-3.5" />
            XML
          </Button>
          <Button variant="outline" size="sm" onClick={handleDownloadPDF}>
            <Download className="mr-1.5 h-3.5 w-3.5" />
            PDF
          </Button>
          <Link href={`/emit?duplicate=${id}`}>
            <Button variant="outline" size="sm">
              <FilePlus className="mr-1.5 h-3.5 w-3.5" />
              Duplicar
            </Button>
          </Link>
          {doc.type === 33 && (
            <Link href={`/emit?creditNote=${id}`}>
              <Button variant="outline" size="sm">
                <Copy className="mr-1.5 h-3.5 w-3.5" />
                Nota de crédito
              </Button>
            </Link>
          )}
        </div>
      </section>

      {checkMessage && (
        <div className={`rounded-sm border px-3 py-2 text-xs ${isError ? "border-destructive/30 bg-destructive/5 text-destructive" : "border-sage/30 bg-sage/5 text-sage"}`}>
          {checkMessage}
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <DefinitionList eyebrow="I · Información general" title="Identificación tributaria">
          <DefinitionRow label="Tipo DTE" value={`${doc.type} — ${typeLabel}`} />
          <DefinitionRow label="Folio" value={String(doc.folio)} mono />
          <DefinitionRow label="Track ID" value={doc.trackId || "—"} mono small />
          <DefinitionRow label="Fecha emisión" value={new Date(doc.emittedAt).toLocaleString("es-CL")} />
          {doc.acceptedAt && (
            <DefinitionRow label="Fecha aceptación" value={new Date(doc.acceptedAt).toLocaleString("es-CL")} />
          )}
          {doc.rejectedAt && (
            <DefinitionRow label="Fecha rechazo" value={new Date(doc.rejectedAt).toLocaleString("es-CL")} />
          )}
          {doc.rejectionReason && (
            <DefinitionRow label="Motivo rechazo" value={doc.rejectionReason} tone="destructive" />
          )}
        </DefinitionList>

        <DefinitionList eyebrow="II · Receptor" title={doc.receiverName}>
          <DefinitionRow label="RUT" value={doc.receiverRut} mono />
          <DefinitionRow label="Razón social" value={doc.receiverName} />
          {doc.receiverEmail && (
            <DefinitionRow label="Email" value={doc.receiverEmail} />
          )}
        </DefinitionList>
      </div>

      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <span className="eyebrow block mb-1">III · Detalle</span>
            <h3 className="font-display text-2xl font-semibold tracking-tightest">
              Items facturados
            </h3>
          </div>
        </div>

        <div className="card-editorial overflow-hidden">
          {!doc.items || doc.items.length === 0 ? (
            <div className="p-12 text-center text-sm text-muted-foreground">Sin ítems.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-editorial">
                <thead>
                  <tr>
                    <th>Descripción</th>
                    <th data-numeric="true">Cantidad</th>
                    <th data-numeric="true">Precio unitario</th>
                    <th data-numeric="true">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {doc.items.map((item) => (
                    <tr key={item.id}>
                      <td>{item.description}</td>
                      <td data-numeric="true" className="text-muted-foreground">{item.quantity}</td>
                      <td data-numeric="true" className="text-muted-foreground">{fmt(item.unitPrice)}</td>
                      <td data-numeric="true" className="font-semibold">{fmt(item.totalPrice)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={3} className="!text-right uppercase tracking-eyebrow text-[0.65rem] text-muted-foreground">Neto</td>
                    <td data-numeric="true">{fmt(doc.totalNet)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="!text-right uppercase tracking-eyebrow text-[0.65rem] text-muted-foreground">IVA · 19 %</td>
                    <td data-numeric="true">{fmt(doc.totalTax)}</td>
                  </tr>
                  <tr>
                    <td colSpan={3} className="!text-right uppercase tracking-eyebrow text-[0.65rem] text-foreground">Total</td>
                    <td data-numeric="true" className="font-mono text-base font-semibold text-foreground">{fmt(doc.totalAmount)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}

function DefinitionList({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: React.ReactNode
}) {
  return (
    <article className="card-editorial p-6 space-y-5">
      <header>
        <span className="eyebrow">{eyebrow}</span>
        <h3 className="font-display text-xl font-semibold tracking-tightest mt-1 truncate">{title}</h3>
      </header>
      <div className="h-px bg-border/60" />
      <dl className="space-y-2.5">{children}</dl>
    </article>
  )
}

function DefinitionRow({
  label,
  value,
  mono,
  small,
  tone,
}: {
  label: string
  value: string
  mono?: boolean
  small?: boolean
  tone?: "destructive"
}) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <dt className="text-muted-foreground shrink-0">{label}</dt>
      <dd className={`text-right ${mono ? "font-mono" : ""} ${small ? "text-xs" : ""} ${tone === "destructive" ? "text-destructive" : "text-foreground"}`}>
        {value}
      </dd>
    </div>
  )
}
