'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Plus, X, FileDown, Send, CheckCircle2, XCircle, FileText } from 'lucide-react'

type Status = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'INVOICED' | 'EXPIRED'

type Item = { description: string; quantity: number; unitPrice: number; totalPrice: number }

type Quote = {
  id: string
  number: number
  date: string
  validUntil?: string | null
  receiverRut: string
  receiverName: string
  receiverEmail?: string | null
  totalNet: number
  totalTax: number
  totalAmount: number
  paymentMethod: string
  notes?: string | null
  status: Status
  invoicedDocumentId?: string | null
  rejectionReason?: string | null
  items: Item[]
}

const STATUS_LABEL: Record<Status, string> = {
  DRAFT: 'Borrador',
  SENT: 'Enviada',
  ACCEPTED: 'Aceptada',
  REJECTED: 'Rechazada',
  INVOICED: 'Facturada',
  EXPIRED: 'Vencida',
}

const STATUS_COLOR: Record<Status, string> = {
  DRAFT: "bg-muted text-muted-foreground",
  SENT: "bg-ochre/15 text-ochre",
  ACCEPTED: "bg-sage/15 text-sage",
  REJECTED: "bg-rust/15 text-rust",
  INVOICED: "bg-primary/10 text-primary",
  EXPIRED: "bg-muted text-muted-foreground/70",
}

