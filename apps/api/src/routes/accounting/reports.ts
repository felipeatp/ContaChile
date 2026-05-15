import { FastifyInstance } from 'fastify'
import {
  TrialBalanceQuerySchema,
  IncomeStatementQuerySchema,
  BalanceSheetQuerySchema,
} from '@contachile/validators'
import {
  computeTrialBalance,
  computeIncomeStatement,
  computeBalanceSheet,
} from '../../lib/financial-statements'

function endOfDay(s: string): Date {
  return new Date(s + 'T23:59:59')
}

export default async function (fastify: FastifyInstance) {
  fastify.get('/accounting/reports/trial-balance', async (request, reply) => {
    const companyId = request.companyId
    const parsed = TrialBalanceQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Parámetros inválidos', issues: parsed.error.issues })
    }
    const asOfStr = parsed.data.asOf || new Date().toISOString().slice(0, 10)
    const asOf = endOfDay(asOfStr)
    const result = await computeTrialBalance(companyId, asOf)
    return reply.send(result)
  })

  fastify.get('/accounting/reports/income-statement', async (request, reply) => {
    const companyId = request.companyId
    const parsed = IncomeStatementQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Parámetros inválidos', issues: parsed.error.issues })
    }
    const from = new Date(parsed.data.from + 'T00:00:00')
    const to = endOfDay(parsed.data.to)
    const result = await computeIncomeStatement(companyId, from, to)
    return reply.send(result)
  })

  fastify.get('/accounting/reports/balance-sheet', async (request, reply) => {
    const companyId = request.companyId
    const parsed = BalanceSheetQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Parámetros inválidos', issues: parsed.error.issues })
    }
    const asOfStr = parsed.data.asOf || new Date().toISOString().slice(0, 10)
    const asOf = endOfDay(asOfStr)
    const result = await computeBalanceSheet(companyId, asOf)
    return reply.send(result)
  })
}
