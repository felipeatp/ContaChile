'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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

  const format = (n: number) => `$${n.toLocaleString('es-CL')}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">F22 - Declaracion Anual de Renta</h1>
          <p className="text-muted-foreground">Calculo automatico desde documentos del ano</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Renta Liquida</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{format(data.summary.rentaLiquida)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Impuesto Determinado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{format(data.summary.impuesto)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {data.summary.saldoPagar > 0 ? 'Saldo a Pagar' : 'Saldo a Devolver'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${data.summary.saldoDevolver > 0 ? 'text-green-600' : ''}`}>
                  {format(data.summary.saldoPagar > 0 ? data.summary.saldoPagar : data.summary.saldoDevolver)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Detalle F22 - {data.year}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Codigo</th>
                      <th className="text-left py-2 px-3">Descripcion</th>
                      <th className="text-right py-2 px-3">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lines.map((line) => (
                      <tr key={line.code} className="border-b last:border-0">
                        <td className="py-2 px-3 font-mono">{line.code}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            {line.label}
                            {line.auto && (
                              <span className="text-xs text-muted-foreground">(auto)</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono">{format(line.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
