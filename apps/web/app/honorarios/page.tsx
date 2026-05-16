'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Stat } from '@/components/ui/stat'
import { Button } from '@/components/ui/button'
import { Loader2, Plus, X, Trash2 } from 'lucide-react'

type HonorarioType = 'ISSUED' | 'RECEIVED'
type HonorarioStatus = 'PENDING' | 'PAID'

type Honorario = {
  id: string
  type: HonorarioType
  number: number
  date: string
  counterpartRut: string
  counterpartName: string
  description?: string | null
  grossAmount: number
  retentionAmount: number
  netAmount: number
  status: HonorarioStatus
}

type Response = {
  honorarios: Honorario[]
  totals: {
    issuedGross: number
    issuedRetention: number
    issuedNet: number
    receivedGross: number
    receivedRetention: number
    receivedNet: number
  }
}

const MONTHS = ['Todos', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function HonorariosPage() {
  const today = new Date()
  const [type, setType] = useState<'' | HonorarioType>('')
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(0)
  const [data, setData] = useState<Response | null>(null)
  const [loading, setLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (type) params.set('type', type)
      params.set('year', String(year))
      if (month > 0) params.set('month', String(month))
      const res = await fetch(`/api/honorarios?${params}`)
      setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [type, year, month])

  const handleDelete = async (id: string) => {
    if (!confirm('¿Eliminar esta boleta?')) return
    await fetch(`/api/honorarios/${id}`, { method: 'DELETE' })
    fetchData()
  }

  const format = (n: number) => `$${n.toLocaleString('es-CL')}`

  return (
    <div className="space-y-8 animate-fade-up">
      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-3">
            <span className="eyebrow">Compras · Honorarios</span>
            <span className="h-px w-10 bg-foreground/20" />
            <span className="eyebrow text-muted-foreground/60">
              Retención 13,75 %
            </span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
            Boletas{' '}
            <em className="text-primary not-italic font-medium">de honorarios</em>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Emitidas y recibidas. Cálculo automático de retención y asiento contable.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as '' | HonorarioType)}
            className="h-10 rounded-sm border border-input bg-background px-3 text-sm"
          >
            <option value="">Todas</option>
            <option value="ISSUED">Emitidas</option>
            <option value="RECEIVED">Recibidas</option>
          </select>
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-10 rounded-sm border border-input bg-background px-3 text-sm"
          >
            {Array.from({ length: 6 }, (_, i) => today.getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
            className="h-10 rounded-sm border border-input bg-background px-3 text-sm"
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nueva boleta
          </Button>
        </div>
      </section>

      {data && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <span className="eyebrow">I · Resumen del período</span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Stat
              label="Emitidas · bruto"
              value={format(data.totals.issuedGross)}
              caption={`Retención ${format(data.totals.issuedRetention)}`}
              tone="default"
            />
            <Stat
              label="Recibidas · bruto"
              value={format(data.totals.receivedGross)}
              caption={`Retención ${format(data.totals.receivedRetention)}`}
              tone="default"
            />
            <Stat
              label="Retenciones totales"
              value={format(data.totals.issuedRetention + data.totals.receivedRetention)}
              tone="accent"
              caption="13,75 % sobre montos brutos"
            />
          </div>
        </section>
      )}

      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <span className="eyebrow block mb-1">II · Detalle</span>
            <h3 className="font-display text-2xl font-semibold tracking-tightest">
              Boletas registradas
            </h3>
          </div>
          <span className="text-xs text-muted-foreground/60 font-mono">
            {data?.honorarios.length ?? 0} boletas
          </span>
        </div>

        <div className="card-editorial overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !data || data.honorarios.length === 0 ? (
            <div className="p-12 text-center">
              <p className="font-display text-lg text-muted-foreground mb-1">
                Sin boletas en el período
              </p>
              <p className="text-xs text-muted-foreground/70">
                Registra la primera con &ldquo;Nueva boleta&rdquo;.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-editorial">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Tipo</th>
                    <th>N°</th>
                    <th>Contraparte</th>
                    <th data-numeric="true">Bruto</th>
                    <th data-numeric="true">Retención</th>
                    <th data-numeric="true">Líquido</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {data.honorarios.map((h) => (
                    <tr key={h.id}>
                      <td className="text-muted-foreground">
                        {new Date(h.date).toLocaleDateString('es-CL')}
                      </td>
                      <td>
                        <span
                          className={`text-[0.6rem] uppercase tracking-eyebrow font-semibold rounded-sm px-2 py-1 ${
                            h.type === 'ISSUED'
                              ? 'bg-primary/10 text-primary'
                              : 'bg-ochre/15 text-ochre'
                          }`}
                        >
                          {h.type === 'ISSUED' ? 'Emitida' : 'Recibida'}
                        </span>
                      </td>
                      <td className="font-mono">{h.number}</td>
                      <td>
                        <div className="text-foreground">{h.counterpartName}</div>
                        <div className="text-xs text-muted-foreground font-mono mt-0.5">
                          {h.counterpartRut}
                        </div>
                      </td>
                      <td data-numeric="true">{format(h.grossAmount)}</td>
                      <td data-numeric="true" className="text-muted-foreground">
                        {format(h.retentionAmount)}
                      </td>
                      <td data-numeric="true" className="font-semibold">
                        {format(h.netAmount)}
                      </td>
                      <td className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => handleDelete(h.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>

      {formOpen && (
        <HonorarioForm
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false)
            fetchData()
          }}
        />
      )}
    </div>
  )
}

function HonorarioForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [form, setForm] = useState({
    type: 'RECEIVED' as HonorarioType,
    number: 1,
    date: new Date().toISOString().slice(0, 10),
    counterpartRut: '',
    counterpartName: '',
    description: '',
    grossAmount: 0,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const retention = Math.round(form.grossAmount * 0.1375)
  const net = form.grossAmount - retention

  const submit = async () => {
    setError(null)
    setSaving(true)
    try {
      const res = await fetch('/api/honorarios', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, description: form.description || undefined }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Error al guardar')
        return
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const format = (n: number) => `$${n.toLocaleString('es-CL')}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-semibold">Nueva boleta de honorarios</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="p-4 space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Tipo</label>
              <select
                value={form.type}
                onChange={(e) => setForm({ ...form, type: e.target.value as HonorarioType })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="RECEIVED">Recibida (yo contrato)</option>
                <option value="ISSUED">Emitida (yo emito)</option>
              </select>
            </div>
            <div>
              <label className="text-sm font-medium">Número</label>
              <input
                type="number"
                min={1}
                value={form.number}
                onChange={(e) => setForm({ ...form, number: Number(e.target.value) })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Fecha</label>
              <input
                type="date"
                value={form.date}
                onChange={(e) => setForm({ ...form, date: e.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">RUT contraparte</label>
              <input
                type="text"
                value={form.counterpartRut}
                onChange={(e) => setForm({ ...form, counterpartRut: e.target.value })}
                placeholder="12.345.678-9"
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium">Nombre contraparte</label>
              <input
                type="text"
                value={form.counterpartName}
                onChange={(e) => setForm({ ...form, counterpartName: e.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="col-span-2">
              <label className="text-sm font-medium">Descripción (opcional)</label>
              <input
                type="text"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Monto bruto (CLP)</label>
              <input
                type="number"
                min={0}
                value={form.grossAmount}
                onChange={(e) => setForm({ ...form, grossAmount: Number(e.target.value) })}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div className="rounded-md bg-muted p-3 text-sm">
              <div className="font-medium">Cálculo automático</div>
              <div>Retención (13,75%): {format(retention)}</div>
              <div className="font-semibold">Líquido a pagar: {format(net)}</div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button onClick={submit} disabled={saving || form.grossAmount === 0}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar boleta'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
