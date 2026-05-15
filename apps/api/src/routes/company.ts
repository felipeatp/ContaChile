import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import { UpdateCompanySchema, PUC_BASE_ACCOUNTS } from '@contachile/validators'

async function seedPucBase(companyId: string): Promise<void> {
  const existingCount = await prisma.account.count({ where: { companyId } })
  if (existingCount > 0) return // Already seeded

  await prisma.account.createMany({
    data: PUC_BASE_ACCOUNTS.map((acc) => ({
      companyId,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      description: acc.description,
      isSystem: true,
    })),
    skipDuplicates: true,
  })
}

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
      await seedPucBase(companyId)
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
    await seedPucBase(companyId)

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
    await seedPucBase(companyId)

    return reply.send({
      id: company.id,
      siiCertified: company.siiCertified,
      certUploaded: !!company.certEncrypted,
    })
  })
}
