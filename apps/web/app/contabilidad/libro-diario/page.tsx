'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Loader2, Plus, X } from 'lucide-react'

type Line = {
  id: string
  accountId: string
  debit: number
  credit: number
  description?: string | null
  account: { code: string; name: string }
}

type Entry = {
  id: string
  date: string
  description: string
  reference?: string | null
  source: 'manual' | 'dte' | 'purchase'
  lines: Line[]
}

type Account = { id: string; code: string; name: string; isActive: boolean }

const SOURCE_TONE: Record<Entry['source'], string> = {
  manual: 'bg-secondary text-foreground/80',
  dte: 'bg-primary/10 text-primary',
  purchase: 'bg-sage/15 text-sage',
}
const SOURCE_LABEL: Record<Entry['source'], string> = {
  manual: 'Manual',
  dte: 'DTE',
  purchase: 'Compra',
}

export default function LibroDiarioPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [source, setSource] = useState<'' | 'manual' | 'dte' | 'purchase'>('')
  const [formOpen, setFormOpen] = useState(false)
  const [detailEntry, setDetailEntry] = useState<Entry | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])

  const fetchEntries = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (source) params.set('source', source)
      const res = await fetch(`/api/accounting/journal?${params}`)
      const data = await res.json()
      setEntries(data.entries || [])
    } finally {
      setLoading(false)
    }
  }

  const fetchAccounts = async () => {
    const res = await fetch('/api/accounts?active=true')
    const data = await res.json()
    setAccounts(data.accounts || [])
  }

  useEffect(() => {
    fetchAccounts()
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [from, to, source])

  const format = (n: number) => `$${n.toLocaleString('es-CL')}`

  return (
    <div className="space-y-8 animate-fade-up">
      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-3">
            <span className="eyebrow">Contabilidad · Libro Diario</span>
            <span className="h-px w-10 bg-foreground/20" />
            <span className="eyebrow text-muted-foreground/60">
              {entries.length} {entries.length === 1 ? 'asiento' : 'asientos'}
            </span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
            Asientos{' '}
            <em className="text-primary not-italic font-medium">cronológicos</em>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Toda partida doble: DTE emitidos, compras registradas y movimientos manuales. Cada asiento debe cuadrar debe = haber.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo asiento manual
        </Button>
      </section>

      <section className="card-editorial p-5 flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <label className="text-[0.65rem] font-semibold uppercase tracking-eyebrow text-foreground/70">Desde</label>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[0.65rem] font-semibold uppercase tracking-eyebrow text-foreground/70">Hasta</label>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[0.65rem] font-semibold uppercase tracking-eyebrow text-foreground/70">Fuente</label>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as '' | 'manual' | 'dte' | 'purchase')}
          >
            <option value="">Todas</option>
            <option value="manual">Manual</option>
            <option value="dte">DTE</option>
            <option value="purchase">Compra</option>
          </select>
        </div>
        {(from || to || source) && (
          <Button variant="ghost" size="sm" onClick={() => { setFrom(''); setTo(''); setSource('') }}>
            Limpiar
          </Button>
        )}
      </section>

      <div className="card-editorial overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-display text-lg text-muted-foreground mb-1">
              Sin asientos en el período
            </p>
            <p className="text-xs text-muted-foreground/70">
              Ajusta los filtros o crea un asiento manual con &ldquo;Nuevo asiento manual&rdquo;.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-editorial">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Referencia</th>
                  <th>Fuente</th>
                  <th data-numeric="true">Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const total = e.lines.reduce((s, l) => s + l.debit, 0)
                  return (
                    <tr key={e.id}>
                      <td className="font-mono text-xs">{new Date(e.date).toLocaleDateString('es-CL')}</td>
                      <td>{e.description}</td>
                      <td className="font-mono text-xs text-muted-foreground">{e.reference || '—'}</td>
                      <td>
                        <span className={`text-[0.6rem] uppercase tracking-eyebrow font-semibold rounded-sm px-1.5 py-0.5 ${SOURCE_TONE[e.source]}`}>
                          {SOURCE_LABEL[e.source]}
                        </span>
                      </td>
                      <td data-numeric="true" className="font-semibold">{format(total)}</td>
                      <td className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => setDetailEntry(e)}>Ver</Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {detailEntry && <EntryDetailModal entry={detailEntry} onClose={() => setDetailEntry(null)} />}
      {formOpen && (
        <ManualEntryForm
          accounts={accounts}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false)
            fetchEntries()
          }}
        />
      )}
    </div>
  )
}

