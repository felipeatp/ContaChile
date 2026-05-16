'use client'

import { useEffect, useState } from 'react'
import { Stat } from '@/components/ui/stat'
import { RuleOrnament } from '@/components/ui/rule-ornament'
import { Button } from '@/components/ui/button'
import { Loader2, Printer } from 'lucide-react'

type AccountRow = { accountId: string; code: string; name: string; value: number }
type Section = { total: number; rows: AccountRow[] }

type Response = {
  from: string
  to: string
  ingresos: Section
  costos: Section
  gastos: Section
  utilidadBruta: number
  utilidadEjercicio: number
}

function defaultFrom() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

function defaultTo() {
  const d = new Date()
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return last.toISOString().slice(0, 10)
}

const fmt = (n: number) => `$ ${n.toLocaleString('es-CL')}`

export default function EstadoResultadosPage() {
  const [from, setFrom] = useState(defaultFrom())
  const [to, setTo] = useState(defaultTo())
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/accounting/reports/income-statement?from=${from}&to=${to}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [from, to])

  const isProfit = data ? data.utilidadEjercicio >= 0 : true

  return (
    <div className="space-y-8 animate-fade-up">
      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-3">
            <span className="eyebrow">Contabilidad · Reportes</span>
            <span className="h-px w-10 bg-foreground/20" />
            <span className="eyebrow text-muted-foreground/60">
              {from} → {to}
            </span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
            Estado de{' '}
            <em className="text-primary not-italic font-medium">Resultados</em>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Ingresos − Costos − Gastos = Utilidad del ejercicio.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-10 px-3 text-sm"
          />
          <span className="text-muted-foreground/40 text-xs">—</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-10 px-3 text-sm"
          />
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-1.5 h-4 w-4" />
            Imprimir
          </Button>
        </div>
      </section>

      {error && (
        <div className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          <section>
            <div className="flex items-center justify-between mb-4">
              <span className="eyebrow">I · Resumen</span>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <Stat label="Ingresos" value={fmt(data.ingresos.total)} tone="positive" />
              <Stat label="Costos" value={fmt(data.costos.total)} tone="default" />
              <Stat label="Gastos" value={fmt(data.gastos.total)} tone="default" />
              <Stat
                label={isProfit ? 'Utilidad ejercicio' : 'Pérdida ejercicio'}
                value={fmt(Math.abs(data.utilidadEjercicio))}
                tone={isProfit ? 'accent' : 'negative'}
              />
            </div>
          </section>

          <RuleOrnament ornament="diamond" />

          <section>
            <div className="flex items-end justify-between mb-4">
              <div>
                <span className="eyebrow block mb-1">II · Detalle</span>
                <h3 className="font-display text-2xl font-semibold tracking-tightest">
                  Por cuenta
                </h3>
              </div>
            </div>

            <div className="card-editorial overflow-hidden">
              <table className="table-editorial">
                <tbody>
                  <SectionRows title="Ingresos" section={data.ingresos} sign="+" />
                  <tr className="bg-secondary/40 font-semibold">
                    <td className="py-2 px-3" colSpan={2}>Total Ingresos</td>
                    <td data-numeric="true">{fmt(data.ingresos.total)}</td>
                  </tr>

                  <SectionRows title="Costos" section={data.costos} sign="-" />
                  <tr className="bg-secondary/40 font-semibold">
                    <td className="py-2 px-3" colSpan={2}>Total Costos</td>
                    <td data-numeric="true">{fmt(data.costos.total)}</td>
                  </tr>

                  <tr className="font-semibold border-y-2 border-foreground/20">
                    <td className="py-2 px-3" colSpan={2}>
                      Utilidad bruta <span className="text-muted-foreground font-normal">(Ingresos − Costos)</span>
                    </td>
                    <td data-numeric="true">{fmt(data.utilidadBruta)}</td>
                  </tr>

                  <SectionRows title="Gastos" section={data.gastos} sign="-" />
                  <tr className="bg-secondary/40 font-semibold">
                    <td className="py-2 px-3" colSpan={2}>Total Gastos</td>
                    <td data-numeric="true">{fmt(data.gastos.total)}</td>
                  </tr>
                </tbody>
                <tfoot>
                  <tr className={isProfit ? 'bg-sage/10' : 'bg-rust/10'}>
                    <td className="py-3 px-3 font-bold" colSpan={2}>
                      {isProfit ? 'Utilidad del Ejercicio' : 'Pérdida del Ejercicio'}
                    </td>
                    <td
                      data-numeric="true"
                      className={`text-base font-bold ${isProfit ? 'text-sage' : 'text-rust'}`}
                    >
                      {fmt(data.utilidadEjercicio)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}

function SectionRows({
  title,
  section,
  sign,
}: {
  title: string
  section: Section
  sign: '+' | '-'
}) {
  if (section.rows.length === 0) {
    return (
      <>
        <tr>
          <td colSpan={3} className="py-2 px-3 font-semibold eyebrow !text-[0.6rem] !text-foreground">{title}</td>
        </tr>
        <tr>
          <td colSpan={3} className="py-2 px-6 italic text-muted-foreground/60 text-xs">
            (Sin movimientos)
          </td>
        </tr>
      </>
    )
  }
  return (
    <>
      <tr>
        <td colSpan={3} className="py-2 px-3 font-semibold eyebrow !text-[0.6rem] !text-foreground">{title}</td>
      </tr>
      {section.rows.map((r) => (
        <tr key={r.accountId}>
          <td className="py-1.5 px-6 font-mono text-xs">{r.code}</td>
          <td className="py-1.5 px-3 text-sm">{r.name}</td>
          <td data-numeric="true" className="py-1.5">
            <span className="text-muted-foreground/60 mr-0.5">{sign}</span>
            {fmt(r.value)}
          </td>
        </tr>
      ))}
    </>
  )
}
