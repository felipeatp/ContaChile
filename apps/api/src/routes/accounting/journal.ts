import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import {
  CreateJournalEntrySchema,
  JournalListQuerySchema,
} from '@contachile/validators'

export default async function (fastify: FastifyInstance) {
  fastify.get('/accounting/journal', async (request, reply) => {
    const companyId = request.companyId
    const parsed = JournalListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Parámetros inválidos', issues: parsed.error.issues })
    }
    const { from, to, source, page, limit } = parsed.data
    const pageNum = parseInt(page, 10)
    const limitNum = parseInt(limit, 10)
    const skip = (pageNum - 1) * limitNum

    const where: Record<string, unknown> = { companyId }
    if (from || to) {
      const dateFilter: Record<string, Date> = {}
      if (from) dateFilter.gte = new Date(from)
      if (to) dateFilter.lte = new Date(to + 'T23:59:59')
      where.date = dateFilter
    }
    if (source) where.source = source

    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limitNum,
        include: {
          lines: {
            include: { account: { select: { code: true, name: true } } },
          },
        },
      }),
      prisma.journalEntry.count({ where }),
    ])

    return reply.send({ entries, total, page: pageNum, limit: limitNum })
  })

  fastify.get('/accounting/journal/:id', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }
    const entry = await prisma.journalEntry.findFirst({
      where: { id, companyId },
      include: {
        lines: {
          include: { account: { select: { code: true, name: true, type: true } } },
        },
      },
    })
    if (!entry) return reply.code(404).send({ error: 'Asiento no encontrado' })
    return reply.send(entry)
  })

  fastify.post('/accounting/journal', async (request, reply) => {
    const companyId = request.companyId
    const parsed = CreateJournalEntrySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', issues: parsed.error.issues })
    }
    const data = parsed.data

    const accountIds = data.lines.map((l) => l.accountId)
    const accounts = await prisma.account.findMany({
      where: { id: { in: accountIds }, companyId },
      select: { id: true, isActive: true },
    })
    if (accounts.length !== new Set(accountIds).size) {
      return reply.code(400).send({ error: 'Una o más cuentas no existen' })
    }
    if (accounts.some((a) => !a.isActive)) {
      return reply.code(400).send({ error: 'Una o más cuentas están inactivas' })
    }

    const entry = await prisma.journalEntry.create({
      data: {
        companyId,
        date: new Date(data.date),
        description: data.description,
        reference: data.reference,
        source: 'manual',
        lines: {
          create: data.lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: l.description,
          })),
        },
      },
      include: {
        lines: {
          include: { account: { select: { code: true, name: true } } },
        },
      },
    })

    return reply.code(201).send(entry)
  })
}
