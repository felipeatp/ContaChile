import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import { SIIClient } from '@contachile/transport-sii'
import { AceptaClient } from '@contachile/transport-acepta'
import { createEmailService } from '../../lib/email'

const siiClient = new SIIClient({
  baseURL: process.env.SII_BASE_URL || 'https://maullin.sii.cl',
  env: (process.env.SII_ENV as 'test' | 'production') || 'test',
})

const aceptaClient = new AceptaClient({
  apiKey: process.env.ACEPTA_API_KEY || 'test-key',
  baseURL: process.env.ACEPTA_BASE_URL,
})

const emailService = createEmailService()

export default async function (fastify: FastifyInstance) {
  fastify.get('/documents', async (request, reply) => {
    const companyId = request.companyId
    const query = request.query as { status?: string; page?: string; limit?: string }
    const where: Record<string, unknown> = { companyId }

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
    const companyId = request.companyId
    const { id } = request.params as { id: string }

    const document = await prisma.document.findFirst({
      where: { id, companyId },
      include: { items: true },
    })

    if (!document) {
      return reply.code(404).send({ error: 'Document not found' })
    }

    return reply.send(document)
  })

  fastify.post('/documents/:id/check-status', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }

    const doc = await prisma.document.findFirst({
      where: { id, companyId },
    })

    if (!doc) {
      return reply.code(404).send({ error: 'Document not found' })
    }

    if (!doc.trackId) {
      return reply.code(400).send({ error: 'Documento sin trackId' })
    }

    const source = doc.trackId.startsWith('ACEPTA-') ? 'acepta' : 'sii'

    const statusResult =
      source === 'sii'
        ? await siiClient.queryStatus(doc.trackId)
        : await aceptaClient.queryStatus(doc.trackId)

    if (statusResult.status !== doc.status) {
      await prisma.document.update({
        where: { id },
        data: {
          status: statusResult.status,
          ...(statusResult.status === 'ACCEPTED'
            ? { acceptedAt: new Date() }
            : statusResult.status === 'REJECTED'
              ? { rejectedAt: new Date(), rejectionReason: statusResult.detail }
              : {}),
        },
      })

      if (statusResult.status === 'ACCEPTED' && doc.receiverEmail) {
        await emailService.sendDocumentAccepted({
          documentId: doc.id,
          folio: doc.folio,
          type: doc.type,
          receiverName: doc.receiverName,
          receiverEmail: doc.receiverEmail,
        })
      }

      await prisma.auditLog.create({
        data: {
          documentId: id,
          action: statusResult.status,
          payload: { source, detail: statusResult.detail },
        },
      })
    }

    return reply.send({
      id: doc.id,
      status: statusResult.status,
      previousStatus: doc.status,
      changed: statusResult.status !== doc.status,
    })
  })
}
