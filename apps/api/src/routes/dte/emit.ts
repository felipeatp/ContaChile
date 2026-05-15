import { FastifyInstance } from 'fastify'
import { EmitDocumentSchema, calcularIVA, calcularTotal } from '@contachile/validators'
import { prisma } from '@contachile/db'
import { runPipeline, extractPrivateKeyFromPfx } from '@contachile/dte'
import { enqueuePollJob } from '../../queues/dte'
import { createEmailService } from '../../lib/email'

export default async function (fastify: FastifyInstance) {
  fastify.post('/dte/emit', async (request, reply) => {
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
          folio: existing.folio,
          status: existing.status,
          trackId: existing.trackId,
          createdAt: existing.emittedAt.toISOString(),
        })
      }
    }

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
    const emittedAt = new Date().toISOString().split('T')[0]

    let xmlContent: string | undefined
    let pdfBuffer: Buffer | undefined

    const certEncrypted = company.certEncrypted
    const hasCert = !!certEncrypted && certEncrypted.length > 100
    if (hasCert) {
      try {
        const privateKeyPem = extractPrivateKeyFromPfx(
          certEncrypted,
          company.certPassword ?? ''
        )

        const result = await runPipeline({
          type: body.type,
          folio,
          company: {
            rut: company.rut,
            name: company.name,
            address: company.address || 'Dirección no especificada',
            commune: company.commune || 'Santiago',
            city: company.city || 'Santiago',
            giro: company.giro || undefined,
            economicActivity: company.economicActivity || '620200',
            cert: privateKeyPem,
          },
          receiver: {
            rut: body.receiver.rut,
            name: body.receiver.name,
            address: body.receiver.address,
            commune: body.receiver.commune,
            city: body.receiver.city,
          },
          items: body.items,
          paymentMethod: body.paymentMethod,
          emittedAt,
          references: body.references,
        })

        xmlContent = result.xml
        pdfBuffer = result.pdf
      } catch (signErr: unknown) {
        const message = signErr instanceof Error ? signErr.message : String(signErr)
        fastify.log.warn({ err: message }, 'Firma DTE falló, emitiendo sin XML firmado')
      }
    }

    const doc = await prisma.document.create({
      data: {
        type: body.type,
        folio,
        status: 'PENDING',
        trackId,
        idempotencyKey,
        xmlContent: xmlContent || null,
        companyId,
        receiverRut: body.receiver.rut,
        receiverName: body.receiver.name,
        receiverEmail: body.receiver.email || null,
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
              source: 'direct',
              signed: !!xmlContent,
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

    await enqueuePollJob({ documentId: doc.id, trackId, source: 'sii' })

    return reply.code(201).send({
      id: doc.id,
      type: doc.type,
      folio: doc.folio,
      status: doc.status,
      trackId: doc.trackId,
      signed: !!xmlContent,
      createdAt: doc.emittedAt.toISOString(),
    })
  })
}
