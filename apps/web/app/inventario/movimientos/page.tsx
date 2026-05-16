'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Movimientos de inventario</h1>
          <p className="text-sm text-muted-foreground">Kardex por producto: entradas (IN) y salidas (OUT).</p>
        </div>
        <Button onClick={() => setFormOpen(true)} disabled={!selectedId}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo movimiento
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Seleccionar producto</CardTitle>
        </CardHeader>
        <CardContent>
          <select
            value={selectedId}
            onChange={(e) => setSelectedId(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[300px]"
          >
            <option value="">— Selecciona un producto —</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name} (stock: {p.stock})
              </option>
            ))}
          </select>
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Stock actual</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{data.product.stock} {data.product.unit}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Costo promedio</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{format(data.product.costPrice)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Valor inventario</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{format(data.product.stock * data.product.costPrice)}</div></CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Kardex — {data.product.code} {data.product.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.movements.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">Sin movimientos.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3">Fecha</th>
                        <th className="text-left py-2 px-3">Tipo</th>
                        <th className="text-right py-2 px-3">Cantidad</th>
                        <th className="text-right py-2 px-3">Costo unit.</th>
                        <th className="text-right py-2 px-3">Valor</th>
                        <th className="text-left py-2 px-3">Razón</th>
                        <th className="text-left py-2 px-3">Referencia</th>
                        <th className="text-right py-2 px-3">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.movements.map((m) => (
                        <tr key={m.id} className="border-b last:border-0">
                          <td className="py-2 px-3">{new Date(m.createdAt).toLocaleDateString('es-CL')}</td>
                          <td className="py-2 px-3">
                            <span className={`text-xs rounded px-2 py-0.5 ${m.type === 'IN' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                              {m.type}
                            </span>
                          </td>
                          <td className="py-2 px-3 text-right font-mono">{m.quantity}</td>
                          <td className="py-2 px-3 text-right font-mono">{format(m.unitCost)}</td>
                          <td className="py-2 px-3 text-right font-mono">{format(m.value)}</td>
                          <td className="py-2 px-3 text-xs">{m.reason}</td>
                          <td className="py-2 px-3 font-mono text-xs">{m.reference || '—'}</td>
                          <td className="py-2 px-3 text-right font-mono font-semibold">{m.balance}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Selecciona un producto para ver su kardex.</p>
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
