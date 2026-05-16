'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Boletas de Honorarios</h1>
          <p className="text-sm text-muted-foreground">Emitidas y recibidas con retención 13,75%.</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nueva boleta
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as '' | HonorarioType)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todas</option>
            <option value="ISSUED">Emitidas</option>
            <option value="RECEIVED">Recibidas</option>
          </select>
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
              <option key={i} value={i}>{m}</option>
            ))}
          </select>
        </CardContent>
      </Card>

      {data && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Emitidas (bruto)</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{format(data.totals.issuedGross)}</div>
              <p className="text-xs text-muted-foreground">Retención: {format(data.totals.issuedRetention)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Recibidas (bruto)</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{format(data.totals.receivedGross)}</div>
              <p className="text-xs text-muted-foreground">Retención: {format(data.totals.receivedRetention)}</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2"><CardTitle className="text-sm">Total Retenciones</CardTitle></CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {format(data.totals.issuedRetention + data.totals.receivedRetention)}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : !data || data.honorarios.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Sin boletas en el período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">Fecha</th>
                    <th className="text-left py-2 px-3">Tipo</th>
                    <th className="text-left py-2 px-3">N°</th>
                    <th className="text-left py-2 px-3">Contraparte</th>
                    <th className="text-right py-2 px-3">Bruto</th>
                    <th className="text-right py-2 px-3">Retención</th>
                    <th className="text-right py-2 px-3">Líquido</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {data.honorarios.map((h) => (
                    <tr key={h.id} className="border-b last:border-0">
                      <td className="py-2 px-3">{new Date(h.date).toLocaleDateString('es-CL')}</td>
                      <td className="py-2 px-3">
                        <span className={`text-xs rounded px-2 py-0.5 ${h.type === 'ISSUED' ? 'bg-blue-100 text-blue-800' : 'bg-purple-100 text-purple-800'}`}>
                          {h.type === 'ISSUED' ? 'Emitida' : 'Recibida'}
                        </span>
                      </td>
                      <td className="py-2 px-3 font-mono">{h.number}</td>
                      <td className="py-2 px-3">
                        <div>{h.counterpartName}</div>
                        <div className="text-xs text-muted-foreground font-mono">{h.counterpartRut}</div>
                      </td>
                      <td className="py-2 px-3 text-right font-mono">{format(h.grossAmount)}</td>
                      <td className="py-2 px-3 text-right font-mono">{format(h.retentionAmount)}</td>
                      <td className="py-2 px-3 text-right font-mono font-semibold">{format(h.netAmount)}</td>
                      <td className="py-2 px-3 text-right">
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
        </CardContent>
      </Card>

      {formOpen && (
        <HonorarioForm
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); fetchData() }}
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
