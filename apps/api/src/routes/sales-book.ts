import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'

// Tipos de documento considerados ventas para el libro de ventas
const SALES_TYPES = [33, 34, 39, 41, 43]

export default async function (fastify: FastifyInstance) {
  fastify.get('/sales-book', async (request, reply) => {
    const companyId = request.companyId
    const query = request.query as { year?: string; month?: string; page?: string; limit?: string }

    const page = parseInt(query.page || '1', 10)
    const limit = parseInt(query.limit || '50', 10)
    const skip = (page - 1) * limit

    const year = query.year ? parseInt(query.year, 10) : undefined
    const month = query.month ? parseInt(query.month, 10) : undefined

    const where: Record<string, unknown> = {
      companyId,
      type: { in: SALES_TYPES },
    }

    if (year !== undefined && month !== undefined) {
      const start = new Date(year, month - 1, 1)
      const end = new Date(year, month, 1)
      where.emittedAt = { gte: start, lt: end }
    } else if (year !== undefined) {
      const start = new Date(year, 0, 1)
      const end = new Date(year + 1, 0, 1)
      where.emittedAt = { gte: start, lt: end }
    }

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { emittedAt: 'desc' },
        skip,
        take: limit,
        include: { items: true },
      }),
      prisma.document.count({ where }),
    ])

    const totals = documents.reduce(
      (acc, doc) => {
        acc.net += doc.totalNet
        acc.tax += doc.totalTax
        acc.total += doc.totalAmount
        return acc
      },
      { net: 0, tax: 0, total: 0 }
    )

    return reply.send({
      documents,
      total,
      page,
      limit,
      summary: totals,
    })
  })
}
