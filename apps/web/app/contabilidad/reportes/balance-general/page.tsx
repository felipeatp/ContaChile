'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

  const format = (n: number) => `$${n.toLocaleString('es-CL')}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Balance General</h1>
          <p className="text-sm text-muted-foreground">Activo, pasivo y patrimonio a la fecha de corte.</p>
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
          {!data.balanced && (
            <div className="flex items-start gap-2 rounded-lg border border-destructive bg-destructive/10 p-4 text-sm text-destructive">
              <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
              <div>
                <strong>El balance no cuadra.</strong> Activo: {format(data.activo.total)} ≠ Pasivo+Patrimonio+Utilidad: {format(data.totalPasivoPatrimonio)}. Diferencia: {format(Math.abs(data.activo.total - data.totalPasivoPatrimonio))}.
              </div>
            </div>
          )}

          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Total Activo</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{format(data.activo.total)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Total Pasivo + Patrimonio</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{format(data.totalPasivoPatrimonio)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{data.utilidadEjercicio >= 0 ? 'Utilidad' : 'Pérdida'} del Ejercicio</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${data.utilidadEjercicio < 0 ? 'text-destructive' : 'text-green-600'}`}>
                  {format(Math.abs(data.utilidadEjercicio))}
                </div>
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Activo</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <SectionTable section={data.activo} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Pasivo y Patrimonio</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <table className="w-full text-sm">
                  <tbody>
                    <SectionRowsInline title="Pasivo" section={data.pasivo} />
                    <SectionRowsInline title="Patrimonio" section={data.patrimonio} />
                    <tr className="border-b bg-muted/50">
                      <td colSpan={2} className="py-2 px-3 font-semibold">Resultado del ejercicio</td>
                    </tr>
                    <tr className="border-b">
                      <td className="py-2 px-6 italic">
                        {data.utilidadEjercicio >= 0 ? 'Utilidad' : 'Pérdida'} del ejercicio
                      </td>
                      <td className="py-2 px-3 text-right font-mono">{format(data.utilidadEjercicio)}</td>
                    </tr>
                    <tr className="font-bold bg-muted/50">
                      <td className="py-2 px-3">Total Pasivo + Patrimonio</td>
                      <td className="py-2 px-3 text-right font-mono">{format(data.totalPasivoPatrimonio)}</td>
                    </tr>
                  </tbody>
                </table>
              </CardContent>
            </Card>
          </div>
        </>
      ) : null}
    </div>
  )
}

function SectionTable({ section }: { section: Section }) {
  const format = (n: number) => `$${n.toLocaleString('es-CL')}`
  return (
    <table className="w-full text-sm">
      <tbody>
        {section.rows.length === 0 ? (
          <tr><td className="p-6 text-sm text-muted-foreground italic">Sin cuentas con saldo.</td></tr>
        ) : (
          section.rows.map((r) => (
            <tr key={r.accountId} className="border-b last:border-0">
              <td className="py-2 px-3 font-mono">{r.code}</td>
              <td className="py-2 px-3">{r.name}</td>
              <td className="py-2 px-3 text-right font-mono">{format(r.value)}</td>
            </tr>
          ))
        )}
        <tr className="font-bold bg-muted/50">
          <td colSpan={2} className="py-2 px-3">Total</td>
          <td className="py-2 px-3 text-right font-mono">{format(section.total)}</td>
        </tr>
      </tbody>
    </table>
  )
}

function SectionRowsInline({ title, section }: { title: string; section: Section }) {
  const format = (n: number) => `$${n.toLocaleString('es-CL')}`
  return (
    <>
      <tr className="border-b bg-muted/50">
        <td colSpan={2} className="py-2 px-3 font-semibold">{title}</td>
      </tr>
      {section.rows.length === 0 ? (
        <tr className="border-b">
          <td className="py-2 px-6 italic text-muted-foreground" colSpan={2}>(Sin cuentas)</td>
        </tr>
      ) : (
        section.rows.map((r) => (
          <tr key={r.accountId} className="border-b last:border-0">
            <td className="py-2 px-6 font-mono">{r.code} {r.name}</td>
            <td className="py-2 px-3 text-right font-mono">{format(r.value)}</td>
          </tr>
        ))
      )}
      <tr className="border-b font-semibold bg-muted/30">
        <td className="py-2 px-3">Total {title}</td>
        <td className="py-2 px-3 text-right font-mono">{format(section.total)}</td>
      </tr>
    </>
  )
}
