import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'

function getPeriodDates(year: number, month: number) {
  const start = new Date(year, month - 1, 1)
  const end = new Date(year, month, 1)
  return { start, end }
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

    // Códigos SII F29
    // 502: Débito fiscal (IVA ventas afectas)
    // 503: Crédito fiscal (IVA compras)
    // 595: IVA determinado (502 - 503)
    // 538: Remanente mes anterior (placeholder)
    // 547: PPM (placeholder)
    // 91:  Total a pagar o devolver

    const debitoFiscal = sales.reduce((sum, s) => sum + s.totalTax, 0)
    const creditoFiscal = purchases.reduce((sum, p) => sum + p.taxAmount, 0)
    const ivaDeterminado = debitoFiscal - creditoFiscal
    const remanente = 0 // TODO: calcular desde F29 mes anterior
    const ppm = Math.round(sales.reduce((sum, s) => sum + s.totalNet, 0) * 0.004) // PPM aprox 0.4% de ventas
    const totalPagar = ivaDeterminado > 0 ? ivaDeterminado + ppm : ivaDeterminado + ppm

    return reply.send({
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
    })
  })
}
