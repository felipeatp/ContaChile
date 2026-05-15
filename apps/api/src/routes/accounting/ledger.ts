import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import { LedgerQuerySchema } from '@contachile/validators'

export default async function (fastify: FastifyInstance) {
  fastify.get('/accounting/ledger/:accountId', async (request, reply) => {
    const companyId = request.companyId
    const { accountId } = request.params as { accountId: string }
    const parsed = LedgerQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Parámetros inválidos', issues: parsed.error.issues })
    }
    const { from, to } = parsed.data

    const account = await prisma.account.findFirst({
      where: { id: accountId, companyId },
      select: { id: true, code: true, name: true, type: true },
    })
    if (!account) return reply.code(404).send({ error: 'Cuenta no encontrada' })

    const entryWhere: Record<string, unknown> = { companyId }
    if (from || to) {
      const dateFilter: Record<string, Date> = {}
      if (from) dateFilter.gte = new Date(from)
      if (to) dateFilter.lte = new Date(to + 'T23:59:59')
      entryWhere.date = dateFilter
    }

    const lines = await prisma.journalLine.findMany({
      where: {
        accountId,
        journalEntry: entryWhere,
      },
      orderBy: { journalEntry: { date: 'asc' } },
      include: {
        journalEntry: {
          select: { id: true, date: true, description: true, reference: true, source: true },
        },
      },
    })

    let balance = 0
    const movements = lines.map((l) => {
      balance += l.debit - l.credit
      return {
        id: l.id,
        date: l.journalEntry.date,
        description: l.description || l.journalEntry.description,
        reference: l.journalEntry.reference,
        source: l.journalEntry.source,
        debit: l.debit,
        credit: l.credit,
        balance,
      }
    })

    const totals = lines.reduce(
      (acc, l) => ({ debit: acc.debit + l.debit, credit: acc.credit + l.credit }),
      { debit: 0, credit: 0 }
    )

    return reply.send({
      account,
      movements,
      totals: { ...totals, balance },
    })
  })
}
