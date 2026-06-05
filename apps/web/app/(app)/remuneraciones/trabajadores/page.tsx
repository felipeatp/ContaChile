'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Loader2, Plus, Trash2, Edit2, CheckCircle2, XCircle } from 'lucide-react'
import { formatCLP, validateRUT } from '@contachile/validators'
import { toast } from 'sonner'
import { QueryState } from '@/components/ui/query-state'
import { useConfirm } from '@/components/ui/confirm-provider'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { Field } from '@/components/ui/field'
import {
  useEmployees,
  useCreateEmployee,
  useUpdateEmployee,
  useDeleteEmployee,
  type Employee,
} from '@/hooks/use-employees'

type ContractType = 'INDEFINIDO' | 'PLAZO_FIJO' | 'HONORARIOS'
type AfpCode = 'CAPITAL' | 'CUPRUM' | 'HABITAT' | 'MODELO' | 'PLANVITAL' | 'PROVIDA' | 'UNO'
type HealthPlan = 'FONASA' | 'ISAPRE'

const AFPs: AfpCode[] = ['CAPITAL', 'CUPRUM', 'HABITAT', 'MODELO', 'PLANVITAL', 'PROVIDA', 'UNO']
const CONTRACT_LABEL: Record<ContractType, string> = {
  INDEFINIDO: 'Indefinido',
  PLAZO_FIJO: 'Plazo Fijo',
  HONORARIOS: 'Honorarios',
}

const EmployeeSchema = z.object({
  rut: z
    .string()
    .min(1, 'El RUT es obligatorio')
    .refine((v) => validateRUT(v), { message: 'RUT inválido — revisa el dígito verificador' }),
  name: z.string().min(1, 'El nombre es obligatorio'),
  email: z.string().email('Email inválido').optional().or(z.literal('')),
  position: z.string().min(1, 'El cargo es obligatorio'),
  startDate: z.string().min(1, 'La fecha de ingreso es obligatoria'),
  contractType: z.enum(['INDEFINIDO', 'PLAZO_FIJO', 'HONORARIOS']),
  workHours: z.coerce
    .number()
    .int('Debe ser un número entero')
    .min(1, 'Mínimo 1 hora')
    .max(45, 'Máximo 45 horas semanales'),
  baseSalary: z.coerce
    .number()
    .int('Debe ser un número entero')
    .min(0, 'El sueldo no puede ser negativo'),
  afp: z.enum(['CAPITAL', 'CUPRUM', 'HABITAT', 'MODELO', 'PLANVITAL', 'PROVIDA', 'UNO']),
  healthPlan: z.enum(['FONASA', 'ISAPRE']),
  healthAmount: z.coerce.number().int('Debe ser un número entero').optional(),
})

type EmployeeFormValues = z.infer<typeof EmployeeSchema>

