"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, Printer, FileBarChart, Sparkles } from "lucide-react"
import { formatCLP } from "@ContAI/validators"

export interface F22Line {
  code: string
  label: string
  value: number
  auto: boolean
}

export interface F22Data {
  year: number
  lines: F22Line[]
  summary: {
    ingresos: number
    costos: number
    gastos: number
    rentaLiquida: number
    ppmPagado: number
    impuesto: number
    saldoPagar: number
    saldoDevolver: number
  }
}

interface F22ReportProps {
  data: F22Data | null
  year: number
  loading?: boolean
  error?: string | null
  onYearChange: (year: number) => void
  onRefresh: () => void
  onPrint: () => void
  onExplain?: () => void
  explaining?: boolean
  titlePrefix?: string
}

export function F22Report({
  data,
  year,
  loading,
  error,
  onYearChange,
  onRefresh,
  onPrint,
  onExplain,
  explaining,
  titlePrefix = "Declaración",
}: F22ReportProps) {
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const summary = data?.summary
  const hasDevolution = (summary?.saldoDevolver ?? 0) > 0

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
                <span className="eyebrow">Año tributario · {year}</span>
                <span className="h-px w-10 bg-foreground/20" />
                <span className="eyebrow text-muted-foreground/60">Códigos SII</span>
              </div>
              <h2 className="font-display text-3xl md:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
                {titlePrefix}{" "}
                <em className="text-primary not-italic font-medium">F22 · Renta</em>
              </h2>
              <p className="mt-2 text-sm text-muted-foreground">
                Cálculo automático desde documentos del año. Revisa con tu contador antes de declarar.
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <select
                className="h-10 rounded-sm border border-input bg-background px-3 text-sm"
                value={year}
                onChange={(e) => onYearChange(Number(e.target.value))}
              >
                {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <Button variant="outline" size="sm" onClick={onRefresh}>
                <FileBarChart className="mr-2 h-4 w-4" />
                Recalcular
              </Button>
              <Button variant="outline" size="sm" onClick={onPrint}>
                <Printer className="mr-2 h-4 w-4" />
                Imprimir
              </Button>
              {onExplain && (
                <Button variant="outline" size="sm" onClick={onExplain} disabled={explaining}>
                  {explaining ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />}
                  Explicar con IA
                </Button>
              )}
            </div>
          </div>
        </section>

        {error && (
          <div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive print-hide">
            {error}
          </div>
        )}

        {/* Print header */}
        <div className="hidden print-header">
          <h1 className="text-2xl font-bold">F22 - Declaración Anual de Renta {year}</h1>
          <p className="text-sm">Generado por ContAI</p>
        </div>

        {/* Cards resumen */}
        <section className="print-area">
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Ingresos Brutos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{formatCLP(summary?.ingresos ?? 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Renta Líquida</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{formatCLP(summary?.rentaLiquida ?? 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">Impuesto Determinado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold font-mono">{formatCLP(summary?.impuesto ?? 0)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {hasDevolution ? "Saldo a Devolver" : "Saldo a Pagar"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold font-mono ${hasDevolution ? "text-green-600" : ""}`}>
                  {formatCLP(hasDevolution ? (summary?.saldoDevolver ?? 0) : (summary?.saldoPagar ?? 0))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Tabla detalle */}
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="font-display text-lg">Detalle F22 — {year}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2 px-3 font-medium">Código</th>
                      <th className="text-left py-2 px-3 font-medium">Descripción</th>
                      <th className="text-right py-2 px-3 font-medium">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.lines.map((line) => (
                      <tr key={line.code} className="border-b border-border/60 last:border-0">
                        <td className="py-2 px-3 font-mono text-muted-foreground">{line.code}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            {line.label}
                            {line.auto && (
                              <span className="text-[0.65rem] text-muted-foreground/60">(auto)</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono">{formatCLP(line.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </section>
      </div>
    </>
  )
}
