import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'

export default async function (fastify: FastifyInstance) {
  fastify.get('/purchases-book', async (request, reply) => {
    const companyId = request.companyId
    const query = request.query as { year?: string; month?: string; page?: string; limit?: string }

    const page = parseInt(query.page || '1', 10)
    const limit = parseInt(query.limit || '50', 10)
    const skip = (page - 1) * limit

    const year = query.year ? parseInt(query.year, 10) : undefined
    const month = query.month ? parseInt(query.month, 10) : undefined

    const where: Record<string, unknown> = { companyId }

    if (year !== undefined && month !== undefined) {
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 1)
      where.date = { gte: start, lt: end }
    } else if (year !== undefined) {
      const start = new Date(year, 0, 1)
      const end = new Date(year + 1, 0, 1)
      where.date = { gte: start, lt: end }
    }

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
      prisma.purchase.count({ where }),
    ])

    const totals = purchases.reduce(
      (acc, p) => {
        acc.net += p.netAmount
        acc.tax += p.taxAmount
        acc.total += p.totalAmount
        return acc
      },
      { net: 0, tax: 0, total: 0 }
    )

    return reply.send({
      purchases,
      total,
      page,
      limit,
      summary: totals,
    })
  })
}
