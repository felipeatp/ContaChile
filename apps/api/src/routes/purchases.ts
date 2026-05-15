import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import { PurchaseSchema, PurchaseListQuerySchema } from '@contachile/validators'

export default async function (fastify: FastifyInstance) {
  fastify.get('/purchases', async (request, reply) => {
    const companyId = request.companyId
    const query = request.query as Record<string, string | undefined>

    const parsed = PurchaseListQuerySchema.safeParse(query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Parámetros inválidos', issues: parsed.error.issues })
    }

    const { year, month, page, limit } = parsed.data

    const where: Record<string, unknown> = { companyId }

    if (year || month) {
      const startYear = year ? parseInt(year, 10) : new Date().getFullYear()
      const startMonth = month ? parseInt(month, 10) - 1 : 0
      const endMonth = month ? parseInt(month, 10) - 1 : 11

      const startDate = new Date(startYear, startMonth, 1)
      const endDate = new Date(startYear, endMonth + 1, 1)

      where.date = { gte: startDate, lt: endDate }
    }

    const pageNum = parseInt(page, 10)
    const limitNum = parseInt(limit, 10)
    const skip = (pageNum - 1) * limitNum

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limitNum,
      }),
      prisma.purchase.count({ where }),
    ])

    return reply.send({ purchases, total, page: pageNum, limit: limitNum })
  })

  fastify.post('/purchases', async (request, reply) => {
    const companyId = request.companyId
    const body = request.body as Record<string, unknown>

    const parsed = PurchaseSchema.safeParse(body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', issues: parsed.error.issues })
    }

    const data = parsed.data

    const purchase = await prisma.purchase.create({
      data: {
        companyId,
        type: data.type,
        folio: data.folio,
        issuerRut: data.issuerRut,
        issuerName: data.issuerName,
        date: new Date(data.date),
        netAmount: data.netAmount,
        taxAmount: data.taxAmount,
        totalAmount: data.totalAmount,
        category: data.category,
      },
    })

    return reply.code(201).send(purchase)
  })
}
