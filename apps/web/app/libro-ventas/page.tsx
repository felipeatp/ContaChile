"use client"

import { useState, useEffect } from "react"
import { Stat } from "@/components/ui/stat"
import { Button } from "@/components/ui/button"
import { Printer, FileText, Download, Loader2 } from "lucide-react"

interface DocumentItem {
  id: string
  description: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

interface SalesDocument {
  id: string
  type: number
  folio: number
  status: string
  emittedAt: string
  receiverRut: string
  receiverName: string
  totalNet: number
  totalTax: number
  totalAmount: number
  paymentMethod: string
  items: DocumentItem[]
}

interface SalesBookResponse {
  documents: SalesDocument[]
  total: number
  page: number
  limit: number
  summary: { net: number; tax: number; total: number }
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

const TYPE_LABEL: Record<number, string> = {
  33: "Factura",
  34: "F. Exenta",
  39: "Boleta",
  41: "B. Exenta",
  43: "Liq.-Factura",
  46: "F. Compra",
  52: "Guía",
  56: "N. Débito",
  61: "N. Crédito",
}

const fmt = (n: number) => `$ ${n.toLocaleString("es-CL")}`

export default function LibroVentasPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [data, setData] = useState<SalesBookResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/sales-book?year=${year}&month=${month}&limit=1000`)
      const json = await res.json()
      setData(json)
    } catch {
      setData(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [year, month])

  const handlePrint = () => window.print()

  const handleExportCsv = () => {
    const url = `/api/sales-book/export?year=${year}&month=${month}`
    const a = document.createElement("a")
    a.href = url
    a.download = `LibroVentas_${year}${String(month).padStart(2, "0")}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <>
      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { background: white; }
        }
      `}</style>

      <div className="space-y-8 animate-fade-up">
        <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between print-header">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-3">
              <span className="eyebrow">Ventas · Libro</span>
              <span className="h-px w-10 bg-foreground/20" />
              <span className="eyebrow text-muted-foreground/60">
                {MONTHS[month - 1]} {year}
              </span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
              Libro de{" "}
              <em className="text-primary not-italic font-medium">Ventas</em>
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Documentos emitidos del período. Exportable a CSV para tu contador y a PDF para tu archivo.
            </p>
          </div>
          <div className="flex items-center gap-2 flex-wrap no-print">
            <select
              className="h-10 px-3 text-sm"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <select
              className="h-10 px-3 text-sm"
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
            >
              {MONTHS.map((name, idx) => (
                <option key={idx + 1} value={idx + 1}>{name}</option>
              ))}
            </select>
            <Button variant="outline" onClick={handleExportCsv}>
              <Download className="mr-1.5 h-4 w-4" />
              CSV
            </Button>
            <Button variant="outline" onClick={handlePrint}>
              <Printer className="mr-1.5 h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </section>

        <div className="print-only hidden">
          <div className="text-center mb-4">
            <h2 className="text-xl font-bold">Libro de Ventas</h2>
            <p className="text-sm text-muted-foreground">
              Período: {MONTHS[month - 1]} {year}
            </p>
            <p className="text-xs text-muted-foreground">
              Fecha impresión: {new Date().toLocaleDateString("es-CL")}
            </p>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !data || data.documents.length === 0 ? (
          <div className="card-editorial p-12 text-center">
            <FileText className="mx-auto h-8 w-8 mb-3 text-muted-foreground/40" />
            <p className="font-display text-lg text-muted-foreground mb-1">
              Sin ventas en el período
            </p>
            <p className="text-xs text-muted-foreground/70">
              Emite tu primer documento desde &ldquo;Emitir DTE&rdquo;.
            </p>
          </div>
        ) : (
          <>
            <section>
              <div className="flex items-center justify-between mb-4">
                <span className="eyebrow">I · Resumen</span>
                <span className="text-xs text-muted-foreground/60 font-mono">
                  {data.total} documentos
                </span>
              </div>
              <div className="grid gap-4 md:grid-cols-3">
                <Stat label="Neto" value={fmt(data.summary.net)} tone="default" />
                <Stat label="IVA (19 %)" value={fmt(data.summary.tax)} tone="default" />
                <Stat label="Total ventas" value={fmt(data.summary.total)} tone="accent" />
              </div>
            </section>

            <section>
              <div className="flex items-end justify-between mb-4">
                <div>
                  <span className="eyebrow block mb-1">II · Detalle</span>
                  <h3 className="font-display text-2xl font-semibold tracking-tightest">
                    Documentos emitidos
                  </h3>
                </div>
              </div>

              <div className="card-editorial overflow-hidden">
                <table className="table-editorial">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Tipo</th>
                      <th data-numeric="true">Folio</th>
                      <th>Receptor</th>
                      <th data-numeric="true">Neto</th>
                      <th data-numeric="true">IVA</th>
                      <th data-numeric="true">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.documents.map((doc) => (
                      <tr key={doc.id}>
                        <td className="text-muted-foreground">
                          {new Date(doc.emittedAt).toLocaleDateString("es-CL")}
                        </td>
                        <td>
                          <span className="text-[0.6rem] uppercase tracking-eyebrow font-semibold rounded-sm bg-secondary px-1.5 py-0.5">
                            {TYPE_LABEL[doc.type] ?? doc.type}
                          </span>
                        </td>
                        <td data-numeric="true">{doc.folio}</td>
                        <td>
                          <div className="text-foreground">{doc.receiverName}</div>
                          <div className="text-xs text-muted-foreground font-mono mt-0.5">
                            {doc.receiverRut}
                          </div>
                        </td>
                        <td data-numeric="true">{fmt(doc.totalNet)}</td>
                        <td data-numeric="true" className="text-muted-foreground">
                          {fmt(doc.totalTax)}
                        </td>
                        <td data-numeric="true" className="font-semibold">
                          {fmt(doc.totalAmount)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={4} className="text-right font-semibold">Totales</td>
                      <td data-numeric="true" className="font-semibold">{fmt(data.summary.net)}</td>
                      <td data-numeric="true" className="font-semibold">{fmt(data.summary.tax)}</td>
                      <td data-numeric="true" className="font-bold">{fmt(data.summary.total)}</td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </section>
          </>
        )}
      </div>
    </>
  )
}
