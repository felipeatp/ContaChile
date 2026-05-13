import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'

export default async function (fastify: FastifyInstance) {
  fastify.get('/documents', async (request, reply) => {
    const query = request.query as { status?: string; page?: string; limit?: string }
    const where: Record<string, unknown> = {}

    if (query.status) {
      where.status = query.status
    }

    const page = parseInt(query.page || '1', 10)
    const limit = parseInt(query.limit || '20', 10)
    const skip = (page - 1) * limit

    const [documents, total] = await Promise.all([
      prisma.document.findMany({
        where,
        orderBy: { emittedAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.document.count({ where }),
    ])

    return reply.send({ documents, total, page, limit })
  })

  fastify.get('/documents/:id', async (request, reply) => {
    const { id } = request.params as { id: string }

    const document = await prisma.document.findUnique({
      where: { id },
      include: { items: true },
    })

    if (!document) {
      return reply.code(404).send({ error: 'Document not found' })
    }

    return reply.send(document)
  })
}
