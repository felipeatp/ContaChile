'use client'

import { useEffect, useState } from 'react'
import { Stat } from '@/components/ui/stat'
import { RuleOrnament } from '@/components/ui/rule-ornament'
import { Button } from '@/components/ui/button'
import { Loader2, Printer, AlertTriangle } from 'lucide-react'

type AccountRow = { accountId: string; code: string; name: string; value: number }
type Section = { total: number; rows: AccountRow[] }

type Response = {
  asOf: string
  activo: Section
  pasivo: Section
  patrimonio: Section
  utilidadEjercicio: number
  totalPasivoPatrimonio: number
  balanced: boolean
}

const fmt = (n: number) => `$ ${n.toLocaleString('es-CL')}`

export default function BalanceGeneralPage() {
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10))
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/accounting/reports/balance-sheet?asOf=${asOf}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [asOf])

  const isProfit = data ? data.utilidadEjercicio >= 0 : true

  return (
    <div className="space-y-8 animate-fade-up">
      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-3">
            <span className="eyebrow">Contabilidad · Reportes</span>
            <span className="h-px w-10 bg-foreground/20" />
            <span className="eyebrow text-muted-foreground/60">
              Al {new Date(asOf).toLocaleDateString('es-CL')}
            </span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
            Balance{' '}
            <em className="text-primary not-italic font-medium">General</em>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Activo = Pasivo + Patrimonio + Utilidad del ejercicio.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
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
          {!data.balanced && (
            <div className="flex items-start gap-3 rounded-sm border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
              <div>
                <strong>El balance no cuadra.</strong>{' '}
                Activo: <span className="font-mono tabular">{fmt(data.activo.total)}</span> ≠{' '}
                Pasivo+Patrimonio+Utilidad:{' '}
                <span className="font-mono tabular">{fmt(data.totalPasivoPatrimonio)}</span>. Diferencia:{' '}
                <span className="font-mono tabular">{fmt(Math.abs(data.activo.total - data.totalPasivoPatrimonio))}</span>.
              </div>
            </div>
          )}

          <section>
            <div className="flex items-center justify-between mb-4">
              <span className="eyebrow">I · Resumen</span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Stat label="Total Activo" value={fmt(data.activo.total)} tone="default" />
              <Stat label="Pasivo + Patrimonio" value={fmt(data.totalPasivoPatrimonio)} tone="default" />
              <Stat
                label={`${isProfit ? 'Utilidad' : 'Pérdida'} del ejercicio`}
                value={fmt(Math.abs(data.utilidadEjercicio))}
                tone={isProfit ? 'accent' : 'negative'}
              />
            </div>
          </section>

          <RuleOrnament ornament="diamond" />

          <section>
            <div className="flex items-end justify-between mb-4">
              <div>
                <span className="eyebrow block mb-1">II · Estructura</span>
                <h3 className="font-display text-2xl font-semibold tracking-tightest">
                  Activo · Pasivo · Patrimonio
                </h3>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="card-editorial overflow-hidden">
                <header className="px-5 py-3 border-b border-border bg-paper/40">
                  <span className="eyebrow">Activo</span>
                </header>
                <SectionTable section={data.activo} />
              </div>
              <div className="card-editorial overflow-hidden">
                <header className="px-5 py-3 border-b border-border bg-paper/40">
                  <span className="eyebrow">Pasivo y Patrimonio</span>
                </header>
                <table className="table-editorial">
                  <tbody>
                    <SectionRowsInline title="Pasivo" section={data.pasivo} />
                    <SectionRowsInline title="Patrimonio" section={data.patrimonio} />
                    <tr>
                      <td colSpan={2} className="py-2 px-3 eyebrow !text-[0.6rem] !text-foreground">
                        Resultado del ejercicio
                      </td>
                    </tr>
                    <tr>
                      <td className="py-1.5 px-6 italic text-muted-foreground text-sm">
                        {isProfit ? 'Utilidad' : 'Pérdida'} del ejercicio
                      </td>
                      <td data-numeric="true" className={isProfit ? 'text-sage' : 'text-rust'}>
                        {fmt(data.utilidadEjercicio)}
                      </td>
                    </tr>
                  </tbody>
                  <tfoot>
                    <tr>
                      <td className="py-3 px-3 font-bold">Total P + P + U</td>
                      <td data-numeric="true" className="text-base font-bold">
                        {fmt(data.totalPasivoPatrimonio)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}

function SectionTable({ section }: { section: Section }) {
  return (
    <table className="table-editorial">
      <tbody>
        {section.rows.length === 0 ? (
          <tr>
            <td className="p-6 text-sm text-muted-foreground italic">
              Sin cuentas con saldo.
            </td>
          </tr>
        ) : (
          section.rows.map((r) => (
            <tr key={r.accountId}>
              <td className="py-1.5 px-3 font-mono text-xs">{r.code}</td>
              <td className="py-1.5 px-3 text-sm">{r.name}</td>
              <td data-numeric="true">{fmt(r.value)}</td>
            </tr>
          ))
        )}
      </tbody>
      <tfoot>
        <tr>
          <td colSpan={2} className="py-3 px-3 font-bold">Total</td>
          <td data-numeric="true" className="text-base font-bold">
            {fmt(section.total)}
          </td>
        </tr>
      </tfoot>
    </table>
  )
}

function SectionRowsInline({ title, section }: { title: string; section: Section }) {
  return (
    <>
      <tr>
        <td colSpan={2} className="py-2 px-3 eyebrow !text-[0.6rem] !text-foreground">{title}</td>
      </tr>
      {section.rows.length === 0 ? (
        <tr>
          <td className="py-1.5 px-6 italic text-muted-foreground/60 text-xs" colSpan={2}>
            (Sin cuentas)
          </td>
        </tr>
      ) : (
        section.rows.map((r) => (
          <tr key={r.accountId}>
            <td className="py-1.5 px-6 text-sm">
              <span className="font-mono text-xs text-muted-foreground mr-2">{r.code}</span>
              {r.name}
            </td>
            <td data-numeric="true">{fmt(r.value)}</td>
          </tr>
        ))
      )}
      <tr className="bg-secondary/30 font-semibold">
        <td className="py-2 px-3">Total {title}</td>
        <td data-numeric="true">{fmt(section.total)}</td>
      </tr>
    </>
  )
}
