import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'

function getPeriodDates(year: number, month: number) {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)
  return { start, end }
}

function escapeCsv(value: unknown): string {
  const str = String(value ?? '')
  if (str.includes(',') || str.includes('"') || str.includes('\n')) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

interface F29Calculation {
  period: { year: number; month: number }
  sales: { count: number; neto: number; iva: number; total: number }
  purchases: { count: number; neto: number; iva: number; total: number }
  f29: Record<string, number>
}

async function calculateF29(companyId: string, year: number, month: number): Promise<F29Calculation> {
  const { start, end } = getPeriodDates(year, month)

  const [sales, purchases] = await Promise.all([
    prisma.document.findMany({
      where: {
        companyId,
        emittedAt: { gte: start, lt: end },
        status: { in: ['ACCEPTED', 'PENDING'] },
      },
      select: {
        type: true,
        totalNet: true,
        totalTax: true,
        totalAmount: true,
      },
    }),
    prisma.purchase.findMany({
      where: {
        companyId,
        date: { gte: start, lt: end },
      },
      select: {
        netAmount: true,
        taxAmount: true,
        totalAmount: true,
      },
    }),
  ])

  const debitoFiscal = sales.reduce((sum, s) => sum + s.totalTax, 0)
  const creditoFiscal = purchases.reduce((sum, p) => sum + p.taxAmount, 0)
  const ivaDeterminado = debitoFiscal - creditoFiscal
  const remanente = 0
  const ppm = Math.round(sales.reduce((sum, s) => sum + s.totalNet, 0) * 0.004)
  const totalPagar = ivaDeterminado + ppm

  return {
    period: { year, month },
    sales: {
      count: sales.length,
      neto: sales.reduce((sum, s) => sum + s.totalNet, 0),
      iva: debitoFiscal,
      total: sales.reduce((sum, s) => sum + s.totalAmount, 0),
    },
    purchases: {
      count: purchases.length,
      neto: purchases.reduce((sum, p) => sum + p.netAmount, 0),
      iva: creditoFiscal,
      total: purchases.reduce((sum, p) => sum + p.totalAmount, 0),
    },
    f29: {
      '502': debitoFiscal,
      '503': creditoFiscal,
      '595': ivaDeterminado,
      '538': remanente,
      '547': ppm,
      '91': totalPagar,
    },
  }
}

export default async function (fastify: FastifyInstance) {
  fastify.get('/f29', async (request, reply) => {
    const companyId = request.companyId
    const query = request.query as { year?: string; month?: string }

    const now = new Date()
    const year = query.year ? parseInt(query.year, 10) : now.getFullYear()
    const month = query.month ? parseInt(query.month, 10) : now.getMonth() + 1

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return reply.code(400).send({ error: 'Período inválido' })
    }

    const result = await calculateF29(companyId, year, month)
    return reply.send(result)
  })

  fastify.get('/f29/export', async (request, reply) => {
    const companyId = request.companyId
    const query = request.query as { year?: string; month?: string }

    const now = new Date()
    const year = query.year ? parseInt(query.year, 10) : now.getFullYear()
    const month = query.month ? parseInt(query.month, 10) : now.getMonth() + 1

    if (isNaN(year) || isNaN(month) || month < 1 || month > 12) {
      return reply.code(400).send({ error: 'Período inválido' })
    }

    const result = await calculateF29(companyId, year, month)

    const rows = [
      { codigo: '502', descripcion: 'Débito fiscal (IVA ventas afectas)', valor: result.f29['502'] },
      { codigo: '503', descripcion: 'Crédito fiscal (IVA compras)', valor: result.f29['503'] },
      { codigo: '595', descripcion: 'IVA determinado (502 - 503)', valor: result.f29['595'] },
      { codigo: '538', descripcion: 'Remanente crédito fiscal mes anterior', valor: result.f29['538'] },
      { codigo: '547', descripcion: 'Pago provisional mensual (PPM)', valor: result.f29['547'] },
      { codigo: '91', descripcion: 'Total a pagar o devolver', valor: result.f29['91'] },
    ]

    const headers = ['Codigo', 'Descripcion', 'Valor']
    const lines = [headers.join(',')]
    for (const row of rows) {
      lines.push([escapeCsv(row.codigo), escapeCsv(row.descripcion), escapeCsv(row.valor)].join(','))
    }

    // Add summary section
    lines.push('')
    lines.push('Resumen Ventas,' + escapeCsv(result.sales.count) + ' documentos')
    lines.push('Neto Ventas,' + escapeCsv(result.sales.neto))
    lines.push('IVA Ventas,' + escapeCsv(result.sales.iva))
    lines.push('Total Ventas,' + escapeCsv(result.sales.total))
    lines.push('')
    lines.push('Resumen Compras,' + escapeCsv(result.purchases.count) + ' documentos')
    lines.push('Neto Compras,' + escapeCsv(result.purchases.neto))
    lines.push('IVA Compras,' + escapeCsv(result.purchases.iva))
    lines.push('Total Compras,' + escapeCsv(result.purchases.total))

    const csv = lines.join('\n')
    const filename = `F29_${year}${String(month).padStart(2, '0')}.csv`

    reply.header('Content-Type', 'text/csv; charset=utf-8')
    reply.header('Content-Disposition', `attachment; filename="${filename}"`)
    return reply.send(csv)
  })
}
