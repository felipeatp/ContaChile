'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

  const format = (n: number) => `$${n.toLocaleString('es-CL')}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Balance de Comprobación</h1>
          <p className="text-sm text-muted-foreground">Saldos por cuenta a la fecha de corte.</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={asOf}
            onChange={(e) => setAsOf(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          {!data.totals.balanced && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
              <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
              <div>
                <strong>Los libros no cuadran.</strong> Diferencia:{' '}
                {format(Math.abs(data.totals.saldoDeudor - data.totals.saldoAcreedor))}. Revisa los asientos.
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total Debe</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{format(data.totals.totalDebit)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total Haber</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{format(data.totals.totalCredit)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Saldo Deudor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{format(data.totals.saldoDeudor)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Saldo Acreedor</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{format(data.totals.saldoAcreedor)}</div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Detalle por cuenta — {data.asOf}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.rows.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">Sin movimientos a esta fecha.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3">Código</th>
                        <th className="text-left py-2 px-3">Cuenta</th>
                        <th className="text-left py-2 px-3">Tipo</th>
                        <th className="text-right py-2 px-3">Debe</th>
                        <th className="text-right py-2 px-3">Haber</th>
                        <th className="text-right py-2 px-3">Saldo Deudor</th>
                        <th className="text-right py-2 px-3">Saldo Acreedor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.rows.map((r) => (
                        <tr key={r.accountId} className="border-b last:border-0">
                          <td className="py-2 px-3 font-mono">{r.code}</td>
                          <td className="py-2 px-3">{r.name}</td>
                          <td className="py-2 px-3">
                            <span className="text-xs rounded bg-muted px-2 py-0.5">{r.type}</span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono">{format(r.totalDebit)}</td>
                          <td className="py-2 px-3 text-right font-mono">{format(r.totalCredit)}</td>
                          <td className="py-2 px-3 text-right font-mono">{r.saldoDeudor ? format(r.saldoDeudor) : '—'}</td>
                          <td className="py-2 px-3 text-right font-mono">{r.saldoAcreedor ? format(r.saldoAcreedor) : '—'}</td>
                        </tr>
                      ))}
                      <tr className="font-semibold bg-muted/50">
                        <td colSpan={3} className="py-2 px-3 text-right">Totales</td>
                        <td className="py-2 px-3 text-right font-mono">{format(data.totals.totalDebit)}</td>
                        <td className="py-2 px-3 text-right font-mono">{format(data.totals.totalCredit)}</td>
                        <td className="py-2 px-3 text-right font-mono">{format(data.totals.saldoDeudor)}</td>
                        <td className="py-2 px-3 text-right font-mono">{format(data.totals.saldoAcreedor)}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
