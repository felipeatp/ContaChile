import fp from 'fastify-plugin'
import { FastifyInstance, FastifyPluginAsync } from 'fastify'

declare module 'fastify' {
  interface FastifyRequest {
    companyId: string
  }
}

const tenantPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('onRequest', async (request) => {
    // Stub: extract companyId from header (real Clerk JWT in follow-up)
    const companyId = request.headers['x-company-id'] as string
    if (!companyId) {
      throw new Error('Missing company id')
    }
    request.companyId = companyId
  })
}

export default fp(tenantPlugin)
