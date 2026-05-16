'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Stat } from '@/components/ui/stat'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Loader2, Plus, X } from 'lucide-react'

type Product = { id: string; code: string; name: string; stock: number; costPrice: number; unit: string }

type Movement = {
  id: string
  type: 'IN' | 'OUT'
  quantity: number
  unitCost: number
  reason: string
  reference?: string | null
  notes?: string | null
  createdAt: string
  balance: number
  value: number
}

export default function MovimientosPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedId, setSelectedId] = useState('')
  const [data, setData] = useState<{ product: Product; movements: Movement[] } | null>(null)
  const [loading, setLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)

  const loadProducts = async () => {
    const res = await fetch('/api/inventory/products?active=true')
    const json = await res.json()
    setProducts(json.products || [])
  }

  const loadKardex = async (id: string) => {
    if (!id) { setData(null); return }
    setLoading(true)
    try {
      const res = await fetch(`/api/inventory/movements/${id}`)
      setData(await res.json())
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  useEffect(() => {
    loadKardex(selectedId)
  }, [selectedId])

  const format = (n: number) => `$${n.toLocaleString('es-CL')}`

  return (
    <div className="space-y-8 animate-fade-up">
      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-3">
            <span className="eyebrow">Inventario · Kardex</span>
            <span className="h-px w-10 bg-foreground/20" />
            <span className="eyebrow text-muted-foreground/60">
              {products.length} productos
            </span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
            Movimientos de{' '}
            <em className="text-primary not-italic font-medium">inventario</em>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Kardex por producto: entradas (IN) recalculan costo promedio ponderado; salidas (OUT) usan snapshot.
          </p>
        </div>
        <Button onClick={() => setFormOpen(true)} disabled={!selectedId}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo movimiento
        </Button>
      </section>

      <section className="card-editorial p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="eyebrow">Selección</span>
        </div>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          className="h-10 px-3 text-sm min-w-[320px]"
        >
          <option value="">— Selecciona un producto —</option>
          {products.map((p) => (
            <option key={p.id} value={p.id}>
              {p.code} — {p.name} (stock: {p.stock})
            </option>
          ))}
        </select>
      </section>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          <section>
            <div className="flex items-center justify-between mb-4">
              <span className="eyebrow">I · Estado actual</span>
              <span className="text-xs text-muted-foreground/60 font-mono">
                {data.product.code} · {data.product.name}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Stat label="Stock actual" value={`${data.product.stock} ${data.product.unit}`} tone="default" />
              <Stat label="Costo promedio" value={format(data.product.costPrice)} tone="default" />
              <Stat
                label="Valor inventario"
                value={format(data.product.stock * data.product.costPrice)}
                tone="accent"
              />
            </div>
          </section>

          <section>
            <div className="flex items-end justify-between mb-4">
              <div>
                <span className="eyebrow block mb-1">II · Kardex</span>
                <h3 className="font-display text-2xl font-semibold tracking-tightest">
                  Movimientos del producto
                </h3>
              </div>
              <span className="text-xs text-muted-foreground/60 font-mono">
                {data.movements.length} líneas
              </span>
            </div>

            <div className="card-editorial overflow-hidden">
              {data.movements.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="font-display text-lg text-muted-foreground mb-1">
                    Sin movimientos
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="table-editorial">
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th data-numeric="true">Cantidad</th>
                        <th data-numeric="true">Costo unit.</th>
                        <th data-numeric="true">Valor</th>
                        <th>Razón</th>
                        <th>Referencia</th>
                        <th data-numeric="true">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.movements.map((m) => (
                        <tr key={m.id}>
                          <td className="text-muted-foreground">{new Date(m.createdAt).toLocaleDateString('es-CL')}</td>
                          <td>
                            <span
                              className={`text-[0.6rem] uppercase tracking-eyebrow font-semibold rounded-sm px-1.5 py-0.5 ${
                                m.type === 'IN'
                                  ? 'bg-sage/15 text-sage'
                                  : 'bg-rust/15 text-rust'
                              }`}
                            >
                              {m.type}
                            </span>
                          </td>
                          <td data-numeric="true">{m.quantity}</td>
                          <td data-numeric="true">{format(m.unitCost)}</td>
                          <td data-numeric="true">{format(m.value)}</td>
                          <td className="text-xs text-muted-foreground">{m.reason}</td>
                          <td className="font-mono text-xs text-muted-foreground">{m.reference || '—'}</td>
                          <td data-numeric="true" className="font-semibold">{m.balance}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        </>
      ) : (
        <div className="card-editorial p-12 text-center">
          <p className="font-display text-lg text-muted-foreground mb-1">
            Selecciona un producto
          </p>
          <p className="text-xs text-muted-foreground/70">
            Elige cualquier producto del catálogo para ver su kardex.
          </p>
        </div>
      )}

      {formOpen && selectedId && (
        <MovementForm
          productId={selectedId}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); loadKardex(selectedId); loadProducts() }}
        />
      )}
    </div>
  )
}

function MovementForm({
  productId,
  onClose,
  onSaved,
}: {
  productId: string
  onClose: () => void
  onSaved: () => void
}) {
  const [type, setType] = useState<'IN' | 'OUT'>('IN')
  const [quantity, setQuantity] = useState(1)
  const [unitCost, setUnitCost] = useState(0)
  const [reason, setReason] = useState('manual')
  const [notes, setNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {
        productId,
        type,
        quantity,
        reason,
        notes: notes || undefined,
      }
      if (type === 'IN') payload.unitCost = unitCost
      const res = await fetch('/api/inventory/movements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        setError((await res.json()).error || 'Error')
        return
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      eyebrow="Inventario · Kardex"
      title="Nuevo movimiento"
      description="Registra una entrada o salida manual. Las entradas recalculan el costo promedio ponderado."
      size="sm"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving || quantity === 0}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Registrar movimiento'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">Tipo</label>
          <select value={type} onChange={(e) => setType(e.target.value as 'IN' | 'OUT')} className="mt-1 h-10 w-full px-3 text-sm">
            <option value="IN">Entrada (IN) — incrementa stock</option>
            <option value="OUT">Salida (OUT) — disminuye stock</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Cantidad</label>
          <input type="number" min={1} value={quantity} onChange={(e) => setQuantity(Number(e.target.value))} className="mt-1 h-10 w-full px-3 text-sm" />
        </div>
        {type === 'IN' && (
          <div>
            <label className="text-sm font-medium">Costo unitario (CLP)</label>
            <input type="number" min={0} value={unitCost} onChange={(e) => setUnitCost(Number(e.target.value))} className="mt-1 h-10 w-full px-3 text-sm" />
            <p className="text-xs text-muted-foreground mt-1">Se recalcula costo promedio ponderado</p>
          </div>
        )}
        <div>
          <label className="text-sm font-medium">Razón</label>
          <select value={reason} onChange={(e) => setReason(e.target.value)} className="mt-1 h-10 w-full px-3 text-sm">
            <option value="manual">Manual</option>
            <option value="purchase">Compra</option>
            <option value="adjustment">Ajuste</option>
            <option value="return">Devolución</option>
          </select>
        </div>
        <div>
          <label className="text-sm font-medium">Notas (opcional)</label>
          <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} className="mt-1 h-10 w-full px-3 text-sm" />
        </div>

        {error && (
          <div className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div>
        )}
      </div>
    </Modal>
  )
}
