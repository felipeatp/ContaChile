'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { useConfirm } from '@/components/ui/confirm-provider'
import { Stat } from '@/components/ui/stat'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { QueryState } from '@/components/ui/query-state'
import { Loader2, Plus, Trash2 } from 'lucide-react'
import { formatCLP, parseCLP } from '@contachile/validators'
import { RutField } from '@/components/forms/rut-field'
import {
  useHonorarios,
  useCreateHonorario,
  useDeleteHonorario,
  type HonorarioType,
  type HonorarioInput,
} from '@/hooks/use-honorarios'

const MONTHS = ['Todos', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function HonorariosPage() {
  const confirm = useConfirm()
  const today = new Date()
  const [type, setType] = useState<'' | HonorarioType>('')
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(0)
  const [formOpen, setFormOpen] = useState(false)

  const { data, isLoading, isError, refetch } = useHonorarios({ type, year, month })
  const deleteHonorario = useDeleteHonorario()

  const honorarios = data?.honorarios ?? []
  const totals = data?.totals

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: "Eliminar boleta de honorarios",
      description: "Esta acción no se puede deshacer.",
      confirmLabel: "Eliminar",
      destructive: true,
    })
    if (!ok) return
    deleteHonorario.mutate(id, {
      onSuccess: () => toast.success("Boleta eliminada"),
      onError: (e) => toast.error(e.message),
    })
  }

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
          <h2 className="font-display text-xl md:text-2xl lg:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
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

      {totals && (
        <section>
          <div className="flex items-center justify-between mb-4">
            <span className="eyebrow">I · Resumen del período</span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            <Stat
              label="Emitidas · bruto"
              value={formatCLP(totals.issuedGross)}
              caption={`Retención ${formatCLP(totals.issuedRetention)}`}
              tone="default"
            />
            <Stat
              label="Recibidas · bruto"
              value={formatCLP(totals.receivedGross)}
              caption={`Retención ${formatCLP(totals.receivedRetention)}`}
              tone="default"
            />
            <Stat
              label="Retenciones totales"
              value={formatCLP(totals.issuedRetention + totals.receivedRetention)}
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
            {honorarios.length} boletas
          </span>
        </div>

        <div className="card-editorial overflow-hidden">
          <QueryState
            isLoading={isLoading}
            isError={isError}
            isEmpty={honorarios.length === 0}
            onRetry={() => refetch()}
            errorMessage="No pudimos cargar las boletas de honorarios."
            emptyMessage="Sin boletas en el período"
          >
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
                  {honorarios.map((h) => (
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
                      <td data-numeric="true">{formatCLP(h.grossAmount)}</td>
                      <td data-numeric="true" className="text-muted-foreground">
                        {formatCLP(h.retentionAmount)}
                      </td>
                      <td data-numeric="true" className="font-semibold">
                        {formatCLP(h.netAmount)}
                      </td>
                      <td className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(h.id)}
                          disabled={deleteHonorario.isPending}
                          aria-label="Eliminar boleta de honorarios"
                        >
                          {deleteHonorario.isPending ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </QueryState>
        </div>
      </section>

      {formOpen && (
        <HonorarioForm
          onClose={() => setFormOpen(false)}
          onSaved={() => setFormOpen(false)}
        />
      )}
    </div>
  )
}

function HonorarioForm({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const createHonorario = useCreateHonorario()
  const [form, setForm] = useState<HonorarioInput>({
    type: 'RECEIVED',
    number: 1,
    date: new Date().toISOString().slice(0, 10),
    counterpartRut: '',
    counterpartName: '',
    description: '',
    grossAmount: 0,
  })

  const retention = Math.round(form.grossAmount * 0.1375)
  const net = form.grossAmount - retention

  const submit = () => {
    createHonorario.mutate(
      { ...form, description: form.description || undefined },
      {
        onSuccess: () => {
          toast.success("Boleta registrada correctamente")
          onSaved()
        },
        onError: (e) => toast.error(e.message),
      }
    )
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      eyebrow="Compras · Honorarios"
      title="Nueva boleta de honorarios"
      description="Retención automática 13,75 % sobre el monto bruto."
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={createHonorario.isPending}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={createHonorario.isPending || form.grossAmount === 0}>
            {createHonorario.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar boleta'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Tipo</label>
            <select
              value={form.type}
              onChange={(e) => setForm({ ...form, type: e.target.value as HonorarioType })}
              className="mt-1 h-10 w-full px-3 text-sm"
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
              className="mt-1 h-10 w-full px-3 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Fecha</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="mt-1 h-10 w-full px-3 text-sm"
            />
          </div>
          <div>
            <RutField
              id="counterpart-rut"
              label="RUT contraparte"
              value={form.counterpartRut}
              onChange={(v) => setForm({ ...form, counterpartRut: v })}
              required
            />
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium">Nombre contraparte</label>
            <input
              type="text"
              value={form.counterpartName}
              onChange={(e) => setForm({ ...form, counterpartName: e.target.value })}
              className="mt-1 h-10 w-full px-3 text-sm"
            />
          </div>
          <div className="col-span-2">
            <label className="text-sm font-medium">Descripción (opcional)</label>
            <input
              type="text"
              value={form.description ?? ''}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              className="mt-1 h-10 w-full px-3 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Monto bruto (CLP)</label>
            <input
              type="number"
              min={0}
              value={form.grossAmount}
              onChange={(e) => setForm({ ...form, grossAmount: parseCLP(e.target.value) })}
              className="mt-1 h-10 w-full px-3 text-sm"
            />
          </div>
          <div className="card-editorial bg-secondary/40 p-3 text-sm">
            <div className="eyebrow !text-[0.55rem] mb-1.5">Cálculo automático</div>
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Retención (13,75 %)</span>
              <span className="font-mono tabular">{formatCLP(retention)}</span>
            </div>
            <div className="flex justify-between text-sm font-semibold mt-1 pt-1 border-t border-border/50">
              <span>Líquido a pagar</span>
              <span className="font-mono tabular">{formatCLP(net)}</span>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}
