"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Stat } from "@/components/ui/stat"
import { RuleOrnament } from "@/components/ui/rule-ornament"
import { Button } from "@/components/ui/button"
import { Tooltip } from "@/components/ui/tooltip"
import { Loader2, FileBarChart, Printer, Download } from "lucide-react"
import { formatCLP } from "@contachile/validators"

export interface F29Data {
  period: { year: number; month: number }
  sales: { count: number; neto: number; iva: number; total: number }
  purchases: { count: number; neto: number; iva: number; total: number }
  f29: Record<string, number>
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

interface F29ReportProps {
  data: F29Data | null
  year: number
  month: number
  loading?: boolean
  error?: string | null
  onYearChange: (year: number) => void
  onMonthChange: (month: number) => void
  onRefresh: () => void
  onExportCsv: () => void
  onPrint: () => void
  titlePrefix?: string
}

export function F29Report({
  data,
  year,
  month,
  loading,
  error,
  onYearChange,
  onMonthChange,
  onRefresh,
  onExportCsv,
  onPrint,
  titlePrefix = "Declaración",
}: F29ReportProps) {
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
                {titlePrefix}{" "}
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
                onChange={(e) => onMonthChange(Number(e.target.value))}
              >
                {MONTHS.map((m, i) => (
                  <option key={i + 1} value={i + 1}>{m}</option>
                ))}
              </select>
              <select
                className="h-10 rounded-sm border border-input bg-background px-3 text-sm"
                value={year}
                onChange={(e) => onYearChange(Number(e.target.value))}
              >
                {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <Button variant="outline" onClick={onRefresh}>
                <FileBarChart className="mr-1.5 h-4 w-4" />
                Actualizar
              </Button>
              <Button variant="outline" onClick={onExportCsv}>
                <Download className="mr-1.5 h-4 w-4" />
                CSV
              </Button>
              <Button variant="outline" onClick={onPrint}>
                <Printer className="mr-1.5 h-4 w-4" />
                Imprimir
              </Button>
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-sm border border-destructive bg-destructive/5 px-4 py-3 text-sm text-destructive print-hide">
            {error}
          </div>
        )}

        <div className="print-area space-y-8">
          {/* Print-only header */}
          <div className="print-header hidden">
            <h2 className="text-xl font-bold">F29 — Declaración de IVA</h2>
            <p className="text-sm">
              Período: {MONTHS[(data?.period.month ?? 1) - 1]} {data?.period.year}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              Generado por ContAI — {new Date().toLocaleDateString("es-CL")}
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
                value={formatCLP(data?.sales.total ?? 0)}
                caption={`${data?.sales.count ?? 0} documentos · Neto ${formatCLP(data?.sales.neto ?? 0)}`}
                tone="default"
              />
              <Stat
                label="Compras del período"
                value={formatCLP(data?.purchases.total ?? 0)}
                caption={`${data?.purchases.count ?? 0} documentos · Neto ${formatCLP(data?.purchases.neto ?? 0)}`}
                tone="default"
              />
              <Stat
                label="IVA determinado"
                value={formatCLP(determinado)}
                tone={isPositive ? "negative" : "positive"}
                caption={isPositive ? "A pagar" : "A favor"}
                delta={`Total a pagar ${formatCLP(totalPagar)}`}
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
                    <td>
                      <span className="inline-flex items-center gap-1.5">
                        Débito fiscal (IVA ventas afectas)
                        <Tooltip content="El IVA del 19% que cobraste a tus clientes este mes. Sale del total de tus ventas afectas." />
                      </span>
                    </td>
                    <td data-numeric="true">{formatCLP(data?.f29["502"] ?? 0)}</td>
                  </tr>
                  <tr>
                    <td className="font-mono">503</td>
                    <td>
                      <span className="inline-flex items-center gap-1.5">
                        Crédito fiscal (IVA compras)
                        <Tooltip content="El IVA que pagaste tú al comprar. Lo puedes descontar del IVA que le cobraste a tus clientes." />
                      </span>
                    </td>
                    <td data-numeric="true">{formatCLP(data?.f29["503"] ?? 0)}</td>
                  </tr>
                  <tr className="bg-secondary/40">
                    <td className="font-mono font-semibold text-primary">595</td>
                    <td className="font-semibold">
                      <span className="inline-flex items-center gap-1.5">
                        IVA determinado <span className="text-muted-foreground font-normal">(502 − 503)</span>
                        <Tooltip content="Lo que queda después de restar tu crédito fiscal. Si es positivo, lo debes al SII. Si es negativo, queda como remanente para el mes siguiente." />
                      </span>
                    </td>
                    <td data-numeric="true" className="font-semibold text-primary">{formatCLP(data?.f29["595"] ?? 0)}</td>
                  </tr>
                  <tr>
                    <td className="font-mono">538</td>
                    <td>
                      <span className="inline-flex items-center gap-1.5">
                        Remanente crédito fiscal mes anterior
                        <Tooltip content="Si el mes pasado tu crédito fue mayor al débito, ese exceso se traspasa aquí y te ayuda a pagar menos este mes." />
                      </span>
                    </td>
                    <td data-numeric="true">{formatCLP(data?.f29["538"] ?? 0)}</td>
                  </tr>
                  <tr>
                    <td className="font-mono">547</td>
                    <td>
                      <span className="inline-flex items-center gap-1.5">
                        Pago provisional mensual (PPM)
                        <Tooltip content="Un anticipo del impuesto a la renta anual. El SII lo descuenta automáticamente del F22 que declaras en abril." />
                      </span>
                    </td>
                    <td data-numeric="true">{formatCLP(data?.f29["547"] ?? 0)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr>
                    <td className="font-mono font-semibold">91</td>
                    <td className="font-semibold">
                      <span className="inline-flex items-center gap-1.5">
                        Total a pagar o devolver
                        <Tooltip content="Si es positivo, debes pagarlo antes del vencimiento. Si es negativo, el SII te devuelve ese monto." />
                      </span>
                    </td>
                    <td data-numeric="true" className="font-bold text-base">{formatCLP(data?.f29["91"] ?? 0)}</td>
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
