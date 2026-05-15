import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'

export default async function (fastify: FastifyInstance) {
  fastify.get('/receivers', async (request, reply) => {
    const companyId = request.companyId
    const query = request.query as { search?: string }

    const search = query.search?.trim() ?? ''

    const where: Record<string, unknown> = { companyId }

    if (search.length >= 3) {
      where.OR = [
        { receiverRut: { contains: search, mode: 'insensitive' } },
        { receiverName: { contains: search, mode: 'insensitive' } },
      ]
    }

    const documents = await prisma.document.findMany({
      where,
      orderBy: { emittedAt: 'desc' },
      select: {
        receiverRut: true,
        receiverName: true,
        receiverEmail: true,
      },
      take: 20,
    })

    // Deduplicate by RUT, keeping the most recent
    const seen = new Set<string>()
    const unique = []
    for (const doc of documents) {
      const rut = doc.receiverRut?.trim().toUpperCase()
      if (!rut || seen.has(rut)) continue
      seen.add(rut)
      unique.push({
        rut: doc.receiverRut,
        name: doc.receiverName,
        email: doc.receiverEmail,
      })
    }

    return reply.send({ receivers: unique })
  })
}