function EntryDetailModal({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const format = (n: number) => `$${n.toLocaleString('es-CL')}`
  const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0)
  return (
    <Modal
      open={true}
      onClose={onClose}
      eyebrow="Contabilidad · Libro Diario"
      title={`Asiento · ${new Date(entry.date).toLocaleDateString('es-CL')}`}
      description={entry.description}
      size="lg"
    >
      {entry.reference && (
        <div className="mb-3 text-xs text-muted-foreground">
          <span className="eyebrow !text-[0.55rem] mr-2">Referencia</span>
          <span className="font-mono">{entry.reference}</span>
        </div>
      )}
      <table className="table-editorial card-editorial">
        <thead>
          <tr>
            <th>Código</th>
            <th>Cuenta</th>
            <th data-numeric="true">Debe</th>
            <th data-numeric="true">Haber</th>
          </tr>
        </thead>
        <tbody>
          {entry.lines.map((l) => (
            <tr key={l.id}>
              <td className="font-mono">{l.account.code}</td>
              <td>{l.account.name}</td>
              <td data-numeric="true">{l.debit ? format(l.debit) : '—'}</td>
              <td data-numeric="true">{l.credit ? format(l.credit) : '—'}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} className="text-right font-semibold">Totales</td>
            <td data-numeric="true" className="font-semibold">{format(totalDebit)}</td>
            <td data-numeric="true" className="font-semibold">{format(totalCredit)}</td>
          </tr>
        </tfoot>
      </table>
    </Modal>
  )
}

function ManualEntryForm({
  accounts,
  onClose,
  onSaved,
}: {
  accounts: Account[]
  onClose: () => void
  onSaved: () => void
}) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [reference, setReference] = useState('')
  const [lines, setLines] = useState([
    { accountId: '', debit: 0, credit: 0 },
    { accountId: '', debit: 0, credit: 0 },
  ])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const totalDebit = lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (Number(l.credit) || 0), 0)
  const diff = totalDebit - totalCredit
  const balanced = totalDebit === totalCredit && totalDebit > 0

  const addLine = () => setLines([...lines, { accountId: '', debit: 0, credit: 0 }])
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i))
  const updateLine = (
    i: number,
    field: 'accountId' | 'debit' | 'credit',
    value: string | number
  ) => {
    setLines(lines.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)))
  }

  const submit = async () => {
    setError(null)
    if (!balanced) {
      setError('El asiento no cuadra')
      return
    }
    if (!description.trim()) {
      setError('Falta la descripción')
      return
    }
    if (lines.some((l) => !l.accountId)) {
      setError('Selecciona cuenta en todas las líneas')
      return
    }
    if (lines.some((l) => (Number(l.debit) > 0) === (Number(l.credit) > 0))) {
      setError('Cada línea debe tener debe o haber (uno y solo uno)')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/accounting/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          description,
          reference: reference || undefined,
          lines: lines.map((l) => ({
            accountId: l.accountId,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
          })),
        }),
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
    <Modal
      open={true}
      onClose={onClose}
      eyebrow="Contabilidad · Libro Diario"
      title="Nuevo asiento manual"
      description="Cada asiento debe cuadrar: la suma del debe debe ser igual a la del haber."
      size="xl"
      footer={
        <div className="flex justify-between items-center gap-2">
          <Button variant="outline" size="sm" onClick={addLine}>
            <Plus className="mr-1 h-3 w-3" /> Agregar línea
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving || !balanced}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar asiento'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 h-10 w-full px-3 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Referencia (opcional)</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="mt-1 h-10 w-full px-3 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Descripción</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 h-10 w-full px-3 text-sm"
          />
        </div>

        <table className="table-editorial card-editorial">
          <thead>
            <tr>
              <th>Cuenta</th>
              <th data-numeric="true">Debe</th>
              <th data-numeric="true">Haber</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td>
                  <select
                    value={l.accountId}
                    onChange={(e) => updateLine(i, 'accountId', e.target.value)}
                    className="h-9 w-full px-2 text-sm"
                  >
                    <option value="">— Seleccionar —</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={l.debit}
                    onChange={(e) => updateLine(i, 'debit', Number(e.target.value))}
                    className="h-9 w-full px-2 text-sm"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={l.credit}
                    onChange={(e) => updateLine(i, 'credit', Number(e.target.value))}
                    className="h-9 w-full px-2 text-sm"
                  />
                </td>
                <td className="text-right">
                  {lines.length > 2 && (
                    <Button variant="ghost" size="sm" onClick={() => removeLine(i)}>
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={balanced ? 'text-sage' : 'text-ochre'}>
              <td className="font-semibold">
                Totales {balanced ? '· cuadra' : `· diferencia ${format(Math.abs(diff))}`}
              </td>
              <td data-numeric="true" className="font-semibold">{format(totalDebit)}</td>
              <td data-numeric="true" className="font-semibold">{format(totalCredit)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        {error && (
          <div className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div>
        )}
      </div>
    </Modal>
  )
}
