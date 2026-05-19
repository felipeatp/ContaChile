'use client'

import { useEffect, useState } from 'react'
import { Stat } from '@/components/ui/stat'
import { Button } from '@/components/ui/button'
import { Loader2, Building2, AlertTriangle, FileBarChart, TrendingUp } from 'lucide-react'
import Link from 'next/link'

type DashboardData = {
  companyCount: number
  upcomingAlerts: number
  overdueAlerts: number
  lastMonthRevenue: number
}

export default function ContadorDashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // TODO: Replace with real API call when multi-company endpoint exists
    setTimeout(() => {
      setData({
        companyCount: 3,
        upcomingAlerts: 2,
        overdueAlerts: 0,
        lastMonthRevenue: 12_450_000,
      })
      setLoading(false)
    }, 600)
  }, [])

  return (
    <div className="space-y-8 animate-fade-up">
      <section>
        <span className="eyebrow">Contador</span>
        <h1 className="font-display text-3xl font-semibold tracking-tightest mt-2">
          Dashboard Contable
        </h1>
        <p className="text-muted-foreground mt-2">
          Resumen de todas las empresas que gestionas.
        </p>
      </section>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando resumen...
        </div>
      )}

      {!loading && data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Empresas activas"
              value={data.companyCount.toString()}
              icon={<Building2 className="h-4 w-4" />}
            />
            <Stat
              label="Alertas próximas"
              value={data.upcomingAlerts.toString()}
              icon={<AlertTriangle className="h-4 w-4" />}
            />
            <Stat
              label="Reportes pendientes"
              value={data.overdueAlerts.toString()}
              icon={<FileBarChart className="h-4 w-4" />}
            />
            <Stat
              label="Facturación últ. mes"
              value={`$${(data.lastMonthRevenue / 1_000_000).toFixed(1)}M`}
              icon={<TrendingUp className="h-4 w-4" />}
            />
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <section className="rounded-lg border border-border p-6 space-y-4">
              <h2 className="font-display text-lg font-semibold">Accesos rápidos</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <QuickLink
                  href="/contador/contabilidad/libro-diario"
                  label="Libro Diario"
                  description="Ver asientos contables"
                />
                <QuickLink
                  href="/contador/contabilidad/reportes/balance-comprobacion"
                  label="Balance Comprobación"
                  description="Revisar saldos"
                />
                <QuickLink
                  href="/contador/impuestos/f29"
                  label="F29"
                  description="Declaraciones mensuales"
                />
                <QuickLink
                  href="/contador/tesoreria/conciliacion"
                  label="Conciliación"
                  description="Movimientos bancarios"
                />
              </div>
            </section>

            <section className="rounded-lg border border-border p-6 space-y-4">
              <h2 className="font-display text-lg font-semibold">Próximos vencimientos</h2>
              <UpcomingDueDates />
            </section>
          </div>
        </>
      )}
    </div>
  )
}

function QuickLink({ href, label, description }: { href: string; label: string; description: string }) {
  return (
    <Link
      href={href}
      className="block rounded-md border border-border p-4 hover:border-primary/50 hover:bg-secondary/30 transition-colors"
    >
      <p className="font-medium">{label}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
    </Link>
  )
}

function UpcomingDueDates() {
  const [alerts, setAlerts] = useState<Array<{ code: string; label: string; daysUntil: number }>>([])

  useEffect(() => {
    fetch('/api/alerts/upcoming')
      .then((r) => r.json())
      .then((data) => setAlerts((data.alerts || []).filter((a: { daysUntil: number }) => a.daysUntil <= 14)))
      .catch(() => setAlerts([]))
  }, [])

  if (alerts.length === 0) {
    return <p className="text-muted-foreground text-sm">No hay vencimientos próximos.</p>
  }

  return (
    <div className="space-y-2">
      {alerts.map((alert) => {
        const urgent = alert.daysUntil <= 2
        const soon = alert.daysUntil > 2 && alert.daysUntil <= 7
        const tone = urgent
          ? 'text-red-700 bg-red-50 border-red-200'
          : soon
          ? 'text-orange-700 bg-orange-50 border-orange-200'
          : 'text-amber-700 bg-amber-50 border-amber-200'
        const status = alert.daysUntil === 0
          ? 'Vence hoy'
          : alert.daysUntil < 0
          ? `Vencido hace ${Math.abs(alert.daysUntil)}d`
          : `Quedan ${alert.daysUntil}d`

        return (
          <div
            key={alert.code}
            className={`flex items-center justify-between rounded-md border p-3 text-sm ${tone}`}
          >
            <span className="font-medium">{alert.label}</span>
            <span className="text-xs">{status}</span>
          </div>
        )
      })}
    </div>
  )
}
