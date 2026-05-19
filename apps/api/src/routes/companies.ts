import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'

export default async function (fastify: FastifyInstance) {
  // GET /companies — lista las empresas del usuario autenticado
  fastify.get('/companies', async (request, reply) => {
    const userId = request.userId
    if (!userId) {
      return reply.code(401).send({ error: 'Unauthorized' })
    }

    const memberships = await prisma.companyMembership.findMany({
      where: { userId },
      include: {
        company: {
          select: {
            id: true,
            name: true,
            rut: true,
            createdAt: true,
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    })

    return reply.send({
      companies: memberships.map((m) => ({
        id: m.company.id,
        name: m.company.name,
        rut: m.company.rut,
        role: m.role,
        joinedAt: m.createdAt,
      })),
    })
  })
}
