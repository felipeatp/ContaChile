import fp from 'fastify-plugin'
import { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { verifyToken } from '@clerk/backend'

declare module 'fastify' {
  interface FastifyRequest {
    companyId: string
  }
}

const tenantPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('onRequest', async (request, reply) => {
    const authHeader = request.headers.authorization
    const clerkSecret = process.env.CLERK_SECRET_KEY

    if (authHeader && authHeader.startsWith('Bearer ') && clerkSecret) {
      const token = authHeader.slice(7)
      try {
        const payload = await verifyToken(token, { secretKey: clerkSecret })
        const orgId = (payload.orgId as string | undefined) || (payload.sub as string | undefined)
        if (!orgId) {
          return reply.code(401).send({ error: 'Invalid token: missing orgId' })
        }
        request.companyId = orgId
        return
      } catch (err) {
        return reply.code(401).send({ error: 'Invalid or expired token' })
      }
    }

    const companyId = request.headers['x-company-id'] as string
    if (!companyId) {
      return reply.code(401).send({ error: 'Missing authentication' })
    }
    request.companyId = companyId
  })
}

export default fp(tenantPlugin)
