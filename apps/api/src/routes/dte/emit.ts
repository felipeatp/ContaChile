import { FastifyInstance } from 'fastify'
import { EmitDocumentSchema } from '@contachile/validators'
import { runPipeline } from '@contachile/dte'
import { SIIClient } from '@contachile/transport-sii'

export default async function (fastify: FastifyInstance) {
  fastify.post('/dte/emit', async (request, reply) => {
    const body = EmitDocumentSchema.parse(request.body)
    const companyId = request.companyId

    // Stub: simulate emission (DB integration and folio allocation in follow-up)

    const folio = 1 // placeholder
    const trackId = `SII-${Date.now()}`

    return reply.code(201).send({
      id: `doc-${Date.now()}`,
      type: body.type,
      folio,
      status: 'PENDING',
      trackId,
      createdAt: new Date().toISOString(),
    })
  })
}
