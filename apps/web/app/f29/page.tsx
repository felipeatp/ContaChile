"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Stat } from "@/components/ui/stat"
import { RuleOrnament } from "@/components/ui/rule-ornament"
import { Button } from "@/components/ui/button"
import { Loader2, FileBarChart, Printer, Download } from "lucide-react"

interface F29Data {
  period: { year: number; month: number }
  sales: { count: number; neto: number; iva: number; total: number }
  purchases: { count: number; neto: number; iva: number; total: number }
  f29: Record<string, number>
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

const fmt = (n: number) => `$ ${(n ?? 0).toLocaleString("es-CL")}`

export default function F29Page() {
  const [data, setData] = useState<F29Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)

  const fetchData = () => {
    setLoading(true)
    fetch(`/api/f29?year=${year}&month=${month}`)
      .then((res) => res.json())
      .then((json) => {
        setData(json)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchData()
  }, [year, month])

  const handlePrint = () => window.print()

  const handleExportCsv = () => {
    const url = `/api/f29/export?year=${year}&month=${month}`
    const a = document.createElement("a")
    a.href = url
    a.download = `F29_${year}${String(month).padStart(2, "0")}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const determinado = data?.f29["595"] ?? 0
  const totalPagar = data?.f29["91"] ?? 0
  const isPositive = determinado >= 0

  return (
    <>
      <style jsx global>{`
        @media print {
          body * { visibility: hidden; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
          .print-header { display: block !important; margin-bottom: 24px; border-bottom: 2px solid #000; padding-bottom: 12px; }
          .print-hide { display: none !important; }
        }
      `}</style>

      <div className="space-y-8 animate-fade-up">
        {/* Masthead */}
        <section className="print-hide">
          <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="flex items-center gap-3 mb-3">
                <span className="eyebrow">Período · {MONTHS[month - 1]} {year}</span>
                <span className="h-px w-10 bg-foreground/20" />
                <span className="eyebrow text-muted-foreground/60">Códigos SII</span>
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
                Declaración{" "}
                <em className="text-primary not-italic font-medium">F29 · IVA</em>
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Preview automático desde ventas y compras del período.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                className="h-10 rounded-sm border border-input bg-background px-3 text-sm"
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
              >
                {MONTHS.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                className="h-10 rounded-sm border border-input bg-background px-3 text-sm"
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <Button variant="outline" onClick={fetchData}>
                <FileBarChart className="mr-1.5 h-4 w-4" />
                Actualizar
              </Button>
              <Button variant="outline" onClick={handleExportCsv}>
                <Download className="mr-1.5 h-4 w-4" />
                CSV
              </Button>
              <Button variant="outline" onClick={handlePrint}>
                <Printer className="mr-1.5 h-4 w-4" />
                Imprimir
              </Button>
            </div>
          </div>
        </section>

        <div className="print-area space-y-8">
          {/* Print-only header */}
          <div className="print-header hidden">
            <h2 className="text-xl font-bold">F29 — Declaración de IVA</h2>
            <p className="text-sm">
              Período: {MONTHS[(data?.period.month ?? 1) - 1]} {data?.period.year}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Generado por ContaChile — {new Date().toLocaleDateString("es-CL")}
            </p>
          </div>

          {/* I — Métricas */}
          <section>
            <div className="flex items-center justify-between mb-4 print-hide">
              <span className="eyebrow">I · Resumen</span>
              <span className="text-xs text-muted-foreground/60 font-mono">
                {data?.sales.count ?? 0} ventas / {data?.purchases.count ?? 0} compras
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Stat
                label="Ventas del período"
                value={fmt(data?.sales.total ?? 0)}
                caption={`${data?.sales.count ?? 0} documentos · Neto ${fmt(data?.sales.neto ?? 0)}`}
                tone="default"
              />
              <Stat
                label="Compras del período"
                value={fmt(data?.purchases.total ?? 0)}
                caption={`${data?.purchases.count ?? 0} documentos · Neto ${fmt(data?.purchases.neto ?? 0)}`}
                tone="default"
              />
              <Stat
                label="IVA determinado"
                value={fmt(determinado)}
                tone={isPositive ? "negative" : "positive"}
                caption={isPositive ? "A pagar" : "A favor"}
                delta={`Total a pagar ${fmt(totalPagar)}`}
              />
            </div>
          </section>

          <RuleOrnament ornament="diamond" className="print-hide" />

          {/* II — Códigos SII */}
          <section>
            <div className="flex items-end justify-between mb-4 print-hide">
              <div>
                <span className="eyebrow block mb-1">II · Detalle</span>
                <h3 className="font-display text-2xl font-semibold tracking-tightest">
                  Códigos SII del formulario
                </h3>
              </div>
              <span className="text-xs text-muted-foreground/60 font-mono">
                F29 · {String(month).padStart(2, "0")}/{year}
              </span>
            </div>

            <div className="card-editorial overflow-hidden">
              <table className="table-editorial">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th data-numeric="true">Valor</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="font-mono">502</td>
                    <td>Débito fiscal (IVA ventas afectas)</td>
                    <td data-numeric="true">{fmt(data?.f29["502"] ?? 0)}</td>
                  </tr>
                  <tr>
                    <td className="font-mono">503</td>
                    <td>Crédito fiscal (IVA compras)</td>
                    <td data-numeric="true">{fmt(data?.f29["503"] ?? 0)}</td>
                  </tr>
                  <tr className="bg-secondary/40">
                    <td className="font-mono font-semibold text-primary">595</td>
                    <td className="font-semibold">IVA determinado <span className="text-muted-foreground font-normal">(502 − 503)</span></td>
                    <td data-numeric="true" className="font-semibold text-primary">{fmt(data?.f29["595"] ?? 0)}</td>
                  </tr>
                  <tr>
                    <td className="font-mono">538</td>
                    <td>Remanente crédito fiscal mes anterior</td>
                    <td data-numeric="true">{fmt(data?.f29["538"] ?? 0)}</td>
                  </tr>
                  <tr>
                    <td className="font-mono">547</td>
                    <td>Pago provisional mensual (PPM)</td>
                    <td data-numeric="true">{fmt(data?.f29["547"] ?? 0)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td className="font-mono font-semibold">91</td>
                    <td className="font-semibold">Total a pagar o devolver</td>
                    <td data-numeric="true" className="font-bold text-base">{fmt(data?.f29["91"] ?? 0)}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