export default function CotizacionesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([])
  const [loading, setLoading] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'' | Status>('')
  const [formOpen, setFormOpen] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)

  const fetchQuotes = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/quotes?${params}`)
      const data = await res.json()
      setQuotes(data.quotes || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchQuotes()
  }, [statusFilter])

  const action = async (id: string, what: 'send' | 'accept' | 'reject' | 'to-invoice') => {
    if (what === 'to-invoice' && !confirm('¿Convertir esta cotización en factura? Se asignará folio y creará el DTE.')) return
    if (what === 'reject') {
      const reason = prompt('Motivo del rechazo (opcional):')
      setBusyId(id)
      try {
        const res = await fetch(`/api/quotes/${id}/${what}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: reason || undefined }),
        })
        if (!res.ok) alert((await res.json()).error || 'Error')
        await fetchQuotes()
      } finally {
        setBusyId(null)
      }
      return
    }
    setBusyId(id)
    try {
      const res = await fetch(`/api/quotes/${id}/${what}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        alert(data.error || 'Error')
      } else if (what === 'to-invoice' && data.document) {
        alert(`Factura creada con folio ${data.document.folio}`)
      }
      await fetchQuotes()
    } finally {
      setBusyId(null)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('¿Eliminar esta cotización?')) return
    await fetch(`/api/quotes/${id}`, { method: 'DELETE' })
    fetchQuotes()
  }

  const format = (n: number) => `$${n.toLocaleString('es-CL')}`

  return (
    <div className="space-y-8 animate-fade-up">
      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-3">
            <span className="eyebrow">Ventas · Cotizaciones</span>
            <span className="h-px w-10 bg-foreground/20" />
            <span className="eyebrow text-muted-foreground/60">
              {quotes.length} en cartera
            </span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
            Propuestas{" "}
            <em className="text-primary not-italic font-medium">comerciales</em>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Borrador → Enviada → Aceptada → Factura. Un clic para convertir.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "" | Status)}
            className="h-10 rounded-sm border border-input bg-background px-3 text-sm"
          >
            <option value="">Todas</option>
            <option value="DRAFT">Borrador</option>
            <option value="SENT">Enviada</option>
            <option value="ACCEPTED">Aceptada</option>
            <option value="REJECTED">Rechazada</option>
            <option value="INVOICED">Facturada</option>
            <option value="EXPIRED">Vencida</option>
          </select>
          <Button onClick={() => setFormOpen(true)}>
            <Plus className="mr-2 h-4 w-4" /> Nueva cotización
          </Button>
        </div>
      </section>

      <div className="card-editorial overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : quotes.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-display text-lg text-muted-foreground mb-1">
              Sin cotizaciones
            </p>
            <p className="text-xs text-muted-foreground/70">
              Crea la primera con el botón &ldquo;Nueva cotización&rdquo;.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-editorial">
              <thead>
                <tr>
                  <th data-numeric="true">N°</th>
                  <th>Fecha</th>
                  <th>Cliente</th>
                  <th data-numeric="true">Total</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {quotes.map((q) => (
                  <tr key={q.id}>
                    <td data-numeric="true" className="text-foreground font-semibold">
                      {q.number}
                    </td>
                    <td className="text-muted-foreground">
                      {new Date(q.date).toLocaleDateString("es-CL")}
                    </td>
                    <td>
                      <div className="text-foreground">{q.receiverName}</div>
                      <div className="text-xs text-muted-foreground font-mono mt-0.5">
                        {q.receiverRut}
                      </div>
                    </td>
                    <td data-numeric="true" className="font-semibold">
                      {format(q.totalAmount)}
                    </td>
                    <td>
                      <span className={`text-[0.6rem] uppercase tracking-eyebrow font-semibold rounded-sm px-2 py-1 ${STATUS_COLOR[q.status]}`}>
                        {STATUS_LABEL[q.status]}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-1 justify-end items-center">
                        <a
                          href={`/api/quotes/${q.id}/pdf`}
                          target="_blank"
                          rel="noopener"
                          className="inline-flex items-center justify-center rounded-sm h-8 px-2 text-xs hover:bg-secondary transition-colors"
                          title="Descargar PDF"
                        >
                          <FileDown className="h-4 w-4" />
                        </a>
                        {q.status === "DRAFT" && (
                          <Button size="sm" variant="ghost" disabled={busyId === q.id} onClick={() => action(q.id, "send")} title="Enviar">
                            <Send className="h-4 w-4" />
                          </Button>
                        )}
                          {(q.status === 'DRAFT' || q.status === 'SENT') && (
                            <>
                              <Button size="sm" variant="ghost" disabled={busyId === q.id} onClick={() => action(q.id, 'accept')} title="Aceptar">
                                <CheckCircle2 className="h-4 w-4" />
                              </Button>
                              <Button size="sm" variant="ghost" disabled={busyId === q.id} onClick={() => action(q.id, 'reject')} title="Rechazar">
                                <XCircle className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                          {q.status === 'ACCEPTED' && (
                            <Button size="sm" variant="ghost" disabled={busyId === q.id} onClick={() => action(q.id, 'to-invoice')} title="Convertir a factura">
                              <FileText className="h-4 w-4" />
                            </Button>
                          )}
                          {q.status === 'DRAFT' && (
                            <Button size="sm" variant="ghost" onClick={() => remove(q.id)} title="Eliminar">
                              <X className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      {formOpen && (
        <QuoteForm
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); fetchQuotes() }}
        />
      )}
    </div>
  )
}

function QuoteForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const [number, setNumber] = useState(1)
  const [receiverRut, setReceiverRut] = useState('')
  const [receiverName, setReceiverName] = useState('')
  const [receiverEmail, setReceiverEmail] = useState('')
  const [validUntil, setValidUntil] = useState('')
  const [paymentMethod, setPaymentMethod] = useState('CONTADO')
  const [notes, setNotes] = useState('')
  const [items, setItems] = useState([{ description: '', quantity: 1, unitPrice: 0 }])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const neto = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const iva = Math.floor(neto * 0.19)
  const total = neto + iva

  const updateItem = (i: number, field: 'description' | 'quantity' | 'unitPrice', value: string | number) => {
    setItems(items.map((it, idx) => idx === i ? { ...it, [field]: value } : it))
  }
  const addItem = () => setItems([...items, { description: '', quantity: 1, unitPrice: 0 }])
  const removeItem = (i: number) => setItems(items.filter((_, idx) => idx !== i))

  const submit = async () => {
    setError(null)
    if (items.length === 0 || items.some((i) => !i.description || i.unitPrice <= 0)) {
      setError('Cada item debe tener descripción y precio')
      return
    }
    setSaving(true)
    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number,
          receiverRut,
          receiverName,
          receiverEmail: receiverEmail || undefined,
          validUntil: validUntil || undefined,
          paymentMethod,
          notes: notes || undefined,
          items: items.map((i) => ({
            description: i.description,
            quantity: Number(i.quantity),
            unitPrice: Number(i.unitPrice),
          })),
        }),
      })
      if (!res.ok) {
        setError((await res.json()).error || 'Error al guardar')
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
      <div className="bg-background rounded-lg max-w-3xl w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-semibold">Nueva cotización</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-3 gap-3">
            <Field label="Número">
              <input type="number" min={1} value={number} onChange={(e) => setNumber(Number(e.target.value))} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </Field>
            <Field label="Válido hasta">
              <input type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </Field>
            <Field label="Forma de pago">
              <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                <option value="CONTADO">Contado</option>
                <option value="CREDITO 30">Crédito 30</option>
                <option value="CREDITO 60">Crédito 60</option>
              </select>
            </Field>
            <Field label="RUT cliente">
              <input type="text" value={receiverRut} onChange={(e) => setReceiverRut(e.target.value)} placeholder="12.345.678-9" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </Field>
            <Field label="Nombre cliente" className="col-span-2">
              <input type="text" value={receiverName} onChange={(e) => setReceiverName(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </Field>
            <Field label="Email cliente" className="col-span-3">
              <input type="email" value={receiverEmail} onChange={(e) => setReceiverEmail(e.target.value)} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </Field>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Items</h3>
              <Button variant="outline" size="sm" onClick={addItem}>
                <Plus className="mr-1 h-3 w-3" /> Agregar
              </Button>
            </div>
            <table className="w-full text-sm border rounded">
              <thead>
                <tr className="border-b bg-muted">
                  <th className="text-left py-2 px-3">Descripción</th>
                  <th className="text-right py-2 px-3 w-20">Cant.</th>
                  <th className="text-right py-2 px-3 w-32">Precio</th>
                  <th className="text-right py-2 px-3 w-32">Total</th>
                  <th className="py-2 px-2"></th>
                </tr>
              </thead>
              <tbody>
                {items.map((it, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-1 px-2">
                      <input type="text" value={it.description} onChange={(e) => updateItem(i, 'description', e.target.value)} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm" />
                    </td>
                    <td className="py-1 px-2">
                      <input type="number" min={1} value={it.quantity} onChange={(e) => updateItem(i, 'quantity', Number(e.target.value))} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-right" />
                    </td>
                    <td className="py-1 px-2">
                      <input type="number" min={0} value={it.unitPrice} onChange={(e) => updateItem(i, 'unitPrice', Number(e.target.value))} className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-right" />
                    </td>
                    <td className="py-1 px-2 text-right font-mono text-sm">{format(it.quantity * it.unitPrice)}</td>
                    <td className="py-1 px-2 text-right">
                      {items.length > 1 && (
                        <Button variant="ghost" size="sm" onClick={() => removeItem(i)}>
                          <X className="h-4 w-4" />
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Notas">
              <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm" />
            </Field>
            <div className="rounded-md bg-muted p-3 text-sm space-y-1">
              <div className="flex justify-between"><span>Neto</span><span className="font-mono">{format(neto)}</span></div>
              <div className="flex justify-between"><span>IVA 19%</span><span className="font-mono">{format(iva)}</span></div>
              <div className="flex justify-between font-bold border-t pt-1"><span>Total</span><span className="font-mono">{format(total)}</span></div>
            </div>
          </div>

          {error && (
            <div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button onClick={submit} disabled={saving || total === 0}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar cotización'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function Field({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="text-sm font-medium">{label}</label>
      <div className="mt-1">{children}</div>
    </div>
  )
}
