import fp from 'fastify-plugin'
import { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { auth } from '@contachile/auth'
import { fromNodeHeaders } from 'better-auth/node'

declare module 'fastify' {
  interface FastifyRequest {
    companyId: string
  }
}

const tenantPlugin: FastifyPluginAsync = async (fastify: FastifyInstance) => {
  fastify.addHook('onRequest', async (request, reply) => {
    // Intentar obtener sesión de Better Auth
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
      })

      if (session?.user) {
        request.companyId = session.user.id
        return
      }
    } catch (err) {
      fastify.log.warn({ err }, 'Better Auth session validation failed')
    }

    // Bypass de desarrollo con companyId fijo
    if (process.env.DEV_BYPASS_AUTH === 'true') {
      request.companyId = 'dev-test-company'
      return
    }

    // Fallback x-company-id: sólo permitido en desarrollo
    if (process.env.NODE_ENV === 'production') {
      return reply.code(401).send({ error: 'Missing authentication' })
    }

    const companyId = request.headers['x-company-id'] as string
    if (!companyId) {
      return reply.code(401).send({ error: 'Missing authentication' })
    }
    request.companyId = companyId
  })
}

export default fp(tenantPlugin)
