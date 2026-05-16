'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Plus, X, Trash2, AlertTriangle } from 'lucide-react'

type Product = {
  id: string
  code: string
  name: string
  description?: string | null
  unit: string
  salePrice: number
  costPrice: number
  stock: number
  minStock: number
  affectedIVA: boolean
  isActive: boolean
}

export default function ProductosPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)

  const fetch_ = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (!showInactive) params.set('active', 'true')
      if (search) params.set('search', search)
      const res = await fetch(`/api/inventory/products?${params}`)
      const data = await res.json()
      setProducts(data.products || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetch_()
  }, [showInactive])

  const handleSearch = () => fetch_()
  const handleDelete = async (id: string) => {
    if (!confirm('¿Desactivar este producto?')) return
    await fetch(`/api/inventory/products/${id}`, { method: 'DELETE' })
    fetch_()
  }

  const format = (n: number) => `$${n.toLocaleString('es-CL')}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Productos</h1>
          <p className="text-sm text-muted-foreground">Catálogo con stock, costo promedio ponderado y alertas.</p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo producto
        </Button>
      </div>

      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <input
            type="text"
            placeholder="Buscar por nombre o código..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[260px]"
          />
          <Button variant="outline" onClick={handleSearch}>Buscar</Button>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Mostrar inactivos
          </label>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : products.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Sin productos.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">Código</th>
                    <th className="text-left py-2 px-3">Nombre</th>
                    <th className="text-left py-2 px-3">Unidad</th>
                    <th className="text-right py-2 px-3">Costo</th>
                    <th className="text-right py-2 px-3">Venta</th>
                    <th className="text-right py-2 px-3">Stock</th>
                    <th className="text-right py-2 px-3">Mínimo</th>
                    <th className="text-left py-2 px-3">Estado</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const low = p.minStock > 0 && p.stock <= p.minStock
                    return (
                      <tr key={p.id} className="border-b last:border-0">
                        <td className="py-2 px-3 font-mono text-xs">{p.code}</td>
                        <td className="py-2 px-3">
                          <div>{p.name}</div>
                          {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
                        </td>
                        <td className="py-2 px-3">{p.unit}</td>
                        <td className="py-2 px-3 text-right font-mono">{format(p.costPrice)}</td>
                        <td className="py-2 px-3 text-right font-mono">{format(p.salePrice)}</td>
                        <td className={`py-2 px-3 text-right font-mono font-semibold ${low ? 'text-destructive' : ''}`}>
                          {p.stock}
                          {low && <AlertTriangle className="inline h-3 w-3 ml-1" />}
                        </td>
                        <td className="py-2 px-3 text-right font-mono">{p.minStock}</td>
                        <td className="py-2 px-3">
                          {p.isActive ? (
                            <span className="text-xs rounded bg-green-100 text-green-800 px-2 py-0.5">Activo</span>
                          ) : (
                            <span className="text-xs rounded bg-muted text-muted-foreground px-2 py-0.5">Inactivo</span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">
                          {p.isActive && (
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(p.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {formOpen && (
        <ProductForm
          editing={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); fetch_() }}
        />
      )}
    </div>
  )
}

function ProductForm({
  editing,
  onClose,
  onSaved,
}: {
  editing: Product | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    code: editing?.code || '',
    name: editing?.name || '',
    description: editing?.description || '',
    unit: editing?.unit || 'unidad',
    salePrice: editing?.salePrice || 0,
    costPrice: editing?.costPrice || 0,
    initialStock: 0,
    minStock: editing?.minStock || 0,
    affectedIVA: editing?.affectedIVA ?? true,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    setError(null)
    setSaving(true)
    try {
      const url = editing ? `/api/inventory/products/${editing.id}` : '/api/inventory/products'
      const method = editing ? 'PATCH' : 'POST'
      const payload = editing
        ? {
            code: form.code,
            name: form.name,
            description: form.description || undefined,
            unit: form.unit,
            salePrice: form.salePrice,
            minStock: form.minStock,
            affectedIVA: form.affectedIVA,
          }
        : form
      const res = await fetch(url, {
        method,
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-lg max-w-2xl w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-semibold">{editing ? 'Editar' : 'Nuevo'} producto</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="p-4 grid grid-cols-2 gap-3">
          <Field label="Código">
            <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
          </Field>
          <Field label="Unidad">
            <select value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="unidad">Unidad</option>
              <option value="kg">Kilogramo</option>
              <option value="litro">Litro</option>
              <option value="metro">Metro</option>
              <option value="caja">Caja</option>
              <option value="paquete">Paquete</option>
            </select>
          </Field>
          <Field label="Nombre" className="col-span-2">
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
          </Field>
          <Field label="Descripción (opcional)" className="col-span-2">
            <input type="text" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
          </Field>
          <Field label="Precio costo (CLP)">
            <input type="number" min={0} value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: Number(e.target.value) })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" disabled={!!editing} />
            {editing && <p className="text-xs text-muted-foreground mt-1">El costo se actualiza vía movimientos</p>}
          </Field>
          <Field label="Precio venta (CLP)">
            <input type="number" min={0} value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: Number(e.target.value) })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
          </Field>
          {!editing && (
            <Field label="Stock inicial">
              <input type="number" min={0} value={form.initialStock} onChange={(e) => setForm({ ...form, initialStock: Number(e.target.value) })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
            </Field>
          )}
          <Field label="Stock mínimo (alerta)">
            <input type="number" min={0} value={form.minStock} onChange={(e) => setForm({ ...form, minStock: Number(e.target.value) })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
          </Field>
          <Field label="Afecto a IVA" className="col-span-2">
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={form.affectedIVA} onChange={(e) => setForm({ ...form, affectedIVA: e.target.checked })} />
              Sí, este producto genera IVA al vender
            </label>
          </Field>

          {error && (
            <div className="col-span-2 rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>
          )}

          <div className="col-span-2 flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button onClick={submit} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
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
