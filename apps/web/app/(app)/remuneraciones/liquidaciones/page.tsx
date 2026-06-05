'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Stat } from '@/components/ui/stat'
import { Button } from '@/components/ui/button'
import { ConfirmModal } from '@/components/ui/confirm-modal'
import { QueryState } from '@/components/ui/query-state'
import { Loader2, Play, FileDown, CheckCircle2 } from 'lucide-react'
import { formatCLP } from '@contachile/validators'
import { usePayroll, useGeneratePayroll, useApprovePayroll } from '@/hooks/use-payroll'

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function LiquidacionesPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [confirmGenerate, setConfirmGenerate] = useState(false)
  const [confirmApprove, setConfirmApprove] = useState<string | null>(null)

  const { data, isLoading, isError, refetch } = usePayroll({ year, month })
  const generatePayroll = useGeneratePayroll()
  const approvePayroll = useApprovePayroll()

  const payrolls = data?.payrolls ?? []
  const totals = data?.totals

  const totalDescuentos = totals
    ? totals.afp + totals.salud + totals.cesantia + totals.impuesto
    : 0

  const handleGenerate = () => {
    setConfirmGenerate(false)
    generatePayroll.mutate(
      { year, month },
      {
        onSuccess: (result) => {
          toast.success(`Generadas: ${result.generated} liquidación${result.generated !== 1 ? 'es' : ''} · Saltadas: ${result.skipped}`)
        },
        onError: (e) => toast.error(e.message),
      }
    )
  }

  const handleApprove = (id: string) => {
    setConfirmApprove(null)
    approvePayroll.mutate(id, {
      onSuccess: () => {
        toast.success('Liquidación aprobada — asiento contable generado')
      },
      onError: (e) => toast.error(e.message),
    })
  }

  return (
    <div className="space-y-8 animate-fade-up">
      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-3">
            <span className="eyebrow">Remuneraciones · Liquidaciones</span>
            <span className="h-px w-10 bg-foreground/20" />
            <span className="eyebrow text-muted-foreground/60">
              {payrolls.length} ítems
            </span>
          </div>
          <h2 className="font-display text-xl md:text-2xl lg:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
            {MONTHS[month - 1]}{' '}
            <em className="text-primary not-italic font-medium">{year}</em>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Cotizaciones AFP/salud/cesantía, impuesto único progresivo y líquido. Al aprobar se genera el asiento 5100/2115/2110.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {Array.from({ length: 6 }, (_, i) => today.getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((m, i) => (
              <option key={i} value={i + 1}>{m}</option>
            ))}
          </select>
          <Button onClick={() => setConfirmGenerate(true)} disabled={generatePayroll.isPending}>
            {generatePayroll.isPending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Play className="mr-2 h-4 w-4" />}
            Generar mes
          </Button>
        </div>
      </section>

      <QueryState
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        errorMessage="No pudimos cargar las liquidaciones."
      >
        <>
          {totals && (
            <section className="grid gap-4 md:grid-cols-4">
              <Stat label="Bruto" value={formatCLP(totals.bruto)} tone="default" />
              <Stat label="Descuentos" value={formatCLP(totalDescuentos)} tone="negative" caption="AFP + salud + cesantía + impuesto" />
              <Stat label="Impuesto único" value={formatCLP(totals.impuesto)} tone="warning" />
              <Stat label="Líquido a pagar" value={formatCLP(totals.liquido)} tone="positive" />
            </section>
          )}

          <section>
            <div className="flex items-end justify-between mb-4">
              <div>
                <span className="eyebrow block mb-1">I · Detalle por trabajador</span>
                <h3 className="font-display text-2xl font-semibold tracking-tightest">
                  Liquidaciones del período
                </h3>
              </div>
            </div>

            <div className="card-editorial overflow-hidden">
              <QueryState
                isLoading={false}
                isError={false}
                isEmpty={payrolls.length === 0}
                emptyMessage="Sin liquidaciones para este período"
              >
                <div className="overflow-x-auto">
                  <table className="table-editorial">
                    <thead>
                      <tr>
                        <th>Trabajador</th>
                        <th>RUT</th>
                        <th>AFP</th>
                        <th data-numeric="true">Bruto</th>
                        <th data-numeric="true">AFP</th>
                        <th data-numeric="true">Salud</th>
                        <th data-numeric="true">Impuesto</th>
                        <th data-numeric="true">Líquido</th>
                        <th>Estado</th>
                        <th></th>
                      </tr>
                    </thead>
                    <tbody>
                      {payrolls.map((p) => (
                        <tr key={p.id}>
                          <td>{p.employee.name}</td>
                          <td className="font-mono text-xs">{p.employee.rut}</td>
                          <td className="text-muted-foreground">{p.employee.afp}</td>
                          <td data-numeric="true">{formatCLP(p.bruto)}</td>
                          <td data-numeric="true" className="text-muted-foreground">{formatCLP(p.afp)}</td>
                          <td data-numeric="true" className="text-muted-foreground">{formatCLP(p.salud)}</td>
                          <td data-numeric="true" className="text-muted-foreground">{formatCLP(p.impuesto)}</td>
                          <td data-numeric="true" className="font-semibold">{formatCLP(p.liquido)}</td>
                          <td>
                            <StatusBadge status={p.status} />
                          </td>
                          <td>
                            <div className="flex gap-1 justify-end">
                              <a
                                href={`/api/payroll/item/${p.id}/pdf`}
                                target="_blank"
                                rel="noopener"
                                className="inline-flex items-center justify-center rounded-sm h-8 w-8 text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
                                title="Descargar PDF"
                              >
                                <FileDown className="h-4 w-4" />
                              </a>
                              {p.status === 'DRAFT' && (
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setConfirmApprove(p.id)}
                                  disabled={approvePayroll.isPending}
                                  title="Aprobar"
                                  aria-label="Aprobar liquidación"
                                >
                                  <CheckCircle2 className="h-4 w-4" />
                                </Button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                      {totals && (
                        <tr className="bg-secondary/60 font-semibold">
                          <td colSpan={3} className="!text-right uppercase tracking-eyebrow text-[0.65rem] text-muted-foreground">Totales</td>
                          <td data-numeric="true">{formatCLP(totals.bruto)}</td>
                          <td data-numeric="true">{formatCLP(totals.afp)}</td>
                          <td data-numeric="true">{formatCLP(totals.salud)}</td>
                          <td data-numeric="true">{formatCLP(totals.impuesto)}</td>
                          <td data-numeric="true">{formatCLP(totals.liquido)}</td>
                          <td colSpan={2}></td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </QueryState>
            </div>
          </section>
        </>
      </QueryState>

      <ConfirmModal
        open={confirmGenerate}
        title="¿Generar liquidaciones del mes?"
        description={`Se crearán las liquidaciones de ${MONTHS[month - 1]} ${year} para todos los trabajadores activos. Si ya existen, se saltarán.`}
        confirmLabel="Sí, generar"
        onConfirm={handleGenerate}
        onCancel={() => setConfirmGenerate(false)}
      />

      <ConfirmModal
        open={!!confirmApprove}
        title="¿Aprobar esta liquidación?"
        description="Se generará el asiento contable 5100/2115/2110 automáticamente. Esta acción no se puede revertir."
        confirmLabel="Aprobar"
        onConfirm={() => confirmApprove && handleApprove(confirmApprove)}
        onCancel={() => setConfirmApprove(null)}
      />
    </div>
  )
}

const STATUS_TONE: Record<'DRAFT' | 'APPROVED' | 'PAID', string> = {
  DRAFT: 'bg-ochre/15 text-ochre',
  APPROVED: 'bg-primary/10 text-primary',
  PAID: 'bg-sage/15 text-sage',
}
const STATUS_LABEL: Record<'DRAFT' | 'APPROVED' | 'PAID', string> = {
  DRAFT: 'Borrador',
  APPROVED: 'Aprobado',
  PAID: 'Pagado',
}

function StatusBadge({ status }: { status: 'DRAFT' | 'APPROVED' | 'PAID' }) {
  return (
    <span className={`text-[0.6rem] uppercase tracking-eyebrow font-semibold rounded-sm px-1.5 py-0.5 ${STATUS_TONE[status]}`}>
      {STATUS_LABEL[status]}
    </span>
  )
}
