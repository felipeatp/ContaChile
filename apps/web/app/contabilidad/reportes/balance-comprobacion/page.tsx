'use client'

import { useEffect, useState } from 'react'
import { Stat } from '@/components/ui/stat'
import { Button } from '@/components/ui/button'
import { Loader2, Printer, AlertTriangle } from 'lucide-react'

type Row = {
  accountId: string
  code: string
  name: string
  type: string
  totalDebit: number
  totalCredit: number
  saldoDeudor: number
  saldoAcreedor: number
}

type Response = {
  asOf: string
  rows: Row[]
  totals: {
    totalDebit: number
    totalCredit: number
    saldoDeudor: number
    saldoAcreedor: number
    balanced: boolean
  }
}

const fmt = (n: number) => `$ ${n.toLocaleString('es-CL')}`

export default function BalanceComprobacionPage() {
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10))
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/accounting/reports/trial-balance?asOf=${asOf}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [asOf])

  return (
    <div className="space-y-8 animate-fade-up">
      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-3">
            <span className="eyebrow">Contabilidad · Reportes</span>
            <span className="h-px w-10 bg-foreground/20" />
            <span className="eyebrow text-muted-foreground/60">
              al {asOf}
            </span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
            Balance de{' '}
            <em className="text-primary not-italic font-medium">Comprobación</em>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Saldos por cuenta a la fecha de corte. Total deudor debe coincidir con total acreedor.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
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
          {!data.totals.balanced && (
            <div className="flex items-start gap-3 rounded-sm border border-destructive/40 bg-destructive/5 p-4 text-sm text-destructive">
              <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
              <div>
                <strong className="font-display text-base">Los libros no cuadran.</strong>
                <p className="mt-0.5 text-xs">
                  Diferencia: <span className="font-mono font-semibold">{fmt(Math.abs(data.totals.saldoDeudor - data.totals.saldoAcreedor))}</span>. Revisa los asientos.
                </p>
              </div>
            </div>
          )}

          <section>
            <div className="flex items-center justify-between mb-4">
              <span className="eyebrow">I · Resumen</span>
            </div>
            <div className="grid gap-4 md:grid-cols-4">
              <Stat label="Total Debe" value={fmt(data.totals.totalDebit)} tone="default" />
              <Stat label="Total Haber" value={fmt(data.totals.totalCredit)} tone="default" />
              <Stat label="Saldo Deudor" value={fmt(data.totals.saldoDeudor)} tone="positive" />
              <Stat
                label="Saldo Acreedor"
                value={fmt(data.totals.saldoAcreedor)}
                tone={data.totals.balanced ? 'positive' : 'negative'}
              />
            </div>
          </section>

          <section>
            <div className="flex items-end justify-between mb-4">
              <div>
                <span className="eyebrow block mb-1">II · Detalle por cuenta</span>
                <h3 className="font-display text-2xl font-semibold tracking-tightest">
                  Cuentas con movimiento
                </h3>
              </div>
            </div>

            <div className="card-editorial overflow-hidden">
              {data.rows.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="font-display text-lg text-muted-foreground mb-1">
                    Sin movimientos a esta fecha
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Cambia la fecha de corte o registra asientos primero.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-editorial">
                    <thead>
                      <tr>
                        <th>Código</th>
                        <th>Cuenta</th>
                        <th>Tipo</th>
                        <th data-numeric="true">Debe</th>
                        <th data-numeric="true">Haber</th>
                        <th data-numeric="true">Saldo Deudor</th>
                        <th data-numeric="true">Saldo Acreedor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((r) => (
                        <tr key={r.accountId}>
                          <td className="font-mono text-xs">{r.code}</td>
                          <td>{r.name}</td>
                          <td>
                            <span className="text-[0.6rem] uppercase tracking-eyebrow font-semibold rounded-sm bg-secondary px-1.5 py-0.5 text-foreground/70">
                              {r.type}
                            </span>
                          </td>
                          <td data-numeric="true" className="text-muted-foreground">{fmt(r.totalDebit)}</td>
                          <td data-numeric="true" className="text-muted-foreground">{fmt(r.totalCredit)}</td>
                          <td data-numeric="true" className="font-semibold">{r.saldoDeudor ? fmt(r.saldoDeudor) : '—'}</td>
                          <td data-numeric="true" className="font-semibold">{r.saldoAcreedor ? fmt(r.saldoAcreedor) : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot>
                      <tr>
                        <td colSpan={3} className="!text-right uppercase tracking-eyebrow text-[0.65rem] text-muted-foreground">Totales</td>
                        <td data-numeric="true" className="font-semibold">{fmt(data.totals.totalDebit)}</td>
                        <td data-numeric="true" className="font-semibold">{fmt(data.totals.totalCredit)}</td>
                        <td data-numeric="true" className="font-semibold">{fmt(data.totals.saldoDeudor)}</td>
                        <td data-numeric="true" className="font-semibold">{fmt(data.totals.saldoAcreedor)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      ) : null}
    </div>
  )
}
