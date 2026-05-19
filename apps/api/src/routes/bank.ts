import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import { clasificarTransaccion } from '@contachile/ai-agents'
import {
  syncBankAccounts,
  syncMovements,
  findAndApplyMatch,
  reconcileWithEntry,
  connectBankLink,
  setAccountMode,
  createLinkIntent,
  exchangeLinkToken,
} from '../lib/bank-service'

export default async function (fastify: FastifyInstance) {
  fastify.get('/bank/accounts', async (request, reply) => {
    const companyId = request.companyId
    const accounts = await prisma.bankAccount.findMany({
      where: { companyId },
      orderBy: { createdAt: 'asc' },
    })
    return reply.send({ accounts })
  })

  fastify.post('/bank/link-intents', async (request, reply) => {
    try {
      const result = await createLinkIntent('business')
      return reply.send(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al crear link intent'
      fastify.log.warn({ err: msg }, 'createLinkIntent failed')
      return reply.code(400).send({ error: msg })
    }
  })

  fastify.post('/bank/link-intents/exchange', async (request, reply) => {
    const companyId = request.companyId
    const body = request.body as { exchangeToken?: string }
    if (!body.exchangeToken) {
      return reply.code(400).send({ error: 'exchangeToken requerido' })
    }
    try {
      const { linkToken } = await exchangeLinkToken(body.exchangeToken)
      const result = await connectBankLink(companyId, linkToken)
      return reply.send(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al intercambiar token'
      fastify.log.warn({ err: msg, companyId }, 'exchangeLinkToken failed')
      return reply.code(400).send({ error: msg })
    }
  })

  fastify.post('/bank/connections', async (request, reply) => {
    const companyId = request.companyId
    const body = request.body as { linkToken?: string }
    if (!body.linkToken) {
      return reply.code(400).send({ error: 'linkToken requerido' })
    }
    try {
      const result = await connectBankLink(companyId, body.linkToken)
      return reply.send(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error al conectar banco'
      fastify.log.warn({ err: msg, companyId }, 'connectBankLink failed')
      return reply.code(400).send({ error: msg })
    }
  })

  fastify.patch('/bank/accounts/:id/mode', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }
    const body = request.body as { mode?: string; linkToken?: string }
    if (!body.mode || !['REAL', 'SIMULATED', 'DEMO'].includes(body.mode)) {
      return reply.code(400).send({ error: 'mode debe ser REAL, SIMULATED o DEMO' })
    }
    try {
      const result = await setAccountMode(id, companyId, body.mode as 'REAL' | 'SIMULATED' | 'DEMO', body.linkToken)
      return reply.send(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error'
      return reply.code(400).send({ error: msg })
    }
  })

  fastify.post('/bank/accounts/sync', async (request, reply) => {
    const companyId = request.companyId
    const result = await syncBankAccounts(companyId, fastify.log)
    return reply.send(result)
  })

  fastify.post('/bank/movements/sync', async (request, reply) => {
    const companyId = request.companyId
    const body = (request.body || {}) as { bankAccountId?: string; from?: string; to?: string }
    const from = body.from ? new Date(body.from) : undefined
    const to = body.to ? new Date(body.to) : undefined
    try {
      const result = await syncMovements(companyId, body.bankAccountId, from, to)
      return reply.send(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      return reply.code(400).send({ error: msg })
    }
  })

  fastify.get('/bank/movements', async (request, reply) => {
    const companyId = request.companyId
    const query = request.query as { status?: string; from?: string; to?: string; bankAccountId?: string }

    const where: Record<string, unknown> = { companyId }
    if (query.status) where.status = query.status
    if (query.bankAccountId) where.bankAccountId = query.bankAccountId
    if (query.from || query.to) {
      const range: Record<string, Date> = {}
      if (query.from) range.gte = new Date(query.from)
      if (query.to) range.lte = new Date(query.to + 'T23:59:59')
      where.postedAt = range
    }

    const movements = await prisma.bankMovement.findMany({
      where,
      orderBy: { postedAt: 'desc' },
      include: { bankAccount: { select: { institution: true } } },
    })
    return reply.send({ movements })
  })

  fastify.post('/bank/movements/:id/match-auto', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }
    try {
      const result = await findAndApplyMatch(id, companyId)
      return reply.send(result)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error'
      return reply.code(400).send({ error: msg })
    }
  })

  fastify.post('/bank/movements/:id/classify', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }
    const movement = await prisma.bankMovement.findFirst({
      where: { id, companyId },
    })
    if (!movement) return reply.code(404).send({ error: 'Movimiento no encontrado' })

    try {
      const suggestion = await clasificarTransaccion(companyId, {
        description: movement.description,
        amount: movement.amount,
        date: movement.postedAt.toISOString().slice(0, 10),
        type: movement.type === 'CREDIT' ? 'credit' : 'debit',
        counterpart: movement.counterpartName ?? undefined,
      })

      await prisma.bankMovement.update({
        where: { id },
        data: {
          status: 'SUGGESTED',
          suggestionPayload: JSON.parse(JSON.stringify(suggestion)),
        },
      })

      return reply.send({ suggestion })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error en clasificador'
      fastify.log.warn({ err: msg, movementId: id }, 'classify failed')
      return reply.code(500).send({ error: msg })
    }
  })

  fastify.post('/bank/movements/:id/reconcile', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }
    const body = request.body as {
      debitAccountId?: string
      creditAccountId?: string
      description?: string
    }
    if (!body.debitAccountId || !body.creditAccountId) {
      return reply.code(400).send({ error: 'debitAccountId y creditAccountId son requeridos' })
    }
    try {
      const entry = await reconcileWithEntry(
        id,
        companyId,
        body.debitAccountId,
        body.creditAccountId,
        body.description
      )
      return reply.send(entry)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Error'
      return reply.code(400).send({ error: msg })
    }
  })

  fastify.post('/bank/movements/:id/ignore', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }
    const movement = await prisma.bankMovement.findFirst({
      where: { id, companyId },
    })
    if (!movement) return reply.code(404).send({ error: 'Movimiento no encontrado' })
    if (movement.status === 'RECONCILED') {
      return reply.code(400).send({ error: 'No se puede ignorar un movimiento conciliado' })
    }
    await prisma.bankMovement.update({
      where: { id },
      data: { status: 'IGNORED' },
    })
    return reply.send({ status: 'IGNORED' })
  })
}
