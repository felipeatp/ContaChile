export type AlertCode = 'F29' | 'COTIZACIONES' | 'RETENCION_HONORARIOS'

export interface VencimientoConfig {
  code: AlertCode
  label: string
  dayOfMonth: number
  description: string
  link: string
}

export const VENCIMIENTOS_MENSUALES: VencimientoConfig[] = [
  {
    code: 'COTIZACIONES',
    label: 'Cotizaciones previsionales',
    dayOfMonth: 10,
    description: 'Pago de cotizaciones previsionales (PreviRed)',
    link: '/remuneraciones/exportaciones',
  },
  {
    code: 'RETENCION_HONORARIOS',
    label: 'Retención de honorarios',
    dayOfMonth: 12,
    description: 'Pago de retención sobre boletas de honorarios recibidas (13,75%)',
    link: '/f29',
  },
  {
    code: 'F29',
    label: 'F29 (IVA mensual)',
    dayOfMonth: 20,
    description: 'Declaración y pago F29',
    link: '/f29',
  },
]

export interface UpcomingAlert {
  code: AlertCode
  label: string
  description: string
  dueDate: Date
  daysUntil: number
  link: string
}

/**
 * Si la fecha cae en sábado, mueve al lunes (+2).
 * Si cae en domingo, mueve al lunes (+1).
 * Otros días no se modifican.
 */
export function adjustForWeekend(date: Date): Date {
  const day = date.getDay()
  if (day === 0) {
    const d = new Date(date)
    d.setDate(date.getDate() + 1)
    return d
  }
  if (day === 6) {
    const d = new Date(date)
    d.setDate(date.getDate() + 2)
    return d
  }
  return date
}

function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate())
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate())
  const diffMs = b.getTime() - a.getTime()
  return Math.round(diffMs / (1000 * 60 * 60 * 24))
}

/**
 * Devuelve los vencimientos mensuales para el mes actual y los `monthsAhead` siguientes.
 * Cada vencimiento incluye fecha ajustada por fin de semana y `daysUntil` desde `today`.
 *
 * Incluye también vencimientos pasados del mes actual si `includePastDays > 0`.
 */
export function findUpcomingDueDates(
  today: Date,
  options: { monthsAhead?: number; includePastDays?: number } = {}
): UpcomingAlert[] {
  const monthsAhead = options.monthsAhead ?? 1
  const includePastDays = options.includePastDays ?? 7

  const results: UpcomingAlert[] = []

  for (let offset = 0; offset <= monthsAhead; offset++) {
    const baseYear = today.getFullYear()
    const baseMonth = today.getMonth() + offset

    for (const cfg of VENCIMIENTOS_MENSUALES) {
      const rawDate = new Date(baseYear, baseMonth, cfg.dayOfMonth)
      const adjusted = adjustForWeekend(rawDate)
      const daysUntil = daysBetween(today, adjusted)

      if (daysUntil < -includePastDays) continue

      results.push({
        code: cfg.code,
        label: cfg.label,
        description: cfg.description,
        dueDate: adjusted,
        daysUntil,
        link: cfg.link,
      })
    }
  }

  return results.sort((a, b) => a.daysUntil - b.daysUntil)
}
