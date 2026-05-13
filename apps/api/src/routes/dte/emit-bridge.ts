import { FastifyInstance } from 'fastify'
import { EmitDocumentSchema } from '@contachile/validators'
import { AceptaClient } from '@contachile/transport-acepta'

export default async function (fastify: FastifyInstance) {
  fastify.post('/dte/emit-bridge', async (request, reply) => {
    const body = EmitDocumentSchema.parse(request.body)
    const companyId = request.companyId

    // Stub: simulate bridge emission (real Acepta integration in follow-up)
    const documentId = `ACEPTA-${Date.now()}`

    return reply.code(201).send({
      id: `doc-${Date.now()}`,
      type: body.type,
      status: 'PENDING',
      trackId: documentId,
      createdAt: new Date().toISOString(),
    })
  })
}
