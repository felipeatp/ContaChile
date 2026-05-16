'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
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
    <div className="space-y-8 animate-fade-up">
      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-3">
            <span className="eyebrow">Inventario · Catálogo</span>
            <span className="h-px w-10 bg-foreground/20" />
            <span className="eyebrow text-muted-foreground/60">
              {products.length} productos
            </span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
            Catálogo de{' '}
            <em className="text-primary not-italic font-medium">productos</em>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Stock, costo promedio ponderado y alertas de mínimo. Las salidas se descuentan automáticamente al emitir DTE.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo producto
        </Button>
      </section>

      <section className="card-editorial p-5 flex flex-wrap items-center gap-3">
        <div className="flex-1 min-w-[240px]">
          <input
            type="text"
            placeholder="Buscar por nombre o código…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="h-10 w-full px-3 text-sm"
          />
        </div>
        <Button variant="outline" onClick={handleSearch}>Buscar</Button>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(e) => setShowInactive(e.target.checked)}
          />
          Mostrar inactivos
        </label>
      </section>

      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <span className="eyebrow block mb-1">I · Listado</span>
            <h3 className="font-display text-2xl font-semibold tracking-tightest">
              Productos registrados
            </h3>
          </div>
        </div>

        <div className="card-editorial overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : products.length === 0 ? (
            <div className="p-12 text-center">
              <p className="font-display text-lg text-muted-foreground mb-1">
                Sin productos
              </p>
              <p className="text-xs text-muted-foreground/70">
                Registra el primero con &ldquo;Nuevo producto&rdquo;.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-editorial">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Nombre</th>
                    <th>Unidad</th>
                    <th data-numeric="true">Costo</th>
                    <th data-numeric="true">Venta</th>
                    <th data-numeric="true">Stock</th>
                    <th data-numeric="true">Mínimo</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((p) => {
                    const low = p.minStock > 0 && p.stock <= p.minStock
                    return (
                      <tr key={p.id}>
                        <td className="font-mono text-xs">{p.code}</td>
                        <td>
                          <div>{p.name}</div>
                          {p.description && <div className="text-xs text-muted-foreground">{p.description}</div>}
                        </td>
                        <td className="text-muted-foreground">{p.unit}</td>
                        <td data-numeric="true">{format(p.costPrice)}</td>
                        <td data-numeric="true">{format(p.salePrice)}</td>
                        <td data-numeric="true" className={`font-semibold ${low ? 'text-rust' : ''}`}>
                          <span className="inline-flex items-center gap-1">
                            {low && <AlertTriangle className="h-3 w-3" />}
                            {p.stock}
                          </span>
                        </td>
                        <td data-numeric="true" className="text-muted-foreground">{p.minStock}</td>
                        <td>
                          {p.isActive ? (
                            <span className="text-[0.6rem] uppercase tracking-eyebrow font-semibold rounded-sm bg-sage/15 text-sage px-1.5 py-0.5">Activo</span>
                          ) : (
                            <span className="text-[0.6rem] uppercase tracking-eyebrow font-semibold rounded-sm bg-muted text-muted-foreground px-1.5 py-0.5">Inactivo</span>
                          )}
                        </td>
                        <td className="text-right">
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
        </div>
      </section>

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
    <Modal
      open={true}
      onClose={onClose}
      eyebrow="Inventario · Productos"
      title={`${editing ? 'Editar' : 'Nuevo'} producto`}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
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
            <div className="col-span-2 rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div>
          )}
      </div>
    </Modal>
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