export default function TrabajadoresPage() {
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Employee | null>(null)
  const [showInactive, setShowInactive] = useState(false)

  const { data: employees = [], isLoading, isError, refetch } = useEmployees(!showInactive)
  const deleteEmployee = useDeleteEmployee()
  const confirm = useConfirm()

  const handleDelete = async (id: string) => {
    const ok = await confirm({
      title: '¿Desactivar este trabajador?',
      description: 'El trabajador quedará inactivo y no aparecerá en las liquidaciones futuras. Puedes reactivarlo después.',
      confirmLabel: 'Desactivar',
      destructive: true,
    })
    if (!ok) return
    deleteEmployee.mutate(id, {
      onSuccess: () => toast.success('Trabajador desactivado correctamente'),
      onError: (e) => toast.error(e.message),
    })
  }

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
          <h2 className="font-display text-xl md:text-2xl lg:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
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
        <QueryState
          isLoading={isLoading}
          isError={isError}
          isEmpty={employees.length === 0}
          onRetry={() => refetch()}
          errorMessage="No pudimos cargar los trabajadores."
          emptyMessage="Sin trabajadores registrados"
        >
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
                    <td data-numeric="true" className="font-semibold">{formatCLP(e.baseSalary)}</td>
                    <td>
                      {e.isActive ? (
                        <span className="text-[0.6rem] uppercase tracking-eyebrow font-semibold rounded-sm bg-sage/15 text-sage px-1.5 py-0.5">Activo</span>
                      ) : (
                        <span className="text-[0.6rem] uppercase tracking-eyebrow font-semibold rounded-sm bg-muted text-muted-foreground px-1.5 py-0.5">Inactivo</span>
                      )}
                    </td>
                    <td className="text-right">
                      <div className="flex gap-1 justify-end">
                        <Button variant="ghost" size="sm" onClick={() => { setEditing(e); setFormOpen(true) }} aria-label="Editar trabajador">
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        {e.isActive && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(e.id)}
                            disabled={deleteEmployee.isPending}
                            aria-label="Desactivar trabajador"
                          >
                            {deleteEmployee.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </QueryState>
      </div>

      {formOpen && (
        <EmployeeForm
          employee={editing}
          onClose={() => setFormOpen(false)}
          onSaved={() => setFormOpen(false)}
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
  const createEmployee = useCreateEmployee()
  const updateEmployee = useUpdateEmployee()

  const isPending = createEmployee.isPending || updateEmployee.isPending

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<EmployeeFormValues>({
    resolver: zodResolver(EmployeeSchema),
    defaultValues: {
      rut: employee?.rut ?? '',
      name: employee?.name ?? '',
      email: employee?.email ?? '',
      position: employee?.position ?? '',
      startDate: employee?.startDate?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
      contractType: employee?.contractType ?? 'INDEFINIDO',
      workHours: employee?.workHours ?? 45,
      baseSalary: employee?.baseSalary ?? 0,
      afp: employee?.afp ?? 'HABITAT',
      healthPlan: employee?.healthPlan ?? 'FONASA',
      healthAmount: employee?.healthAmount ?? 0,
    },
  })

  const watchedRut = watch('rut')
  const watchedHealthPlan = watch('healthPlan')
  const rutIsValid = watchedRut.length >= 7 && validateRUT(watchedRut)
  const rutIsInvalid = watchedRut.length >= 7 && !validateRUT(watchedRut)

  const onSubmit = (values: EmployeeFormValues) => {
    const payload = {
      ...values,
      email: values.email || undefined,
      healthAmount: values.healthPlan === 'ISAPRE' ? values.healthAmount : undefined,
    }

    if (employee) {
      updateEmployee.mutate(
        { id: employee.id, body: payload },
        {
          onSuccess: () => {
            toast.success('Trabajador actualizado')
            onSaved()
          },
          onError: (e) => toast.error(e.message),
        }
      )
    } else {
      createEmployee.mutate(payload, {
        onSuccess: () => {
          toast.success('Trabajador registrado correctamente')
          onSaved()
        },
        onError: (e) => toast.error(e.message),
      })
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
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit(onSubmit)} disabled={isPending}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
          </Button>
        </div>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <Field
          label="RUT"
          hint="Sin puntos, con guión — ej: 12345678-5"
          error={errors.rut?.message}
          required
        >
          <div className="relative">
            <input
              {...register('rut')}
              type="text"
              placeholder="12.345.678-5"
              className="mt-0.5 h-10 w-full rounded-md border border-input bg-background px-3 pr-8 text-sm"
            />
            {rutIsValid && (
              <CheckCircle2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-sage" aria-hidden="true" />
            )}
            {rutIsInvalid && (
              <XCircle className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" aria-hidden="true" />
            )}
          </div>
        </Field>

        <Field label="Nombre completo" error={errors.name?.message} required>
          <input
            {...register('name')}
            type="text"
            className="mt-0.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </Field>

        <Field label="Email" hint="Opcional" error={errors.email?.message}>
          <input
            {...register('email')}
            type="email"
            className="mt-0.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </Field>

        <Field label="Cargo" error={errors.position?.message} required>
          <input
            {...register('position')}
            type="text"
            className="mt-0.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </Field>

        <Field label="Fecha ingreso" error={errors.startDate?.message} required>
          <input
            {...register('startDate')}
            type="date"
            className="mt-0.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </Field>

        <Field label="Tipo de contrato" error={errors.contractType?.message} required>
          <select
            {...register('contractType')}
            className="mt-0.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="INDEFINIDO">Indefinido</option>
            <option value="PLAZO_FIJO">Plazo fijo</option>
            <option value="HONORARIOS">Honorarios</option>
          </select>
        </Field>

        <Field label="Horas semanales" hint="máx. 45" error={errors.workHours?.message} required>
          <input
            {...register('workHours')}
            type="number"
            className="mt-0.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </Field>

        <Field label="Sueldo base (CLP)" hint="Bruto antes de descuentos" error={errors.baseSalary?.message} required>
          <input
            {...register('baseSalary')}
            type="number"
            className="mt-0.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          />
        </Field>

        <Field label="AFP" error={errors.afp?.message} required>
          <select
            {...register('afp')}
            className="mt-0.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            {AFPs.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
        </Field>

        <Field label="Plan de salud" error={errors.healthPlan?.message} required>
          <select
            {...register('healthPlan')}
            className="mt-0.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="FONASA">Fonasa</option>
            <option value="ISAPRE">Isapre</option>
          </select>
        </Field>

        {watchedHealthPlan === 'ISAPRE' && (
          <Field label="Monto isapre (CLP)" hint="Cotización pactada mensual" error={errors.healthAmount?.message}>
            <input
              {...register('healthAmount')}
              type="number"
              className="mt-0.5 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </Field>
        )}
      </div>
    </Modal>
  )
}
