'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, CalendarClock } from 'lucide-react'

type Alert = {
  code: string
  label: string
  description: string
  dueDate: string
  daysUntil: number
  link: string
}

export function UpcomingAlertsBanner() {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    fetch('/api/alerts/upcoming')
      .then((r) => r.json())
      .then((data) => {
        setAlerts(data.alerts || [])
        setLoaded(true)
      })
      .catch(() => setLoaded(true))
  }, [])

  if (!loaded) return null

  // Mostrar solo: vencidos (daysUntil < 0) o próximos (daysUntil <= 7)
  const relevant = alerts.filter((a) => a.daysUntil < 0 || a.daysUntil <= 7)
  if (relevant.length === 0) return null

  return (
    <div className="space-y-2">
      {relevant.map((alert) => (
        <AlertItem key={`${alert.code}-${alert.dueDate}`} alert={alert} />
      ))}
    </div>
  )
}

function AlertItem({ alert }: { alert: Alert }) {
  const dueLabel = new Date(alert.dueDate).toLocaleDateString('es-CL', {
    day: 'numeric',
    month: 'long',
  })

  const overdue = alert.daysUntil < 0
  const urgent = !overdue && alert.daysUntil <= 2
  const soon = !overdue && !urgent

  const tone = overdue
    ? { border: 'border-red-200', bg: 'bg-red-50', text: 'text-red-800', link: 'text-red-900' }
    : urgent
    ? { border: 'border-orange-200', bg: 'bg-orange-50', text: 'text-orange-800', link: 'text-orange-900' }
    : { border: 'border-amber-200', bg: 'bg-amber-50', text: 'text-amber-800', link: 'text-amber-900' }

  const Icon = overdue ? AlertTriangle : CalendarClock

  const status = overdue
    ? `Vencido hace ${Math.abs(alert.daysUntil)} día${Math.abs(alert.daysUntil) === 1 ? '' : 's'}`
    : alert.daysUntil === 0
    ? 'Vence hoy'
    : `Quedan ${alert.daysUntil} día${alert.daysUntil === 1 ? '' : 's'}`

  return (
    <div className={`rounded-lg border ${tone.border} ${tone.bg} p-4 ${tone.text} flex items-center justify-between`}>
      <div className="flex items-center space-x-3">
        <Icon className="h-5 w-5 shrink-0" />
        <div>
          <p className="font-medium">
            {alert.label} — {dueLabel}
          </p>
          <p className="text-sm">
            {status}. {alert.description}
          </p>
        </div>
      </div>
      <Link
        href={alert.link}
        className={`text-sm font-medium hover:underline ${tone.link}`}
      >
        Ver →
      </Link>
    </div>
  )
}
