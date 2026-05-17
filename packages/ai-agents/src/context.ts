import { prisma } from '@contachile/db'

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

function nextF29DueDate(today: Date): { date: Date; daysUntil: number } {
  // F29 vence el 20 del mes siguiente al mes facturado (ajuste fin de semana fuera de scope).
  const year = today.getFullYear()
  const month = today.getMonth()
  const candidate = new Date(year, month, 20)
  if (today.getDate() > 20) candidate.setMonth(candidate.getMonth() + 1)
  const ms = candidate.getTime() - today.getTime()
  return { date: candidate, daysUntil: Math.ceil(ms / (1000 * 60 * 60 * 24)) }
}

/**
 * Construye un snapshot en markdown con el contexto actual del tenant:
 * empresa, métricas del mes en curso, próxima obligación tributaria.
 *
 * Si alguna query falla, retorna un snapshot mínimo (solo fecha) sin
 * bloquear el chat. Diseñado para inyectarse en el system prompt del LLM.
 */
export async function buildContextSnapshot(companyId: string): Promise<string> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodLabel = `${MONTHS_ES[now.getMonth()].replace(/^./, c => c.toUpperCase())} ${now.getFullYear()}`

  try {
    const [company, docs, purchases, employeesActive] = await Promise.all([
      prisma.company.findUnique({ where: { id: companyId } }),
      prisma.document.findMany({
        where: { companyId, emittedAt: { gte: startOfMonth } },
        select: { status: true, totalAmount: true, totalTax: true, totalNet: true },
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
    const { date: f29Date, daysUntil: f29Days } = nextF29DueDate(now)

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
    lines.push(`- Ventas netas acumuladas (aceptadas): ${formatCLP(ventasNeto)}`)
    lines.push(`- IVA débito acumulado: ${formatCLP(ivaDebito)}`)
    lines.push(`- Compras del mes: ${purchases.length} · IVA crédito: ${formatCLP(ivaCredito)}`)

    lines.push('')
    lines.push('### Personal')
    lines.push(`- Trabajadores activos: ${employeesActive}`)

    lines.push('')
    lines.push('### Próxima obligación')
    lines.push(`- F29 vence el ${f29Date.getDate()} de ${MONTHS_ES[f29Date.getMonth()]} (en ${f29Days} día${f29Days === 1 ? '' : 's'}).`)

    return lines.join('\n')
  } catch (err) {
    console.warn('[buildContextSnapshot] failed:', err instanceof Error ? err.message : err)
    return `## CONTEXTO\nHoy es ${formatLongDate(now)}.`
  }
}
