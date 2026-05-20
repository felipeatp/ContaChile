import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import crypto from 'crypto'

export default async function (fastify: FastifyInstance) {
  // Crear webhook
  fastify.post('/webhooks', async (request, reply) => {
    const companyId = request.companyId
    const body = request.body as {
      url?: string
      events?: string[]
      secret?: string
    }

    if (!body.url) {
      return reply.code(400).send({ error: 'URL requerida' })
    }

    const secret = body.secret || crypto.randomBytes(32).toString('hex')

    const webhook = await prisma.webhook.create({
      data: {
        companyId,
        url: body.url,
        events: body.events || ['document.created', 'purchase.created'],
        secret,
      },
    })

    return reply.send({ webhook })
  })

  // Listar webhooks
  fastify.get('/webhooks', async (request, reply) => {
    const companyId = request.companyId
    const webhooks = await prisma.webhook.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
    })
    return reply.send({ webhooks })
  })

  // Actualizar webhook
  fastify.patch('/webhooks/:id', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }
    const body = request.body as {
      url?: string
      events?: string[]
      active?: boolean
    }

    const webhook = await prisma.webhook.updateMany({
      where: { id, companyId },
      data: body,
    })

    return reply.send({ success: webhook.count > 0 })
  })

  // Eliminar webhook
  fastify.delete('/webhooks/:id', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }

    await prisma.webhook.deleteMany({
      where: { id, companyId },
    })

    return reply.send({ success: true })
  })
}
