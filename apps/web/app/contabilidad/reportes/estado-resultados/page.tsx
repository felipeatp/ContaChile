'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

  const format = (n: number) => `$${n.toLocaleString('es-CL')}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Estado de Resultados</h1>
          <p className="text-sm text-muted-foreground">Pérdidas y ganancias del período.</p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <span className="text-muted-foreground">—</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
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
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Ingresos</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{format(data.ingresos.total)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Costos</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{format(data.costos.total)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Gastos</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{format(data.gastos.total)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">{data.utilidadEjercicio >= 0 ? 'Utilidad' : 'Pérdida'}</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${data.utilidadEjercicio < 0 ? 'text-destructive' : 'text-green-600'}`}>
                  {format(Math.abs(data.utilidadEjercicio))}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{data.from} → {data.to}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <table className="w-full text-sm">
                <tbody>
                  <SectionRows title="Ingresos" section={data.ingresos} sign="+" />
                  <tr className="border-y font-semibold bg-muted/30">
                    <td className="py-2 px-3" colSpan={2}>Total Ingresos</td>
                    <td className="py-2 px-3 text-right font-mono">{format(data.ingresos.total)}</td>
                  </tr>

                  <SectionRows title="Costos" section={data.costos} sign="-" />
                  <tr className="border-y font-semibold bg-muted/30">
                    <td className="py-2 px-3" colSpan={2}>Total Costos</td>
                    <td className="py-2 px-3 text-right font-mono">{format(data.costos.total)}</td>
                  </tr>

                  <tr className="border-y font-semibold">
                    <td className="py-2 px-3" colSpan={2}>Utilidad Bruta (Ingresos − Costos)</td>
                    <td className="py-2 px-3 text-right font-mono">{format(data.utilidadBruta)}</td>
                  </tr>

                  <SectionRows title="Gastos" section={data.gastos} sign="-" />
                  <tr className="border-y font-semibold bg-muted/30">
                    <td className="py-2 px-3" colSpan={2}>Total Gastos</td>
                    <td className="py-2 px-3 text-right font-mono">{format(data.gastos.total)}</td>
                  </tr>

                  <tr className={`border-y font-bold ${data.utilidadEjercicio < 0 ? 'bg-red-50' : 'bg-green-50'}`}>
                    <td className="py-3 px-3" colSpan={2}>
                      {data.utilidadEjercicio >= 0 ? 'Utilidad del Ejercicio' : 'Pérdida del Ejercicio'}
                    </td>
                    <td className="py-3 px-3 text-right font-mono">{format(data.utilidadEjercicio)}</td>
                  </tr>
                </tbody>
              </table>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}

function SectionRows({ title, section, sign }: { title: string; section: Section; sign: '+' | '-' }) {
  const format = (n: number) => `$${n.toLocaleString('es-CL')}`
  if (section.rows.length === 0) {
    return (
      <>
        <tr className="border-b bg-muted/50">
          <td colSpan={3} className="py-2 px-3 font-semibold">{title}</td>
        </tr>
        <tr className="border-b text-muted-foreground">
          <td colSpan={3} className="py-2 px-6 italic">(Sin movimientos)</td>
        </tr>
      </>
    )
  }
  return (
    <>
      <tr className="border-b bg-muted/50">
        <td colSpan={3} className="py-2 px-3 font-semibold">{title}</td>
      </tr>
      {section.rows.map((r) => (
        <tr key={r.accountId} className="border-b last:border-0">
          <td className="py-2 px-6 font-mono">{r.code}</td>
          <td className="py-2 px-3">{r.name}</td>
          <td className="py-2 px-3 text-right font-mono">{sign}{format(r.value)}</td>
        </tr>
      ))}
    </>
  )
}
