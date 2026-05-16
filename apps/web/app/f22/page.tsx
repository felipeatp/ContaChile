'use client'

import { useState, useEffect } from 'react'
import { Stat } from '@/components/ui/stat'
import { RuleOrnament } from '@/components/ui/rule-ornament'
import { Button } from '@/components/ui/button'
import { Loader2, Printer } from 'lucide-react'

interface F22Line {
  code: string
  label: string
  value: number
  auto: boolean
}

interface F22Response {
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

const fmt = (n: number) => `$ ${n.toLocaleString('es-CL')}`

export default function F22Page() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState<F22Response | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchF22 = async (y: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/f22?year=${y}`)
      if (!res.ok) throw new Error('Error al calcular F22')
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchF22(year)
  }, [year])

  const isToPay = data ? data.summary.saldoPagar > 0 : false
  const saldoLabel = isToPay ? 'Saldo a pagar' : 'Saldo a devolver'
  const saldoValue = data ? (isToPay ? data.summary.saldoPagar : data.summary.saldoDevolver) : 0

  return (
    <div className="space-y-8 animate-fade-up">
      {/* Masthead */}
      <section>
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-3">
              <span className="eyebrow">Año tributario · {year}</span>
              <span className="h-px w-10 bg-foreground/20" />
              <span className="eyebrow text-muted-foreground/60">Declaración anual</span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
              Declaración{' '}
              <em className="text-primary not-italic font-medium">F22 · Renta</em>
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Cálculo automático desde ingresos, costos y gastos del ejercicio.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="h-10 rounded-sm border border-input bg-background px-3 text-sm"
            >
              {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
            <Button variant="outline" onClick={() => window.print()}>
              <Printer className="mr-1.5 h-4 w-4" />
              Imprimir
            </Button>
          </div>
        </div>
      </section>

      {error && (
        <div className="rounded-sm border border-destructive bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          {/* I — Métricas */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <span className="eyebrow">I · Resumen del ejercicio</span>
              <span className="text-xs text-muted-foreground/60 font-mono">
                PPM acumulado {fmt(data.summary.ppmPagado)}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Stat
                label="Renta líquida"
                value={fmt(data.summary.rentaLiquida)}
                caption={`Ingresos ${fmt(data.summary.ingresos)} − Costos ${fmt(data.summary.costos)} − Gastos ${fmt(data.summary.gastos)}`}
                tone="default"
              />
              <Stat
                label="Impuesto determinado"
                value={fmt(data.summary.impuesto)}
                tone="accent"
                caption="Tabla progresiva"
              />
              <Stat
                label={saldoLabel}
                value={fmt(saldoValue)}
                tone={isToPay ? 'negative' : 'positive'}
                caption={isToPay ? 'Tributo a enterar al SII' : 'Devolución estimada'}
              />
            </div>
          </section>

          <RuleOrnament ornament="diamond" />

          {/* II — Detalle */}
          <section>
            <div className="flex items-end justify-between mb-4">
              <div>
                <span className="eyebrow block mb-1">II · Detalle</span>
                <h3 className="font-display text-2xl font-semibold tracking-tightest">
                  Líneas F22 — {data.year}
                </h3>
              </div>
              <span className="text-xs text-muted-foreground/60 font-mono">
                {data.lines.length} códigos
              </span>
            </div>

            <div className="card-editorial overflow-hidden">
              <table className="table-editorial">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Descripción</th>
                    <th data-numeric="true">Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {data.lines.map((line) => (
                    <tr key={line.code}>
                      <td className="font-mono">{line.code}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          {line.label}
                          {line.auto && (
                            <span className="text-[0.6rem] uppercase tracking-eyebrow text-muted-foreground/70 border border-border px-1.5 py-0.5 rounded-sm">
                              auto
                            </span>
                          )}
                        </div>
                      </td>
                      <td data-numeric="true">{fmt(line.value)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
