import fp from 'fastify-plugin'
import { FastifyInstance, FastifyRequest } from 'fastify'
import { prisma } from '@contachile/db'
import { auth } from '@contachile/auth'
import { fromNodeHeaders } from 'better-auth/node'
import crypto from 'crypto'

export async function hashKey(key: string): Promise<string> {
  return crypto.createHash('sha256').update(key).digest('hex')
}

async function publicApiPlugin(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply) => {
    // Solo aplica a rutas que empiecen con /public
    if (!request.url.startsWith('/public')) return

    const apiKey = request.headers['x-api-key'] as string | undefined

    if (apiKey) {
      // Auth por API key
      const keyHash = await hashKey(apiKey)
      const keyRecord = await prisma.apiKey.findUnique({
        where: { keyHash },
      })

      if (!keyRecord || keyRecord.revoked) {
        return reply.code(401).send({ error: 'API key inválida o revocada.' })
      }

      await prisma.apiKey.update({
        where: { id: keyRecord.id },
        data: { lastUsedAt: new Date() },
      })

      ;(request as any).companyId = keyRecord.companyId
      ;(request as any).apiKeyScopes = keyRecord.scopes
      return
    }

    // Fallback: intentar sesión de Better Auth (para app móvil)
    try {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(request.headers),
      })

      if (session?.user) {
        const memberships = await prisma.companyMembership.findMany({
          where: { userId: session.user.id },
          select: { companyId: true },
        })

        if (memberships.length > 0) {
          ;(request as any).companyId = memberships[0].companyId
          ;(request as any).apiKeyScopes = ['read:documents', 'read:purchases', 'read:company', 'read:accounting']
          ;(request as any).userId = session.user.id
          return
        }
      }
    } catch {
      // fall through to 401
    }

    return reply.code(401).send({ error: 'API key o sesión requerida.' })
  })
}

export default fp(publicApiPlugin)
