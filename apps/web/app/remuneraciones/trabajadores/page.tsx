'use client'

import { useEffect, useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Loader2, Plus, Trash2, Edit2 } from 'lucide-react'

type ContractType = 'INDEFINIDO' | 'PLAZO_FIJO' | 'HONORARIOS'
type AfpCode = 'CAPITAL' | 'CUPRUM' | 'HABITAT' | 'MODELO' | 'PLANVITAL' | 'PROVIDA' | 'UNO'
type HealthPlan = 'FONASA' | 'ISAPRE'

type Employee = {
  id: string
  rut: string
  name: string
  email?: string | null
  position: string
  startDate: string
  endDate?: string | null
  contractType: ContractType
  workHours: number
  baseSalary: number
  afp: AfpCode
  healthPlan: HealthPlan
  healthAmount?: number | null
  isActive: boolean
}

const AFPs: AfpCode[] = ['CAPITAL', 'CUPRUM', 'HABITAT', 'MODELO', 'PLANVITAL', 'PROVIDA', 'UNO']
const CONTRACT_LABEL: Record<ContractType, string> = {
  INDEFINIDO: 'Indefinido',
  PLAZO_FIJO: 'Plazo Fijo',
  HONORARIOS: 'Honorarios',
}

export default function TrabajadoresPage() {
  const [employees, setEmployees] = useState<Employee[]>([])
  const [loading, setLoading] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  const fetchEmployees = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (!showInactive) params.set('active', 'true')
      const res = await fetch(`/api/employees?${params}`)
      const data = await res.json()
      setEmployees(data.employees || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEmployees()
  }, [showInactive])

  const handleDelete = async (id: string) => {
    if (!confirm('¿Desactivar este trabajador?')) return
    await fetch(`/api/employees/${id}`, { method: 'DELETE' })
    fetchEmployees()
  }

  const format = (n: number) => `$${n.toLocaleString('es-CL')}`

  return (
    <div className="space-y-8 animate-fade-up">
      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-3">
            <span className="eyebrow">Remuneraciones · Personal</span>
            <span className="h-px w-10 bg-foreground/20" />
            <span className="eyebrow text-muted-foreground/60">
              {employees.length} {showInactive ? 'totales' : 'activos'}
            </span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
            Ficha de{' '}
            <em className="text-primary not-italic font-medium">trabajadores</em>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Datos personales, contrato, AFP y plan de salud. La generación mensual de liquidaciones lee de aquí.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Inactivos
          </label>
          <Button onClick={() => { setEditing(null); setFormOpen(true) }}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo trabajador
          </Button>
        </div>
      </section>

      <div className="card-editorial overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : employees.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-display text-lg text-muted-foreground mb-1">
              Sin trabajadores registrados
            </p>
            <p className="text-xs text-muted-foreground/70">
              Registra el primero con &ldquo;Nuevo trabajador&rdquo;.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-editorial">
              <thead>
                <tr>
                  <th>RUT</th>
                  <th>Nombre</th>
                  <th>Cargo</th>
                  <th>Contrato</th>
                  <th>AFP</th>
                  <th data-numeric="true">Sueldo</th>
                  <th>Estado</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {employees.map((e) => (
                  <tr key={e.id}>
                    <td className="font-mono text-xs">{e.rut}</td>
                    <td>{e.name}</td>
                    <td className="text-muted-foreground">{e.position}</td>
                    <td>
                      <span className="text-[0.6rem] uppercase tracking-eyebrow font-semibold rounded-sm bg-secondary px-1.5 py-0.5">
                        {CONTRACT_LABEL[e.contractType]}
                      </span>
                    </td>
                    <td className="text-muted-foreground">{e.afp}</td>
                    <td data-numeric="true" className="font-semibold">{format(e.baseSalary)}</td>
                    <td>
                      {e.isActive ? (
                        <span className="text-[0.6rem] uppercase tracking-eyebrow font-semibold rounded-sm bg-sage/15 text-sage px-1.5 py-0.5">Activo</span>
                      ) : (
                        <span className="text-[0.6rem] uppercase tracking-eyebrow font-semibold rounded-sm bg-muted text-muted-foreground px-1.5 py-0.5">Inactivo</span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(e); setFormOpen(true) }}>
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {e.isActive && (
                          <Button variant="ghost" size="sm" onClick={() => handleDelete(e.id)}>
                            <Trash2 className="h-4 w-4" />
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
        <EmployeeForm
          employee={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); fetchEmployees() }}
        />
      )}
    </div>
  )
}

