'use client'

import { useEffect, useState } from 'react'
import { Stat } from '@/components/ui/stat'
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
      setMessage(`Generadas: ${result.generated} · Saltadas: ${result.skipped}`)
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
  const totalDescuentos = data ? data.totals.afp + data.totals.salud + data.totals.cesantia + data.totals.impuesto : 0

  return (
    <div className="space-y-8 animate-fade-up">
      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-3">
            <span className="eyebrow">Remuneraciones · Liquidaciones</span>
            <span className="h-px w-10 bg-foreground/20" />
            <span className="eyebrow text-muted-foreground/60">
              {data?.payrolls.length ?? 0} ítems
            </span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
            {MONTHS[month - 1]}{' '}
            <em className="text-primary not-italic font-medium">{year}</em>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Cotizaciones AFP/salud/cesantía, impuesto único progresivo y líquido. Al aprobar se genera el asiento 5100/2115/2110.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {Array.from({ length: 6 }, (_, i) => today.getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
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
      </section>

      {message && (
        <div className="rounded-sm border border-foreground/10 bg-secondary px-4 py-2.5 text-xs text-foreground/80">
          {message}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          <section className="grid gap-4 md:grid-cols-4">
            <Stat label="Bruto" value={format(data.totals.bruto)} tone="default" />
            <Stat label="Descuentos" value={format(totalDescuentos)} tone="negative" caption="AFP + salud + cesantía + impuesto" />
            <Stat label="Impuesto único" value={format(data.totals.impuesto)} tone="warning" />
            <Stat label="Líquido a pagar" value={format(data.totals.liquido)} tone="positive" />
          </section>

          <section>
            <div className="flex items-end justify-between mb-4">
              <div>
                <span className="eyebrow block mb-1">I · Detalle por trabajador</span>
                <h3 className="font-display text-2xl font-semibold tracking-tightest">
                  Liquidaciones del período
                </h3>
              </div>
            </div>

            <div className="card-editorial overflow-hidden">
              {data.payrolls.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="font-display text-lg text-muted-foreground mb-1">
                    Sin liquidaciones para este período
                  </p>
                  <p className="text-xs text-muted-foreground/70">
                    Pulsa &ldquo;Generar mes&rdquo; para crear las liquidaciones de los trabajadores activos.
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-editorial">
                    <thead>
                      <tr>
                        <th>Trabajador</th>
                        <th>RUT</th>
                        <th>AFP</th>
                        <th data-numeric="true">Bruto</th>
                        <th data-numeric="true">AFP</th>
                        <th data-numeric="true">Salud</th>
                        <th data-numeric="true">Impuesto</th>
                        <th data-numeric="true">Líquido</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.payrolls.map((p) => (
                        <tr key={p.id}>
                          <td>{p.employee.name}</td>
                          <td className="font-mono text-xs">{p.employee.rut}</td>
                          <td className="text-muted-foreground">{p.employee.afp}</td>
                          <td data-numeric="true">{format(p.bruto)}</td>
                          <td data-numeric="true" className="text-muted-foreground">{format(p.afp)}</td>
                          <td data-numeric="true" className="text-muted-foreground">{format(p.salud)}</td>
                          <td data-numeric="true" className="text-muted-foreground">{format(p.impuesto)}</td>
                          <td data-numeric="true" className="font-semibold">{format(p.liquido)}</td>
                          <td>
                            <StatusBadge status={p.status} />
                          </td>
                          <td>
                            <div className="flex gap-1 justify-end">
                              <a
                                href={`/api/payroll/item/${p.id}/pdf`}
                                target="_blank"
                                rel="noopener"
                                className="inline-flex items-center justify-center rounded-sm h-8 w-8 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
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
                      <tr className="bg-secondary/60 font-semibold">
                        <td colSpan={3} className="!text-right uppercase tracking-eyebrow text-[0.65rem] text-muted-foreground">Totales</td>
                        <td data-numeric="true">{format(data.totals.bruto)}</td>
                        <td data-numeric="true">{format(data.totals.afp)}</td>
                        <td data-numeric="true">{format(data.totals.salud)}</td>
                        <td data-numeric="true">{format(data.totals.impuesto)}</td>
                        <td data-numeric="true">{format(data.totals.liquido)}</td>
                        <td colSpan={2}></td>
                      </tr>
                    </tbody>
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

const STATUS_TONE: Record<'DRAFT' | 'APPROVED' | 'PAID', string> = {
  DRAFT: 'bg-ochre/15 text-ochre',
  APPROVED: 'bg-primary/10 text-primary',
  PAID: 'bg-sage/15 text-sage',
}
const STATUS_LABEL: Record<'DRAFT' | 'APPROVED' | 'PAID', string> = {
  DRAFT: 'Borrador',
  APPROVED: 'Aprobado',
  PAID: 'Pagado',
}

function StatusBadge({ status }: { status: 'DRAFT' | 'APPROVED' | 'PAID' }) {
  return (
    <span className={`text-[0.6rem] uppercase tracking-eyebrow font-semibold rounded-sm px-1.5 py-0.5 ${STATUS_TONE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}
