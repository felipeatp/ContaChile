import { FastifyInstance } from 'fastify'
import { generateProactiveInsights } from '@contachile/ai-agents'

export default async function (fastify: FastifyInstance) {
  fastify.get('/ai/insights', async (request, reply) => {
    const companyId = request.companyId
    
    try {
      // Intentar obtener de cache si fuera necesario (omitido por simplicidad en este paso)
      const insights = await generateProactiveInsights(companyId)
      return reply.send({ insights })
    } catch (err) {
      fastify.log.error(err)
      return reply.send({ insights: [] })
    }
  })
}
