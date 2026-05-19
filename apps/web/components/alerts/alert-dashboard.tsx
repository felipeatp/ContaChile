"use client"

import { Loader2, AlertTriangle, CalendarClock } from "lucide-react"

export type UpcomingAlert = {
  code: string
  label: string
  description: string
  dueDate: string
  daysUntil: number
  link: string
}

export type HistoryAlert = {
  id: string
  alertCode: string
  dueDate: string
  daysBefore: number
  sentAt: string
}

interface AlertDashboardProps {
  upcoming: UpcomingAlert[]
  history: HistoryAlert[]
  loading?: boolean
  error?: string | null
  titlePrefix?: string
}

export function AlertDashboard({
  upcoming,
  history,
  loading,
  error,
  titlePrefix = "Operaciones",
}: AlertDashboardProps) {
  const overdue = upcoming.filter((a) => a.daysUntil < 0)
  const urgent = upcoming.filter((a) => a.daysUntil >= 0 && a.daysUntil <= 2)
  const soon = upcoming.filter((a) => a.daysUntil > 2 && a.daysUntil <= 7)

  return (
    <div className="space-y-8 animate-fade-up">
      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <span className="eyebrow">{titlePrefix}</span>
          <h1 className="font-display text-3xl font-semibold tracking-tightest mt-2">
            Alertas y Vencimientos
          </h1>
          <p className="text-muted-foreground mt-2">
            Calendario tributario y recordatorios automáticos de obligaciones legales.
          </p>
        </div>
      </section>

      {loading && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Cargando alertas...
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800">
          <p className="font-medium">Error al cargar alertas</p>
          <p className="text-sm">{error}</p>
        </div>
      )}

      {!loading && !error && (
        <>
          {/* Resumen */}
          <div className="grid gap-4 sm:grid-cols-3">
            <SummaryCard
              label="Vencidos"
              count={overdue.length}
              tone="red"
              icon={AlertTriangle}
            />
            <SummaryCard
              label="Urgentes (≤2 días)"
              count={urgent.length}
              tone="orange"
              icon={CalendarClock}
            />
            <SummaryCard
              label="Próximos (≤7 días)"
              count={soon.length}
              tone="amber"
              icon={CalendarClock}
            />
          </div>

          {/* Próximos vencimientos */}
          <section className="space-y-4">
            <h2 className="font-display text-xl font-semibold">Próximos vencimientos</h2>
            {upcoming.length === 0 ? (
              <p className="text-muted-foreground">No hay vencimientos en los próximos 90 días.</p>
            ) : (
              <div className="space-y-2">
                {upcoming.map((alert) => (
                  <AlertRow key={`${alert.code}-${alert.dueDate}`} alert={alert} />
                ))}
              </div>
            )}
          </section>

          {/* Historial */}
          <section className="space-y-4">
            <h2 className="font-display text-xl font-semibold">Historial de notificaciones</h2>
            {history.length === 0 ? (
              <p className="text-muted-foreground">Aún no se han enviado notificaciones.</p>
            ) : (
              <div className="rounded-lg border border-border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-secondary/50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium">Código</th>
                      <th className="px-4 py-2 text-left font-medium">Fecha vencimiento</th>
                      <th className="px-4 py-2 text-left font-medium">Anticipación</th>
                      <th className="px-4 py-2 text-left font-medium">Enviado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {history.map((h) => (
                      <tr key={h.id}>
                        <td className="px-4 py-2 font-medium">{h.alertCode}</td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {new Date(h.dueDate).toLocaleDateString("es-CL")}
                        </td>
                        <td className="px-4 py-2 text-muted-foreground">{h.daysBefore} días antes</td>
                        <td className="px-4 py-2 text-muted-foreground">
                          {new Date(h.sentAt).toLocaleDateString("es-CL")}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}

function SummaryCard({
  label,
  count,
  tone,
  icon: Icon,
}: {
  label: string
  count: number
  tone: "red" | "orange" | "amber"
  icon: typeof AlertTriangle
}) {
  const tones = {
    red: "border-red-200 bg-red-50 text-red-800",
    orange: "border-orange-200 bg-orange-50 text-orange-800",
    amber: "border-amber-200 bg-amber-50 text-amber-800",
  }

  return (
    <div className={`rounded-lg border p-4 ${tones[tone]}`}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="text-sm font-medium">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-bold">{count}</p>
    </div>
  )
}

function AlertRow({ alert }: { alert: UpcomingAlert }) {
  const overdue = alert.daysUntil < 0
  const urgent = !overdue && alert.daysUntil <= 2
  const soon = !overdue && !urgent && alert.daysUntil <= 7

  const tone = overdue
    ? { border: "border-red-200", bg: "bg-red-50", text: "text-red-800", badge: "bg-red-100 text-red-700" }
    : urgent
    ? { border: "border-orange-200", bg: "bg-orange-50", text: "text-orange-800", badge: "bg-orange-100 text-orange-700" }
    : soon
    ? { border: "border-amber-200", bg: "bg-amber-50", text: "text-amber-800", badge: "bg-amber-100 text-amber-700" }
    : { border: "border-border", bg: "bg-paper", text: "text-foreground", badge: "bg-secondary text-secondary-foreground" }

  const status = overdue
    ? `Vencido hace ${Math.abs(alert.daysUntil)} día${Math.abs(alert.daysUntil) === 1 ? "" : "s"}`
    : alert.daysUntil === 0
    ? "Vence hoy"
    : `Quedan ${alert.daysUntil} día${alert.daysUntil === 1 ? "" : "s"}`

  const dueLabel = new Date(alert.dueDate).toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
  })

  return (
    <div className={`rounded-lg border ${tone.border} ${tone.bg} p-4 ${tone.text} flex items-center justify-between`}>
      <div className="flex items-center gap-3">
        {overdue ? (
          <AlertTriangle className="h-5 w-5 shrink-0" />
        ) : (
          <CalendarClock className="h-5 w-5 shrink-0" />
        )}
        <div>
          <p className="font-medium">{alert.label}</p>
          <p className="text-sm opacity-90">{alert.description}</p>
          <p className="text-sm opacity-75">{dueLabel}</p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span className={`text-xs font-medium px-2 py-1 rounded-full ${tone.badge}`}>{status}</span>
      </div>
    </div>
  )
}
