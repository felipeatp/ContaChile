import fp from 'fastify-plugin'
import { FastifyInstance, FastifyRequest } from 'fastify'
import { prisma } from '@contachile/db'
import crypto from 'crypto'

export async function hashKey(key: string): Promise<string> {
  return crypto.createHash('sha256').update(key).digest('hex')
}

async function publicApiPlugin(fastify: FastifyInstance) {
  fastify.addHook('onRequest', async (request: FastifyRequest, reply) => {
    // Solo aplica a rutas que empiecen con /public
    if (!request.url.startsWith('/public')) return

    const apiKey = request.headers['x-api-key'] as string | undefined
    if (!apiKey) {
      return reply.code(401).send({ error: 'API key requerida. Envía x-api-key en el header.' })
    }

    const keyHash = await hashKey(apiKey)
    const keyRecord = await prisma.apiKey.findUnique({
      where: { keyHash },
    })

    if (!keyRecord || keyRecord.revoked) {
      return reply.code(401).send({ error: 'API key inválida o revocada.' })
    }

    // Actualizar lastUsedAt
    await prisma.apiKey.update({
      where: { id: keyRecord.id },
      data: { lastUsedAt: new Date() },
    })

    // Adjuntar companyId y scopes al request
    ;(request as any).companyId = keyRecord.companyId
    ;(request as any).apiKeyScopes = keyRecord.scopes
  })
}

export default fp(publicApiPlugin)
