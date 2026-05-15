import { FastifyInstance } from 'fastify'
import { EmitDocumentSchema, calcularIVA, calcularTotal } from '@contachile/validators'
import { prisma } from '@contachile/db'
import { enqueuePollJob } from '../../queues/dte'
import { createEmailService } from '../../lib/email'

export default async function (fastify: FastifyInstance) {
  fastify.post('/dte/emit-bridge', async (request, reply) => {
    const body = EmitDocumentSchema.parse(request.body)
    const companyId = request.companyId
    const idempotencyKey = request.headers['idempotency-key'] as string | undefined

    const company = await prisma.company.findUnique({ where: { id: companyId } })
    if (!company) {
      return reply.code(400).send({ error: 'Empresa no configurada. Ve a Configuración y completa tus datos.' })
    }
    if (!company.rut || !company.name) {
      return reply.code(400).send({ error: 'RUT y Razón Social de la empresa son obligatorios para emitir DTE.' })
    }

    if (idempotencyKey) {
      const existing = await prisma.document.findUnique({
        where: { idempotencyKey },
      })
      if (existing) {
        return reply.code(201).send({
          id: existing.id,
          type: existing.type,
          status: existing.status,
          trackId: existing.trackId,
          createdAt: existing.emittedAt.toISOString(),
        })
      }
    }

    const neto = body.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    const tax = calcularIVA(neto)
    const total = calcularTotal(neto)

    const trackId = `ACEPTA-${Date.now()}`

    const doc = await prisma.document.create({
      data: {
        type: body.type,
        folio: 0,
        status: 'PENDING',
        trackId,
        idempotencyKey,
        companyId,
        receiverRut: body.receiver.rut,
        receiverName: body.receiver.name,
        receiverEmail: body.receiver.email,
        totalNet: neto,
        totalTax: tax,
        totalAmount: total,
        paymentMethod: body.paymentMethod,
        items: {
          create: body.items.map((item) => ({
            description: item.description,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
            totalPrice: item.quantity * item.unitPrice,
          })),
        },
        auditLogs: {
          create: {
            action: 'EMIT',
            payload: {
              source: 'bridge',
              emitter: { rut: company.rut, name: company.name, giro: company.giro },
            },
          },
        },
      },
    })

    const emailService = createEmailService()
    if (doc.receiverEmail) {
      await emailService.sendDocumentEmitted({
        documentId: doc.id,
        folio: doc.folio,
        type: doc.type,
        receiverName: doc.receiverName,
        receiverEmail: doc.receiverEmail,
      })
    }

    await enqueuePollJob({ documentId: doc.id, trackId, source: 'acepta' })

    return reply.code(201).send({
      id: doc.id,
      type: doc.type,
      status: doc.status,
      trackId: doc.trackId,
      createdAt: doc.emittedAt.toISOString(),
    })
  })
}
