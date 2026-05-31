import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import { procesarDocumentoOCR, validateOCRExtraction } from '@contachile/ai-agents'
import { calcularIVA } from '@contachile/validators'

export default async function (fastify: FastifyInstance) {
  fastify.post('/ocr/document', async (request, reply) => {
    const companyId = request.companyId
    const body = request.body as {
      imageBase64?: string
      mimeType?: string
    }

    if (!body.imageBase64) {
      return reply.code(400).send({ error: 'imageBase64 requerido' })
    }

    // Validar tamaño máximo (5MB aprox base64)
    if (body.imageBase64.length > 7_000_000) {
      return reply.code(400).send({ error: 'Imagen muy grande. Máximo 5MB.' })
    }

    const mimeType = body.mimeType || 'image/jpeg'
    const imageUrl = `data:${mimeType};base64,${body.imageBase64}`

    const ocrDoc = await prisma.ocrDocument.create({
      data: {
        companyId,
        imageUrl,
        status: 'PROCESSING',
      },
    })

    try {
      const result = await procesarDocumentoOCR(body.imageBase64, mimeType)

      if (result.tipo === 'desconocido' || result.confianza < 0.3) {
        await prisma.ocrDocument.update({
          where: { id: ocrDoc.id },
          data: { status: 'ERROR', errorDetail: 'Documento no identificado o confianza baja' },
        })
        return reply.code(422).send({
          error: 'No se pudo identificar el documento. Intenta con otra imagen más clara.',
          ocr: result,
        })
      }

      // Validar datos extraídos antes de guardar
      const validationErrors = validateOCRExtraction(result)
      if (validationErrors.length > 0) {
        await prisma.ocrDocument.update({
          where: { id: ocrDoc.id },
          data: {
            status: 'REQUIRES_REVIEW' as any,
            extractedData: result as any,
            errorDetail: validationErrors.join('; '),
          },
        })
        return reply.send({
          status: 'requires_review',
          ocr: { ...result, validationErrors },
          validationErrors,
          message: 'Los datos extraídos requieren revisión manual antes de guardar.',
        })
      }

      // Crear compra con estado PENDING_APPROVAL
      const neto = result.montoNeto || 0
      const iva = result.iva || (neto > 0 ? calcularIVA(neto) : 0)
      const total = result.montoTotal || neto + iva

      const purchase = await prisma.purchase.create({
        data: {
          companyId,
          type: result.tipo === 'factura' ? 33 : 46,
          folio: result.numero ? parseInt(result.numero.replace(/\D/g, ''), 10) || 0 : 0,
          date: result.fecha ? parseChileanDate(result.fecha) : new Date(),
          issuerRut: result.rutEmisor || '',
          issuerName: result.nombreEmisor || 'Desconocido',
          description: result.descripcion || `Documento OCR: ${result.tipo}`,
          netAmount: neto,
          taxAmount: iva,
          totalAmount: total,
          status: 'PENDING_APPROVAL',
          source: 'ocr',
        },
      })

      await prisma.ocrDocument.update({
        where: { id: ocrDoc.id },
        data: {
          status: 'PROCESSED',
          extractedData: result as any,
          purchaseId: purchase.id,
        },
      })

      return reply.send({
        ocr: result,
        purchase: {
          id: purchase.id,
          type: purchase.type,
          folio: purchase.folio,
          date: purchase.date,
          issuerName: purchase.issuerName,
          totalAmount: purchase.totalAmount,
          status: purchase.status,
        },
      })
    } catch (err: any) {
      await prisma.ocrDocument.update({
        where: { id: ocrDoc.id },
        data: { status: 'ERROR', errorDetail: err.message || 'Error desconocido' },
      })
      fastify.log.warn({ err }, 'OCR processing failed')
      return reply.code(500).send({ error: 'Error al procesar imagen con IA' })
    }
  })

  fastify.get('/ocr/documents', async (request, reply) => {
    const companyId = request.companyId
    const docs = await prisma.ocrDocument.findMany({
      where: { companyId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })
    return reply.send({ documents: docs })
  })
}

function parseChileanDate(dateStr: string): Date {
  const parts = dateStr.split('/')
  if (parts.length === 3) {
    const [day, month, year] = parts.map(Number)
    return new Date(year, month - 1, day)
  }
  return new Date()
}
