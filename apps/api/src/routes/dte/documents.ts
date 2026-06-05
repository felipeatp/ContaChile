import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import { SIIClient } from '@contachile/transport-sii'
import { AceptaClient } from '@contachile/transport-acepta'
import { createEmailService } from '../../lib/email'
import { enqueuePollJob } from '../../queues/dte'
import { createRedisClient } from '../../lib/redis'

const siiClient = new SIIClient({
  baseURL: process.env.SII_BASE_URL || 'https://maullin.sii.cl',
  env: (process.env.SII_ENV as 'test' | 'production') || 'test',
})

const aceptaClient = new AceptaClient({
  apiKey: process.env.ACEPTA_API_KEY || 'test-key',
  baseURL: process.env.ACEPTA_BASE_URL,
})

const emailService = createEmailService()

export default async function (fastify: FastifyInstance) {
  fastify.get('/documents', async (request, reply) => {
    const companyId = request.companyId
    const query = request.query as {
      status?: string
      page?: string
      limit?: string
      from?: string
      to?: string
      type?: string
      search?: string
      sort?: string
      order?: string
    }
    const where: Record<string, unknown> = { companyId }

    if (query.status) {
      where.status = query.status
    }

    if (query.type) {
      where.type = parseInt(query.type, 10)
    }

    if (query.from || query.to) {
      where.emittedAt = {}
      if (query.from) {
        ;(where.emittedAt as Record<string, Date>).gte = new Date(query.from)
      }
      if (query.to) {
        const toDate = new Date(query.to)
        toDate.setHours(23, 59, 59, 999)
        ;(where.emittedAt as Record<string, Date>).lte = toDate
      }
    }

    if (query.search) {
      const search = query.search.trim()
      where.OR = [
        { receiverRut: { contains: search, mode: 'insensitive' } },
        { receiverName: { contains: search, mode: 'insensitive' } },
        { folio: isNaN(Number(search)) ? undefined : Number(search) },
      ].filter(Boolean)
    }

    const page = parseInt(query.page || '1', 10)
    const limit = parseInt(query.limit || '20', 10)
    const skip = (page - 1) * limit

    const ALLOWED_SORT_FIELDS = ['emittedAt', 'totalAmount', 'status', 'folio'] as const
    type SortField = (typeof ALLOWED_SORT_FIELDS)[number]
    const sortField: SortField = ALLOWED_SORT_FIELDS.includes(query.sort as SortField)
      ? (query.sort as SortField)
      : 'emittedAt'
    const sortOrder = query.order === 'asc' ? 'asc' : 'desc'

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { [sortField]: sortOrder },
        skip,
        take: limit,
      }),
      prisma.document.count({ where }),
    ])

    return reply.send({ documents, total, page, limit, totalPages: Math.ceil(total / limit) })
  })

  fastify.get('/documents/stats', async (request, reply) => {
    const companyId = request.companyId

    const redis = createRedisClient()
    const cacheKey = `stats:documents:${companyId}`
    try {
      const cached = await redis.get(cacheKey)
      if (cached) {
        await redis.quit()
        return reply.send(JSON.parse(cached))
      }
    } catch {
      // Redis no disponible → seguir sin cache
    }

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const startOfPrevYear = new Date(now.getFullYear() - 1, 0, 1)
    const startOfWindow = new Date(now.getFullYear() - 1, now.getMonth() - 11, 1)

    const [total, emittedToday, grouped, windowRows, curAgg, prevAgg] =
      await Promise.all([
        prisma.document.count({ where: { companyId } }),
        prisma.document.count({
          where: { companyId, emittedAt: { gte: startOfToday } },
        }),
        prisma.document.groupBy({
          by: ['status'],
          where: { companyId },
          _count: { _all: true },
        }),
        prisma.document.findMany({
          where: { companyId, emittedAt: { gte: startOfWindow } },
          select: { emittedAt: true, totalAmount: true },
        }),
        prisma.document.aggregate({
          where: { companyId, emittedAt: { gte: startOfYear } },
          _sum: { totalAmount: true },
        }),
        prisma.document.aggregate({
          where: {
            companyId,
            emittedAt: { gte: startOfPrevYear, lt: startOfYear },
          },
          _sum: { totalAmount: true },
        }),
      ])

    const countOf = (s: string) =>
      grouped.find((g: any) => g.status === s)?._count?._all ?? 0

    const byStatus = {
      pending: countOf('PENDING'),
      accepted: countOf('ACCEPTED'),
      rejected: countOf('REJECTED'),
      failed: countOf('FAILED'),
    }

    const monthlyMap = new Map<string, { count: number; totalAmount: number }>()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthlyMap.set(key, { count: 0, totalAmount: 0 })
    }
    for (const row of windowRows) {
      const d = new Date(row.emittedAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const cur = monthlyMap.get(key)
      if (cur) {
        cur.count += 1
        cur.totalAmount += row.totalAmount ?? 0
      }
    }
    const monthly = Array.from(monthlyMap.entries()).map(([month, v]) => ({
      month,
      count: v.count,
      totalAmount: v.totalAmount,
    }))

    const current = curAgg._sum.totalAmount ?? 0
    const previous = prevAgg._sum.totalAmount ?? 0
    const deltaPct =
      previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0

    const stats = {
      total,
      emittedToday,
      byStatus,
      monthly,
      yoy: { current, previous, deltaPct },
    }

    try {
      await redis.setex(cacheKey, 300, JSON.stringify(stats))
      await redis.quit()
    } catch {
      // ignore
    }

    return reply.send(stats)
  })

  fastify.get('/documents/:id', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }

    const document = await prisma.document.findFirst({
      where: { id, companyId },
      include: { items: true },
    })

    if (!document) {
      return reply.code(404).send({ error: 'Document not found' })
    }

    return reply.send(document)
  })

  fastify.post('/documents/:id/check-status', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }

    const doc = await prisma.document.findFirst({
      where: { id, companyId },
    })

    if (!doc) {
      return reply.code(404).send({ error: 'Document not found' })
    }

    if (!doc.trackId) {
      return reply.code(400).send({ error: 'Documento sin trackId' })
    }

    const source = doc.trackId.startsWith('ACEPTA-') ? 'acepta' : 'sii'

    const statusResult =
      source === 'sii'
        ? await siiClient.queryStatus(doc.trackId)
        : await aceptaClient.queryStatus(doc.trackId)

    if (statusResult.status !== doc.status) {
      await prisma.document.update({
        where: { id },
        data: {
          status: statusResult.status,
          ...(statusResult.status === 'ACCEPTED'
            ? { acceptedAt: new Date() }
            : statusResult.status === 'REJECTED'
              ? { rejectedAt: new Date(), rejectionReason: statusResult.detail }
              : {}),
        },
      })

      if (statusResult.status === 'ACCEPTED' && doc.receiverEmail) {
        await emailService.sendDocumentAccepted({
          documentId: doc.id,
          folio: doc.folio,
          type: doc.type,
          receiverName: doc.receiverName,
          receiverEmail: doc.receiverEmail,
        })
      }

      await prisma.auditLog.create({
        data: {
          documentId: id,
          action: statusResult.status,
          payload: { source, detail: statusResult.detail },
        },
      })
    }

    return reply.send({
      id: doc.id,
      status: statusResult.status,
      previousStatus: doc.status,
      changed: statusResult.status !== doc.status,
    })
  })

  fastify.post('/documents/:id/retry', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }

    const doc = await prisma.document.findFirst({
      where: { id, companyId, status: 'FAILED' },
    })

    if (!doc) {
      return reply.code(404).send({ error: 'Documento no encontrado o no está en estado FAILED' })
    }

    await prisma.document.update({
      where: { id },
      data: { status: 'PENDING', rejectionReason: null },
    })

    const source = doc.trackId?.startsWith('ACEPTA-') ? 'acepta' : 'sii'
    await enqueuePollJob({
      documentId: doc.id,
      trackId: doc.trackId || `SII-${Date.now()}`,
      source,
    })

    return reply.send({ id: doc.id, status: 'PENDING', retried: true })
  })
}
