'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-provider'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { QueryState } from '@/components/ui/query-state'
import { Loader2, Plus, Trash2, AlertTriangle } from 'lucide-react'
import { formatCLP, parseCLP } from '@contachile/validators'
import {
  useInventoryProducts,
  useCreateProduct,
  useUpdateProduct,
  useDeactivateProduct,
  type Product,
} from '@/hooks/use-inventory-products'

export default function ProductosPage() {
  const confirm = useConfirm()
  const [search, setSearch] = useState('')
  const [activeSearch, setActiveSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Product | null>(null)

  const { data: products = [], isLoading, isError, refetch } = useInventoryProducts({
    active: !showInactive,
    search: activeSearch || undefined,
  })

  const deactivate = useDeactivateProduct()

  const handleSearch = () => setActiveSearch(search)

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: 'Desactivar producto',
      description: 'Esta acción no se puede deshacer.',
      confirmLabel: 'Desactivar',
      destructive: true,
    })
    if (!ok) return
    deactivate.mutate(id, {
      onSuccess: () => toast.success('Producto desactivado'),
      onError: (e) => toast.error(e.message),
    })
  }

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
          <h2 className="font-display text-xl md:text-2xl lg:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
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
          <QueryState
            isLoading={isLoading}
            isError={isError}
            isEmpty={products.length === 0}
            onRetry={() => refetch()}
            errorMessage="No pudimos cargar los productos."
            emptyMessage="Sin productos registrados"
          >
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
                        <td data-numeric="true">{formatCLP(p.costPrice)}</td>
                        <td data-numeric="true">{formatCLP(p.salePrice)}</td>
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
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(p.id)}
                              disabled={deactivate.isPending}
                              aria-label="Eliminar producto"
                            >
                              {deactivate.isPending ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                              ) : (
                                <Trash2 className="h-4 w-4" />
                              )}
                            </Button>
                          )}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </QueryState>
        </div>
      </section>

      {formOpen && (
        <ProductForm
          editing={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => setFormOpen(false)}
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
  const createProduct = useCreateProduct()
  const updateProduct = useUpdateProduct()

  const [form, setForm] = useState({
    code: editing?.code ?? '',
    name: editing?.name ?? '',
    description: editing?.description ?? '',
    unit: editing?.unit ?? 'unidad',
    salePrice: editing?.salePrice ?? 0,
    costPrice: editing?.costPrice ?? 0,
    initialStock: 0,
    minStock: editing?.minStock ?? 0,
    affectedIVA: editing?.affectedIVA ?? true,
  })

  const isPending = createProduct.isPending || updateProduct.isPending

  const submit = () => {
    if (editing) {
      updateProduct.mutate(
        {
          id: editing.id,
          body: {
            code: form.code,
            name: form.name,
            description: form.description || undefined,
            unit: form.unit,
            salePrice: form.salePrice,
            minStock: form.minStock,
            affectedIVA: form.affectedIVA,
          },
        },
        {
          onSuccess: () => {
            toast.success('Producto actualizado')
            onSaved()
          },
          onError: (e) => toast.error(e.message),
        }
      )
    } else {
      createProduct.mutate(
        {
          code: form.code,
          name: form.name,
          description: form.description || undefined,
          unit: form.unit,
          salePrice: form.salePrice,
          costPrice: form.costPrice,
          initialStock: form.initialStock,
          minStock: form.minStock,
          affectedIVA: form.affectedIVA,
        },
        {
          onSuccess: () => {
            toast.success('Producto creado correctamente')
            onSaved()
          },
          onError: (e) => toast.error(e.message),
        }
      )
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
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
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
          <input type="number" min={0} value={form.costPrice} onChange={(e) => setForm({ ...form, costPrice: parseCLP(e.target.value) })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" disabled={!!editing} />
          {editing && <p className="text-xs text-muted-foreground mt-1">El costo se actualiza vía movimientos</p>}
        </Field>
        <Field label="Precio venta (CLP)">
          <input type="number" min={0} value={form.salePrice} onChange={(e) => setForm({ ...form, salePrice: parseCLP(e.target.value) })} className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" />
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
