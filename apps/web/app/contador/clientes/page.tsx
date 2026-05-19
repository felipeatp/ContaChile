'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Building2, CheckCircle, Clock, AlertTriangle } from 'lucide-react'

type ClientCompany = {
  id: string
  name: string
  rut: string
  status: 'active' | 'warning' | 'overdue'
  lastLogin: string
  pendingAlerts: number
}

const MOCK_CLIENTS: ClientCompany[] = [
  { id: '1', name: 'MiPyme SpA', rut: '76.123.456-7', status: 'active', lastLogin: 'Hoy', pendingAlerts: 1 },
  { id: '2', name: 'Constructora Norte Ltda', rut: '78.234.567-8', status: 'warning', lastLogin: 'Ayer', pendingAlerts: 3 },
  { id: '3', name: 'Consultora Sur', rut: '77.345.678-9', status: 'overdue', lastLogin: 'Hace 3 días', pendingAlerts: 5 },
]

export default function ClientesPage() {
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null)

  return (
    <div className="space-y-8 animate-fade-up">
      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <span className="eyebrow">Clientes</span>
          <h1 className="font-display text-3xl font-semibold tracking-tightest mt-2">
            Mis Empresas
          </h1>
          <p className="text-muted-foreground mt-2">
            Gestiona las empresas de tus clientes y accede a su información contable.
          </p>
        </div>
      </section>

      <div className="space-y-3">
        {MOCK_CLIENTS.map((company) => (
          <div
            key={company.id}
            onClick={() => setSelectedCompany(company.id)}
            className={`rounded-lg border p-4 cursor-pointer transition-colors ${
              selectedCompany === company.id
                ? 'border-primary bg-secondary/30'
                : 'border-border hover:border-primary/30 hover:bg-secondary/20'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-md bg-secondary flex items-center justify-center">
                  <Building2 className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <p className="font-medium">{company.name}</p>
                  <p className="text-sm text-muted-foreground">RUT {company.rut}</p>
                </div>
              </div>
              <div className="flex items-center gap-4">
                <StatusBadge status={company.status} />
                {company.pendingAlerts > 0 && (
                  <span className="text-sm text-muted-foreground">
                    {company.pendingAlerts} alerta{company.pendingAlerts > 1 ? 's' : ''}
                  </span>
                )}
                <span className="text-sm text-muted-foreground">{company.lastLogin}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {selectedCompany && (
        <div className="rounded-lg border border-border p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold">Acciones rápidas</h2>
          <div className="flex flex-wrap gap-3">
            <Button variant="outline" size="sm">
              Ver contabilidad
            </Button>
            <Button variant="outline" size="sm">
              Ver impuestos
            </Button>
            <Button variant="outline" size="sm">
              Ver alertas
            </Button>
          </div>
          <p className="text-sm text-muted-foreground">
            * En una versión futura, seleccionar una empresa activará todas las vistas contables para esa empresa.
          </p>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }: { status: ClientCompany['status'] }) {
  const config = {
    active: { icon: CheckCircle, label: 'Al día', className: 'text-green-700 bg-green-50' },
    warning: { icon: Clock, label: 'Revisar', className: 'text-orange-700 bg-orange-50' },
    overdue: { icon: AlertTriangle, label: 'Atrasado', className: 'text-red-700 bg-red-50' },
  }

  const { icon: Icon, label, className } = config[status]

  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${className}`}>
      <Icon className="h-3 w-3" />
      {label}
    </span>
  )
}