function EmployeeForm({
  employee,
  onClose,
  onSaved,
}: {
  employee: Employee | null
  onClose: () => void
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    rut: employee?.rut || '',
    name: employee?.name || '',
    email: employee?.email || '',
    position: employee?.position || '',
    startDate: employee?.startDate?.slice(0, 10) || new Date().toISOString().slice(0, 10),
    contractType: employee?.contractType || ('INDEFINIDO' as ContractType),
    workHours: employee?.workHours || 45,
    baseSalary: employee?.baseSalary || 0,
    afp: employee?.afp || ('HABITAT' as AfpCode),
    healthPlan: employee?.healthPlan || ('FONASA' as HealthPlan),
    healthAmount: employee?.healthAmount || 0,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const update = (k: string, v: string | number) => setForm({ ...form, [k]: v })

  const submit = async () => {
    setError(null)
    setSaving(true)
    try {
      const payload = {
        ...form,
        email: form.email || undefined,
        healthAmount: form.healthPlan === 'ISAPRE' ? form.healthAmount : undefined,
      }
      const res = await fetch(employee ? `/api/employees/${employee.id}` : '/api/employees', {
        method: employee ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

  return (
    <Modal
      open={true}
      onClose={onClose}
      eyebrow="Remuneraciones · Trabajadores"
      title={`${employee ? 'Editar' : 'Nuevo'} trabajador`}
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
        <Input label="RUT" value={form.rut} onChange={(v) => update('rut', v)} placeholder="12.345.678-5" />
        <Input label="Nombre completo" value={form.name} onChange={(v) => update('name', v)} />
        <Input label="Email" value={form.email} onChange={(v) => update('email', v)} type="email" />
        <Input label="Cargo" value={form.position} onChange={(v) => update('position', v)} />
        <Input label="Fecha ingreso" value={form.startDate} onChange={(v) => update('startDate', v)} type="date" />
        <SelectField label="Contrato" value={form.contractType} onChange={(v) => update('contractType', v)} options={[
          ['INDEFINIDO', 'Indefinido'],
          ['PLAZO_FIJO', 'Plazo fijo'],
          ['HONORARIOS', 'Honorarios'],
        ]} />
        <Input label="Horas semanales" value={String(form.workHours)} onChange={(v) => update('workHours', Number(v))} type="number" />
        <Input label="Sueldo base (CLP)" value={String(form.baseSalary)} onChange={(v) => update('baseSalary', Number(v))} type="number" />
        <SelectField label="AFP" value={form.afp} onChange={(v) => update('afp', v)} options={AFPs.map((a) => [a, a])} />
        <SelectField label="Salud" value={form.healthPlan} onChange={(v) => update('healthPlan', v)} options={[
          ['FONASA', 'Fonasa'],
          ['ISAPRE', 'Isapre'],
        ]} />
        {form.healthPlan === 'ISAPRE' && (
          <Input
            label="Monto isapre (CLP)"
            value={String(form.healthAmount)}
            onChange={(v) => update('healthAmount', Number(v))}
            type="number"
          />
        )}

        {error && (
          <div className="col-span-2 rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div>
        )}
      </div>
    </Modal>
  )
}

function Input({
  label, value, onChange, type = 'text', placeholder,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  type?: string
  placeholder?: string
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      />
    </div>
  )
}

function SelectField({
  label, value, onChange, options,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  options: [string, string][]
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
      >
        {options.map(([v, l]) => (
          <option key={v} value={v}>{l}</option>
        ))}
      </select>
    </div>
  )
}
