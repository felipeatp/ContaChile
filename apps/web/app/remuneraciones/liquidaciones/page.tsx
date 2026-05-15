'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Play, FileDown, CheckCircle2 } from 'lucide-react'

type Payroll = {
  id: string
  year: number
  month: number
  bruto: number
  afp: number
  salud: number
  cesantia: number
  impuesto: number
  liquido: number
  status: 'DRAFT' | 'APPROVED' | 'PAID'
  employee: { rut: string; name: string; position: string; afp: string }
}

type Response = {
  payrolls: Payroll[]
  totals: {
    bruto: number
    afp: number
    salud: number
    cesantia: number
    impuesto: number
    liquido: number
  }
}

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function LiquidacionesPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

  const fetchData = async () => {
    setLoading(true)
    setMessage(null)
    try {
      const res = await fetch(`/api/payroll/${year}/${month}`)
      const json = await res.json()
      setData(json)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [year, month])

  const handleGenerate = async () => {
    setGenerating(true)
    setMessage(null)
    try {
      const res = await fetch('/api/payroll/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ year, month }),
      })
      const result = await res.json()
      if (!res.ok) {
        setMessage(`Error: ${result.error || 'desconocido'}`)
        return
      }
      setMessage(`Generadas: ${result.generated} | Saltadas: ${result.skipped}`)
      fetchData()
    } finally {
      setGenerating(false)
    }
  }

  const handleApprove = async (id: string) => {
    if (!confirm('¿Aprobar esta liquidación? Se generará el asiento contable automático.')) return
    const res = await fetch(`/api/payroll/item/${id}/approve`, { method: 'POST' })
    if (res.ok) fetchData()
    else {
      const err = await res.json()
      alert(err.error || 'Error al aprobar')
    }
  }

  const format = (n: number) => `$${n.toLocaleString('es-CL')}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Liquidaciones de sueldo</h1>
          <p className="text-sm text-muted-foreground">
            {MONTHS[month - 1]} {year}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {Array.from({ length: 6 }, (_, i) => today.getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <Button onClick={handleGenerate} disabled={generating}>
            {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Generar mes
          </Button>
        </div>
      </div>

      {message && (
        <div className="rounded-lg bg-muted px-4 py-2 text-sm">{message}</div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-4">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Total Bruto</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{format(data.totals.bruto)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Total Descuentos</CardTitle></CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {format(data.totals.afp + data.totals.salud + data.totals.cesantia + data.totals.impuesto)}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Impuesto Único</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{format(data.totals.impuesto)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Total Líquido</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{format(data.totals.liquido)}</div></CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="p-0">
              {data.payrolls.length === 0 ? (
                <div className="p-6 text-center">
                  <p className="text-sm text-muted-foreground">No hay liquidaciones para este período.</p>
                  <p className="text-xs text-muted-foreground mt-1">Hacé clic en "Generar mes" para crear las liquidaciones de los trabajadores activos.</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3">Trabajador</th>
                        <th className="text-left py-2 px-3">RUT</th>
                        <th className="text-left py-2 px-3">AFP</th>
                        <th className="text-right py-2 px-3">Bruto</th>
                        <th className="text-right py-2 px-3">AFP</th>
                        <th className="text-right py-2 px-3">Salud</th>
                        <th className="text-right py-2 px-3">Impuesto</th>
                        <th className="text-right py-2 px-3">Líquido</th>
                        <th className="text-left py-2 px-3">Estado</th>
                        <th className="py-2 px-3"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.payrolls.map((p) => (
                        <tr key={p.id} className="border-b last:border-0">
                          <td className="py-2 px-3">{p.employee.name}</td>
                          <td className="py-2 px-3 font-mono text-xs">{p.employee.rut}</td>
                          <td className="py-2 px-3">{p.employee.afp}</td>
                          <td className="py-2 px-3 text-right font-mono">{format(p.bruto)}</td>
                          <td className="py-2 px-3 text-right font-mono">{format(p.afp)}</td>
                          <td className="py-2 px-3 text-right font-mono">{format(p.salud)}</td>
                          <td className="py-2 px-3 text-right font-mono">{format(p.impuesto)}</td>
                          <td className="py-2 px-3 text-right font-mono font-semibold">{format(p.liquido)}</td>
                          <td className="py-2 px-3">
                            <StatusBadge status={p.status} />
                          </td>
                          <td className="py-2 px-3">
                            <div className="flex gap-1 justify-end">
                              <a
                                href={`/api/payroll/item/${p.id}/pdf`}
                                target="_blank"
                                rel="noopener"
                                className="inline-flex items-center justify-center rounded-md h-8 px-2 text-xs hover:bg-muted"
                                title="Descargar PDF"
                              >
                                <FileDown className="h-4 w-4" />
                              </a>
                              {p.status === 'DRAFT' && (
                                <Button variant="ghost" size="sm" onClick={() => handleApprove(p.id)} title="Aprobar">
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      <tr className="font-semibold bg-muted/50">
                        <td colSpan={3} className="py-2 px-3 text-right">Totales</td>
                        <td className="py-2 px-3 text-right font-mono">{format(data.totals.bruto)}</td>
                        <td className="py-2 px-3 text-right font-mono">{format(data.totals.afp)}</td>
                        <td className="py-2 px-3 text-right font-mono">{format(data.totals.salud)}</td>
                        <td className="py-2 px-3 text-right font-mono">{format(data.totals.impuesto)}</td>
                        <td className="py-2 px-3 text-right font-mono">{format(data.totals.liquido)}</td>
                        <td colSpan={2}></td>
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

function StatusBadge({ status }: { status: 'DRAFT' | 'APPROVED' | 'PAID' }) {
  const colors = {
    DRAFT: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-blue-100 text-blue-800',
    PAID: 'bg-green-100 text-green-800',
  }
  const labels = { DRAFT: 'Borrador', APPROVED: 'Aprobado', PAID: 'Pagado' }
  return <span className={`text-xs rounded px-2 py-0.5 ${colors[status]}`}>{labels[status]}</span>
}
