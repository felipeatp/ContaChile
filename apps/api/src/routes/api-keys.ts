import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import crypto from 'crypto'
import { hashKey } from '../plugins/public-api'

const PREFIX = 'ck_live_'

function generateKey(): string {
  return PREFIX + crypto.randomBytes(32).toString('hex')
}

export default async function (fastify: FastifyInstance) {
  // Crear API key (requiere sesión de usuario)
  fastify.post('/api-keys', async (request, reply) => {
    const companyId = request.companyId
    const body = request.body as { name?: string; scopes?: string[] }

    const key = generateKey()
    const keyHash = await hashKey(key)

    const record = await prisma.apiKey.create({
      data: {
        companyId,
        name: body.name || 'API Key',
        keyHash,
        scopes: body.scopes || ['read:documents', 'read:purchases', 'read:company'],
      },
    })

    return reply.send({
      id: record.id,
      name: record.name,
      key, // SOLO se muestra una vez
      scopes: record.scopes,
      createdAt: record.createdAt,
    })
  })

  // Listar API keys
  fastify.get('/api-keys', async (request, reply) => {
    const companyId = request.companyId
    const keys = await prisma.apiKey.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        name: true,
        scopes: true,
        lastUsedAt: true,
        revoked: true,
        createdAt: true,
      },
    })
    return reply.send({ keys })
  })

  // Revocar API key
  fastify.delete('/api-keys/:id', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }

    await prisma.apiKey.updateMany({
      where: { id, companyId },
      data: { revoked: true },
    })

    return reply.send({ success: true })
  })
}
