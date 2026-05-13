import { FastifyInstance } from 'fastify'
import { EmitDocumentSchema, calcularIVA, calcularTotal } from '@contachile/validators'
import { prisma } from '@contachile/db'

export default async function (fastify: FastifyInstance) {
  fastify.post('/dte/emit', async (request, reply) => {
    const body = EmitDocumentSchema.parse(request.body)
    const companyId = request.companyId

    const neto = body.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
    const tax = calcularIVA(neto)
    const total = calcularTotal(neto)

    const counter = await prisma.folioCounter.findUnique({
      where: { companyId_type: { companyId, type: body.type } },
    })

    const folio = counter ? counter.nextFolio : 1

    if (counter) {
      await prisma.folioCounter.update({
        where: { id: counter.id },
        data: { nextFolio: { increment: 1 } },
      })
    } else {
      await prisma.folioCounter.create({
        data: { companyId, type: body.type, nextFolio: 2 },
      })
    }

    const trackId = `SII-${Date.now()}`

    const doc = await prisma.document.create({
      data: {
        type: body.type,
        folio,
        status: 'PENDING',
        trackId,
        receiverRut: body.receiver.rut,
        receiverName: body.receiver.name,
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
            payload: { source: 'direct' },
          },
        },
      },
    })

    return reply.code(201).send({
      id: doc.id,
      type: doc.type,
      folio: doc.folio,
      status: doc.status,
      trackId: doc.trackId,
      createdAt: doc.emittedAt.toISOString(),
    })
  })
}
