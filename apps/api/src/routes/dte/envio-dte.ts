import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import { buildEnvioDTE, extractPrivateKeyFromPfx } from '@contachile/dte'

export default async function (fastify: FastifyInstance) {
  fastify.post('/dte/envio', async (request, reply) => {
    const companyId = request.companyId
    const body = request.body as { documentIds?: string[] }

    if (!body.documentIds || body.documentIds.length === 0) {
      return reply.code(400).send({ error: 'Debes seleccionar al menos un documento' })
    }

    const company = await prisma.company.findUnique({ where: { id: companyId } })
    if (!company) {
      return reply.code(400).send({ error: 'Empresa no configurada' })
    }
    if (!company.certEncrypted || company.certEncrypted.length < 100) {
      return reply.code(400).send({ error: 'Certificado digital requerido para generar EnvioDTE' })
    }

    const docs = await prisma.document.findMany({
      where: {
        id: { in: body.documentIds },
        companyId,
        xmlContent: { not: null },
      },
    })

    if (docs.length === 0) {
      return reply.code(400).send({ error: 'Ningún documento seleccionado tiene XML firmado' })
    }

    const dteXmls = docs.map((d) => d.xmlContent!).filter(Boolean)

    let privateKeyPem: string
    try {
      privateKeyPem = extractPrivateKeyFromPfx(
        company.certEncrypted,
        company.certPassword ?? ''
      )
    } catch {
      return reply.code(400).send({ error: 'No se pudo extraer la clave privada del certificado' })
    }

    const envioXml = buildEnvioDTE({
      companyRut: company.rut,
      companyName: company.name,
      resolutionDate: '2024-01-01', // TODO: make configurable
      resolutionNumber: 0, // 0 = test environment
      dteXmls,
      privateKeyPem,
    })

    return reply
      .header('Content-Type', 'application/xml; charset=ISO-8859-1')
      .header('Content-Disposition', `attachment; filename="EnvioDTE-${Date.now()}.xml"`)
      .send(envioXml)
  })
}
