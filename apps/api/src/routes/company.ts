import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import { UpdateCompanySchema } from '@contachile/validators'

export default async function (fastify: FastifyInstance) {
  fastify.get('/company', async (request, reply) => {
    const companyId = request.companyId

    let company = await prisma.company.findUnique({
      where: { id: companyId },
    })

    if (!company) {
      // En modo dev bypass o primera vez, crear automáticamente
      company = await prisma.company.create({
        data: {
          id: companyId,
          rut: '76.123.456-7',
          name: 'Empresa de Prueba SpA',
        },
      })
    }

    return reply.send(company)
  })

  fastify.patch('/company', async (request, reply) => {
    const companyId = request.companyId
    const body = request.body as Record<string, unknown>

    const parsed = UpdateCompanySchema.safeParse(body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', issues: parsed.error.issues })
    }

    const data = parsed.data

    const company = await prisma.company.upsert({
      where: { id: companyId },
      update: data,
      create: {
        id: companyId,
        rut: data.rut ?? '76.123.456-7',
        name: data.name ?? 'Empresa de Prueba SpA',
        ...data,
      },
    })

    return reply.send(company)
  })

  fastify.post('/company/certificate', async (request, reply) => {
    const companyId = request.companyId
    const body = request.body as { certBase64?: string; password?: string }

    if (!body.certBase64 || body.certBase64.length < 100) {
      return reply.code(400).send({ error: 'Certificado inválido o vacío' })
    }

    const company = await prisma.company.upsert({
      where: { id: companyId },
      update: {
        certEncrypted: body.certBase64,
        certPassword: body.password || null,
      },
      create: {
        id: companyId,
        rut: '76.123.456-7',
        name: 'Empresa de Prueba SpA',
        certEncrypted: body.certBase64,
        certPassword: body.password || null,
      },
    })

    return reply.send({
      id: company.id,
      siiCertified: company.siiCertified,
      certUploaded: !!company.certEncrypted,
    })
  })
}
