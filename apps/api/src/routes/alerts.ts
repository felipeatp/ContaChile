import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import { findUpcomingDueDates } from '@contachile/validators'

export default async function (fastify: FastifyInstance) {
  fastify.get('/alerts/upcoming', async (request, reply) => {
    const query = request.query as { daysAhead?: string; includePastDays?: string }
    const monthsAhead = query.daysAhead
      ? Math.max(0, Math.min(3, Math.ceil(parseInt(query.daysAhead, 10) / 30)))
      : 1
    const includePastDays = query.includePastDays ? parseInt(query.includePastDays, 10) : 7

    const alerts = findUpcomingDueDates(new Date(), {
      monthsAhead,
      includePastDays,
    })

    return reply.send({ alerts })
  })

  fastify.get('/alerts/history', async (request, reply) => {
    const companyId = request.companyId
    const { limit } = request.query as { limit?: string }
    const take = limit ? Math.min(100, parseInt(limit, 10)) : 50

    const alerts = await prisma.alertSent.findMany({
      where: { companyId },
      orderBy: { sentAt: 'desc' },
      take,
    })

    return reply.send({ alerts })
  })
}
