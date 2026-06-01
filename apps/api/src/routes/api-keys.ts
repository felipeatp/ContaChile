import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import crypto from 'crypto'
import { hashKey } from '../plugins/public-api'
import { requireRole } from '../plugins/tenant'

const PREFIX = 'ck_live_'

const VALID_SCOPES = ['dte:read', 'dte:write', 'accounting:read', 'payroll:read', 'reports:read', '*']

function generateKey(): string {
  return PREFIX + crypto.randomBytes(32).toString('hex')
}

export default async function (fastify: FastifyInstance) {
  // Crear API key (requiere rol owner o admin)
  fastify.post('/api-keys', { preHandler: requireRole(['owner', 'admin']) }, async (request, reply) => {
    const companyId = request.companyId
    const body = request.body as { name?: string; scopes?: string[] }

    const requestedScopes = body.scopes || ['dte:read']

    // Validate that all requested scopes are in the whitelist
    const invalidScopes = requestedScopes.filter((s) => !VALID_SCOPES.includes(s))
    if (invalidScopes.length > 0) {
      return reply.code(400).send({
        error: `Scopes inválidos: ${invalidScopes.join(', ')}. Scopes permitidos: ${VALID_SCOPES.join(', ')}`,
      })
    }

    // Wildcard scope '*' is only allowed for owners
    if (requestedScopes.includes('*') && request.userMembership?.role !== 'owner') {
      return reply.code(403).send({
        error: 'El scope * (acceso completo) solo puede ser asignado por un owner',
      })
    }

    const key = generateKey()
    const keyHash = await hashKey(key)

    const record = await prisma.apiKey.create({
      data: {
        companyId,
        name: body.name || 'API Key',
        keyHash,
        scopes: requestedScopes,
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

  // Revocar API key (requiere rol owner o admin)
  fastify.delete('/api-keys/:id', { preHandler: requireRole(['owner', 'admin']) }, async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }

    await prisma.apiKey.updateMany({
      where: { id, companyId },
      data: { revoked: true },
    })

    return reply.send({ success: true })
  })
}
