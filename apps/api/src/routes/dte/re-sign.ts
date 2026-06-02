import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import { runPipeline, extractPrivateKeyFromPfx } from '@contachile/dte'

export default async function (fastify: FastifyInstance) {
  fastify.post('/documents/:id/re-sign', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }

    const doc = await prisma.document.findFirst({
      where: { id, companyId, status: { in: ['FAILED', 'REJECTED'] } },
      include: { items: true },
    })

    if (!doc) {
      return reply.code(404).send({
        error: 'Documento no encontrado o no está en estado FAILED/REJECTED',
      })
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } })
    if (!company?.certEncrypted || company.certEncrypted.length <= 100) {
      return reply.code(400).send({
        error: 'El certificado digital no está configurado. Ve a Configuración → Certificado para subirlo.',
      })
    }

    if (!company.certPassword) {
      return reply.code(400).send({
        error: 'El certificado digital no está configurado. Ve a Configuración → Certificado para subirlo.',
      })
    }

    try {
      const privateKeyPem = extractPrivateKeyFromPfx(company.certEncrypted, company.certPassword)

      const result = await runPipeline({
        type: doc.type,
        folio: doc.folio,
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
          rut: doc.receiverRut,
          name: doc.receiverName,
          address: doc.receiverAddress || '',
          commune: doc.receiverCommune || 'Santiago',
          city: doc.receiverCity || 'Santiago',
        },
        items: doc.items.map((item) => ({
          description: item.description,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        paymentMethod: (doc.paymentMethod as 'CONTADO' | 'CREDITO') ?? 'CONTADO',
        emittedAt: doc.emittedAt.toISOString().split('T')[0],
      })

      await prisma.document.update({
        where: { id },
        data: {
          xmlContent: result.xml,
          status: 'PENDING',
          rejectionReason: null,
        },
      })

      await prisma.auditLog.create({
        data: {
          documentId: id,
          action: 'RE_SIGN',
          payload: { signed: !!result.xml },
        },
      })

      return reply.send({ id, signed: !!result.xml, status: 'PENDING' })
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err)
      fastify.log.warn({ err: msg, docId: id }, 'Re-sign falló')
      return reply.code(500).send({ error: `Error al re-firmar: ${msg}` })
    }
  })
}
