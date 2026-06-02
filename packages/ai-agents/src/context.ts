import Redis from 'ioredis'
import { prisma } from '@contachile/db'

const CACHE_TTL_SECONDS = 300

function getRedisClient(): Redis | null {
  try {
    if (process.env.REDIS_URL) {
      return new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, enableReadyCheck: false, lazyConnect: true })
    }
    return new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
    })
  } catch {
    return null
  }
}

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const DAYS_ES = [
  'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado',
]

function formatLongDate(d: Date): string {
  return `${DAYS_ES[d.getDay()]} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`
}

function formatCLP(n: number): string {
  return `$${n.toLocaleString('es-CL')}`
}

function pctChange(current: number, previous: number): string {
  if (previous === 0) return current > 0 ? '+100%' : '0%'
  const pct = ((current - previous) / previous) * 100
  const sign = pct >= 0 ? '+' : ''
  return `${sign}${pct.toFixed(0)}%`
}

function nextF29DueDate(today: Date): { date: Date; daysUntil: number } {
  const year = today.getFullYear()
  const month = today.getMonth()
  const candidate = new Date(year, month, 20)
  if (today.getDate() > 20) candidate.setMonth(candidate.getMonth() + 1)
  const ms = candidate.getTime() - today.getTime()
  return { date: candidate, daysUntil: Math.ceil(ms / (1000 * 60 * 60 * 24)) }
}

function buildObligations(today: Date): string[] {
  const obligations: string[] = []
  const horizon = new Date(today.getTime() + 30 * 24 * 60 * 60 * 1000)

  const { date: f29Date, daysUntil: f29Days } = nextF29DueDate(today)
  if (f29Date <= horizon) {
    if (f29Days === 0) {
      obligations.push(`⚠️ F29 (declaración de IVA) vence HOY.`)
    } else if (f29Days < 0) {
      obligations.push(`🚨 F29 VENCIDO hace ${Math.abs(f29Days)} día${Math.abs(f29Days) === 1 ? '' : 's'}.`)
    } else {
      obligations.push(`⚠️ F29 vence el ${f29Date.getDate()} de ${MONTHS_ES[f29Date.getMonth()]} — en ${f29Days} día${f29Days === 1 ? '' : 's'}.`)
    }
  }

  // PPM vence el mismo día que el F29
  if (f29Date <= horizon && f29Days >= 0) {
    obligations.push(`⚠️ PPM (pago provisional mensual) vence el mismo día que el F29.`)
  }

  return obligations
}

/**
 * Construye un snapshot en markdown con el contexto actual del tenant:
 * empresa, métricas del mes en curso, comparación YoY y próximas obligaciones.
 *
 * Si alguna query falla, retorna un snapshot mínimo (solo fecha) sin
 * bloquear el chat. Diseñado para inyectarse en el system prompt del LLM.
 */
async function buildContextSnapshotFresh(companyId: string): Promise<string> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfSameMonthLastYear = new Date(now.getFullYear() - 1, now.getMonth(), 1)
  const endOfSameMonthLastYear = new Date(now.getFullYear() - 1, now.getMonth() + 1, 1)
  const periodLabel = `${MONTHS_ES[now.getMonth()].replace(/^./, c => c.toUpperCase())} ${now.getFullYear()}`
  const prevPeriodLabel = `${MONTHS_ES[now.getMonth()].replace(/^./, c => c.toUpperCase())} ${now.getFullYear() - 1}`

  try {
    const [company, docs, docsPrevYear, purchases, employeesActive] = await Promise.all([
      prisma.company.findUnique({ where: { id: companyId } }),
      prisma.document.findMany({
        where: { companyId, emittedAt: { gte: startOfMonth } },
        select: { status: true, totalAmount: true, totalTax: true, totalNet: true },
      }),
      prisma.document.findMany({
        where: { companyId, emittedAt: { gte: startOfSameMonthLastYear, lt: endOfSameMonthLastYear } },
        select: { status: true, totalNet: true },
      }),
      prisma.purchase.findMany({
        where: { companyId, date: { gte: startOfMonth } },
        select: { totalAmount: true, taxAmount: true, netAmount: true },
      }),
      prisma.employee.count({ where: { companyId, isActive: true } }),
    ])

    const accepted = docs.filter(d => d.status === 'ACCEPTED')
    const pending = docs.filter(d => d.status === 'PENDING')
    const rejected = docs.filter(d => d.status === 'REJECTED')
    const ventasNeto = accepted.reduce((s, d) => s + d.totalNet, 0)
    const ivaDebito = accepted.reduce((s, d) => s + d.totalTax, 0)
    const comprasNeto = purchases.reduce((s, p) => s + p.netAmount, 0)
    const ivaCredito = purchases.reduce((s, p) => s + p.taxAmount, 0)

    const acceptedPrev = docsPrevYear.filter(d => d.status === 'ACCEPTED')
    const ventasNetoPrev = acceptedPrev.reduce((s, d) => s + d.totalNet, 0)

    const obligations = buildObligations(now)

    const lines: string[] = []
    lines.push('## CONTEXTO ACTUAL')
    lines.push(`Hoy es ${formatLongDate(now)}.`)

    if (company) {
      lines.push('')
      lines.push('### Empresa')
      lines.push(`- Razón social: ${company.name}`)
      lines.push(`- RUT: ${company.rut} · Giro: ${company.giro ?? 'no declarado'}`)
      lines.push(`- Certificada SII: ${company.siiCertified ? 'sí' : 'no'}`)
    }

    lines.push('')
    lines.push(`### Estado de ${periodLabel}`)
    lines.push(`- DTE emitidos: ${docs.length} · Aceptados: ${accepted.length} · Pendientes: ${pending.length} · Rechazados: ${rejected.length}`)
    lines.push(`- Ventas netas (aceptadas): ${formatCLP(ventasNeto)}`)
    if (ventasNetoPrev > 0 || ventasNeto > 0) {
      lines.push(`  ↳ Mismo período ${prevPeriodLabel}: ${formatCLP(ventasNetoPrev)} (${pctChange(ventasNeto, ventasNetoPrev)} vs año anterior)`)
    }
    lines.push(`- IVA débito: ${formatCLP(ivaDebito)}`)
    lines.push(`- Compras del mes: ${purchases.length} · IVA crédito: ${formatCLP(ivaCredito)}`)
    lines.push(`- IVA a pagar estimado: ${formatCLP(Math.max(0, ivaDebito - ivaCredito))}`)

    lines.push('')
    lines.push('### Personal')
    lines.push(`- Trabajadores activos: ${employeesActive}`)

    if (obligations.length > 0) {
      lines.push('')
      lines.push('### Próximas obligaciones (30 días)')
      for (const ob of obligations) {
        lines.push(`- ${ob}`)
      }
    }

    return lines.join('\n')
  } catch (err) {
    return `## CONTEXTO\nHoy es ${formatLongDate(now)}.`
  }
}

export async function buildContextSnapshot(companyId: string): Promise<string> {
  const redis = getRedisClient()
  const cacheKey = `ctx:snapshot:${companyId}`

  if (redis) {
    try {
      await redis.connect().catch(() => {})
      const cached = await redis.get(cacheKey).catch(() => null)
      if (cached) {
        redis.disconnect()
        return cached
      }
    } catch {
      // Redis unavailable — proceed without cache
    }
  }

  const snapshot = await buildContextSnapshotFresh(companyId)

  if (redis) {
    try {
      await redis.set(cacheKey, snapshot, 'EX', CACHE_TTL_SECONDS).catch(() => {})
      redis.disconnect()
    } catch {
      // ignore cache write failure
    }
  }

  return snapshot
}
