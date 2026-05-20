import { FastifyInstance, FastifyRequest } from 'fastify'
import { prisma } from '@contachile/db'

function hasScope(request: FastifyRequest, scope: string): boolean {
  const scopes = (request as any).apiKeyScopes as string[] || []
  return scopes.includes(scope) || scopes.includes('*')
}

export default async function (fastify: FastifyInstance) {
  // GET /public/v1/company
  fastify.get('/public/v1/company', async (request, reply) => {
    if (!hasScope(request, 'read:company')) {
      return reply.code(403).send({ error: 'Scope read:company requerido' })
    }

    const companyId = (request as any).companyId as string
    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { id: true, rut: true, name: true, createdAt: true },
    })

    if (!company) return reply.code(404).send({ error: 'Empresa no encontrada' })
    return reply.send({ company })
  })

  // GET /public/v1/documents
  fastify.get('/public/v1/documents', async (request, reply) => {
    if (!hasScope(request, 'read:documents')) {
      return reply.code(403).send({ error: 'Scope read:documents requerido' })
    }

    const companyId = (request as any).companyId as string
    const query = request.query as { limit?: string; offset?: string; type?: string }
    const limit = Math.min(parseInt(query.limit || '50'), 100)
    const offset = parseInt(query.offset || '0')

    const where: any = { companyId }
    if (query.type) where.type = parseInt(query.type)

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { emittedAt: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          type: true,
          folio: true,
          emittedAt: true,
          receiverRut: true,
          receiverName: true,
          totalAmount: true,
          status: true,
        },
      }),
      prisma.document.count({ where }),
    ])

    return reply.send({ documents, total, limit, offset })
  })

  // GET /public/v1/purchases
  fastify.get('/public/v1/purchases', async (request, reply) => {
    if (!hasScope(request, 'read:purchases')) {
      return reply.code(403).send({ error: 'Scope read:purchases requerido' })
    }

    const companyId = (request as any).companyId as string
    const query = request.query as { limit?: string; offset?: string; status?: string }
    const limit = Math.min(parseInt(query.limit || '50'), 100)
    const offset = parseInt(query.offset || '0')

    const where: any = { companyId }
    if (query.status) where.status = query.status

    const [purchases, total] = await Promise.all([
      prisma.purchase.findMany({
        where,
        orderBy: { date: 'desc' },
        take: limit,
        skip: offset,
        select: {
          id: true,
          type: true,
          folio: true,
          date: true,
          issuerRut: true,
          issuerName: true,
          description: true,
          netAmount: true,
          taxAmount: true,
          totalAmount: true,
          status: true,
          source: true,
        },
      }),
      prisma.purchase.count({ where }),
    ])

    return reply.send({ purchases, total, limit, offset })
  })

  // GET /public/v1/accounting/reports
  fastify.get('/public/v1/accounting/reports', async (request, reply) => {
    if (!hasScope(request, 'read:accounting')) {
      return reply.code(403).send({ error: 'Scope read:accounting requerido' })
    }

    const companyId = (request as any).companyId as string
    const year = new Date().getFullYear()
    const start = new Date(year, 0, 1)
    const end = new Date(year + 1, 0, 1)

    const [ingresos, costos, gastos] = await Promise.all([
      prisma.document.aggregate({
        where: { companyId, type: 33, emittedAt: { gte: start, lt: end } },
        _sum: { totalAmount: true },
      }),
      prisma.purchase.aggregate({
        where: { companyId, type: 33, date: { gte: start, lt: end } },
        _sum: { totalAmount: true },
      }),
      prisma.purchase.aggregate({
        where: { companyId, type: { not: 33 }, date: { gte: start, lt: end } },
        _sum: { totalAmount: true },
      }),
    ])

    return reply.send({
      year,
      ingresos: ingresos._sum.totalAmount || 0,
      costos: costos._sum.totalAmount || 0,
      gastos: gastos._sum.totalAmount || 0,
      rentaLiquida: Math.max(0, (ingresos._sum.totalAmount || 0) - (costos._sum.totalAmount || 0) - (gastos._sum.totalAmount || 0)),
    })
  })
}
