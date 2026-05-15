import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'

export default async function (fastify: FastifyInstance) {
  fastify.get('/documents/:id/xml', async (request, reply) => {
    const { id } = request.params as { id: string }

    const doc = await prisma.document.findUnique({
      where: { id },
    })

    if (!doc) {
      return reply.code(404).send({ error: 'Document not found' })
    }

    if (!doc.xmlContent) {
      return reply.code(404).send({ error: 'XML no disponible para este documento' })
    }

    return reply
      .header('Content-Type', 'application/xml; charset=ISO-8859-1')
      .header('Content-Disposition', `attachment; filename="DTE-${doc.type}-${doc.folio}.xml"`)
      .send(doc.xmlContent)
  })
}
