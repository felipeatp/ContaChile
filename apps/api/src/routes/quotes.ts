import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import {
  CreateQuoteSchema,
  UpdateQuoteSchema,
  QuoteListQuerySchema,
  calcularIVA,
  calcularTotal,
  validateRUT,
} from '@contachile/validators'
import { createSalesEntry } from '../lib/accounting-entries'
import { generateQuotePdf } from '../lib/quote-pdf'

function computeItemTotals(items: Array<{ quantity: number; unitPrice: number }>) {
  const neto = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  return { neto, iva: calcularIVA(neto), total: calcularTotal(neto) }
}

export default async function (fastify: FastifyInstance) {
  fastify.get('/quotes', async (request, reply) => {
    const companyId = request.companyId
    const parsed = QuoteListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Parámetros inválidos', issues: parsed.error.issues })
    }
    const { status, from, to } = parsed.data

    const where: Record<string, unknown> = { companyId }
    if (status) where.status = status
    if (from || to) {
      const range: Record<string, Date> = {}
      if (from) range.gte = new Date(from)
      if (to) range.lte = new Date(to + 'T23:59:59')
      where.date = range
    }

    const quotes = await prisma.quote.findMany({
      where,
      orderBy: { date: 'desc' },
      include: { items: true },
    })

    return reply.send({ quotes })
  })

  fastify.get('/quotes/:id', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }
    const quote = await prisma.quote.findFirst({
      where: { id, companyId },
      include: { items: true },
    })
    if (!quote) return reply.code(404).send({ error: 'Cotización no encontrada' })
    return reply.send(quote)
  })

  fastify.post('/quotes', async (request, reply) => {
    const companyId = request.companyId
    const parsed = CreateQuoteSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', issues: parsed.error.issues })
    }
    const data = parsed.data

    if (!validateRUT(data.receiverRut)) {
      return reply.code(400).send({ error: 'RUT del cliente inválido' })
    }

    const existing = await prisma.quote.findUnique({
      where: { companyId_number: { companyId, number: data.number } },
    })
    if (existing) {
      return reply.code(409).send({ error: 'Ya existe una cotización con ese número' })
    }

    const { neto, iva, total } = computeItemTotals(data.items)

    const quote = await prisma.quote.create({
      data: {
        companyId,
        number: data.number,
        date: data.date ? new Date(data.date) : new Date(),
        validUntil: data.validUntil ? new Date(data.validUntil) : undefined,
        receiverRut: data.receiverRut,
        receiverName: data.receiverName,
        receiverEmail: data.receiverEmail,
        receiverAddress: data.receiverAddress,
        totalNet: neto,
        totalTax: iva,
        totalAmount: total,
        paymentMethod: data.paymentMethod,
        notes: data.notes,
        items: {
          create: data.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            totalPrice: i.quantity * i.unitPrice,
          })),
        },
      },
      include: { items: true },
    })

    return reply.code(201).send(quote)
  })

  fastify.patch('/quotes/:id', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }
    const parsed = UpdateQuoteSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', issues: parsed.error.issues })
    }
    const data = parsed.data

    const existing = await prisma.quote.findFirst({ where: { id, companyId } })
    if (!existing) return reply.code(404).send({ error: 'Cotización no encontrada' })

    if (existing.status !== 'DRAFT') {
      return reply.code(400).send({ error: 'Solo se pueden editar cotizaciones en borrador' })
    }

    if (data.items) {
      const { neto, iva, total } = computeItemTotals(data.items)
      await prisma.quoteItem.deleteMany({ where: { quoteId: id } })
      await prisma.quote.update({
        where: { id },
        data: {
          ...(data.number !== undefined ? { number: data.number } : {}),
          ...(data.date ? { date: new Date(data.date) } : {}),
          ...(data.validUntil ? { validUntil: new Date(data.validUntil) } : {}),
          ...(data.receiverRut ? { receiverRut: data.receiverRut } : {}),
          ...(data.receiverName ? { receiverName: data.receiverName } : {}),
          ...(data.receiverEmail !== undefined ? { receiverEmail: data.receiverEmail } : {}),
          ...(data.receiverAddress !== undefined ? { receiverAddress: data.receiverAddress } : {}),
          ...(data.paymentMethod ? { paymentMethod: data.paymentMethod } : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
          totalNet: neto,
          totalTax: iva,
          totalAmount: total,
          items: {
            create: data.items.map((i) => ({
              description: i.description,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              totalPrice: i.quantity * i.unitPrice,
            })),
          },
        },
      })
    } else {
      await prisma.quote.update({
        where: { id },
        data: {
          ...(data.number !== undefined ? { number: data.number } : {}),
          ...(data.date ? { date: new Date(data.date) } : {}),
          ...(data.validUntil ? { validUntil: new Date(data.validUntil) } : {}),
          ...(data.receiverRut ? { receiverRut: data.receiverRut } : {}),
          ...(data.receiverName ? { receiverName: data.receiverName } : {}),
          ...(data.receiverEmail !== undefined ? { receiverEmail: data.receiverEmail } : {}),
          ...(data.receiverAddress !== undefined ? { receiverAddress: data.receiverAddress } : {}),
          ...(data.paymentMethod ? { paymentMethod: data.paymentMethod } : {}),
          ...(data.notes !== undefined ? { notes: data.notes } : {}),
        },
      })
    }

    const updated = await prisma.quote.findUnique({
      where: { id },
      include: { items: true },
    })
    return reply.send(updated)
  })

  fastify.delete('/quotes/:id', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }

    const existing = await prisma.quote.findFirst({ where: { id, companyId } })
    if (!existing) return reply.code(404).send({ error: 'Cotización no encontrada' })
    if (existing.status !== 'DRAFT') {
      return reply.code(400).send({ error: 'Solo se pueden eliminar cotizaciones en borrador' })
    }

    await prisma.quote.delete({ where: { id } })
    return reply.code(204).send()
  })

  fastify.post('/quotes/:id/send', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }
    const quote = await prisma.quote.findFirst({ where: { id, companyId } })
    if (!quote) return reply.code(404).send({ error: 'No encontrada' })
    if (quote.status !== 'DRAFT') {
      return reply.code(400).send({ error: `No se puede enviar desde estado ${quote.status}` })
    }
    const updated = await prisma.quote.update({
      where: { id },
      data: { status: 'SENT', sentAt: new Date() },
    })
    return reply.send(updated)
  })

  fastify.post('/quotes/:id/accept', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }
    const quote = await prisma.quote.findFirst({ where: { id, companyId } })
    if (!quote) return reply.code(404).send({ error: 'No encontrada' })
    if (!['DRAFT', 'SENT'].includes(quote.status)) {
      return reply.code(400).send({ error: `No se puede aceptar desde estado ${quote.status}` })
    }
    const updated = await prisma.quote.update({
      where: { id },
      data: { status: 'ACCEPTED', acceptedAt: new Date(), sentAt: quote.sentAt ?? new Date() },
    })
    return reply.send(updated)
  })

  fastify.post('/quotes/:id/reject', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }
    const body = (request.body || {}) as { reason?: string }
    const quote = await prisma.quote.findFirst({ where: { id, companyId } })
    if (!quote) return reply.code(404).send({ error: 'No encontrada' })
    if (!['SENT', 'DRAFT'].includes(quote.status)) {
      return reply.code(400).send({ error: `No se puede rechazar desde estado ${quote.status}` })
    }
    const updated = await prisma.quote.update({
      where: { id },
      data: { status: 'REJECTED', rejectedAt: new Date(), rejectionReason: body.reason },
    })
    return reply.send(updated)
  })

  fastify.post('/quotes/:id/to-invoice', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }

    const quote = await prisma.quote.findFirst({
      where: { id, companyId },
      include: { items: true },
    })
    if (!quote) return reply.code(404).send({ error: 'Cotización no encontrada' })
    if (quote.status !== 'ACCEPTED') {
      return reply.code(400).send({ error: `Solo se pueden facturar cotizaciones ACEPTADAS (estado actual: ${quote.status})` })
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } })
    if (!company || !company.rut || !company.name) {
      return reply.code(400).send({ error: 'Empresa no configurada (RUT y razón social son obligatorios)' })
    }

    const counter = await prisma.folioCounter.findUnique({
      where: { companyId_type: { companyId, type: 33 } },
    })
    const folio = counter ? counter.nextFolio : 1
    if (counter) {
      await prisma.folioCounter.update({
        where: { id: counter.id },
        data: { nextFolio: { increment: 1 } },
      })
    } else {
      await prisma.folioCounter.create({
        data: { companyId, type: 33, nextFolio: 2 },
      })
    }

    const trackId = `QUOTE-${quote.id.slice(-6)}-${Date.now()}`

    const doc = await prisma.document.create({
      data: {
        type: 33,
        folio,
        status: 'PENDING',
        trackId,
        companyId,
        receiverRut: quote.receiverRut,
        receiverName: quote.receiverName,
        receiverEmail: quote.receiverEmail,
        receiverAddress: quote.receiverAddress,
        totalNet: quote.totalNet,
        totalTax: quote.totalTax,
        totalAmount: quote.totalAmount,
        paymentMethod: quote.paymentMethod,
        items: {
          create: quote.items.map((i) => ({
            description: i.description,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
            totalPrice: i.totalPrice,
          })),
        },
        auditLogs: {
          create: {
            action: 'EMIT',
            payload: { source: 'quote', quoteId: quote.id, quoteNumber: quote.number },
          },
        },
      },
    })

    await createSalesEntry(doc, fastify.log).catch((err: Error) => {
      fastify.log.warn(
        { err: err.message, docId: doc.id },
        'createSalesEntry falló — Document creado sin asiento'
      )
    })

    const updatedQuote = await prisma.quote.update({
      where: { id },
      data: {
        status: 'INVOICED',
        invoicedAt: new Date(),
        invoicedDocumentId: doc.id,
      },
    })

    return reply.code(201).send({ document: doc, quote: updatedQuote })
  })

  fastify.get('/quotes/:id/pdf', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }

    const quote = await prisma.quote.findFirst({
      where: { id, companyId },
      include: { items: true },
    })
    if (!quote) return reply.code(404).send({ error: 'Cotización no encontrada' })

    const company = await prisma.company.findUnique({ where: { id: companyId } })
    if (!company) return reply.code(400).send({ error: 'Empresa no configurada' })

    const pdf = await generateQuotePdf({ quote, company })

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="cotizacion-${quote.number}.pdf"`)
      .send(pdf)
  })
}
