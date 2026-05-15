import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import { z } from 'zod'

const AccountTypeEnum = z.enum(['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO', 'COSTO'])

const CreateAccountSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  type: AccountTypeEnum,
  parentCode: z.string().optional(),
  description: z.string().optional(),
})

const UpdateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
})

export default async function (fastify: FastifyInstance) {
  fastify.get('/accounts', async (request, reply) => {
    const companyId = request.companyId
    const { type, active } = request.query as { type?: string; active?: string }

    const accounts = await prisma.account.findMany({
      where: {
        companyId,
        ...(type ? { type: type as any } : {}),
        ...(active === 'true' ? { isActive: true } : active === 'false' ? { isActive: false } : {}),
      },
      orderBy: { code: 'asc' },
    })

    return reply.send({ accounts })
  })

  fastify.post('/accounts', async (request, reply) => {
    const companyId = request.companyId
    const body = CreateAccountSchema.safeParse(request.body)
    if (!body.success) {
      return reply.code(400).send({ error: 'Invalid body', details: body.error.format() })
    }

    const existing = await prisma.account.findUnique({
      where: { companyId_code: { companyId, code: body.data.code } },
    })
    if (existing) {
      return reply.code(409).send({ error: 'Ya existe una cuenta con ese codigo' })
    }

    const account = await prisma.account.create({
      data: {
        companyId,
        ...body.data,
        isSystem: false,
      },
    })

    return reply.code(201).send(account)
  })

  fastify.patch('/accounts/:id', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }
    const body = UpdateAccountSchema.safeParse(request.body)
    if (!body.success) {
      return reply.code(400).send({ error: 'Invalid body', details: body.error.format() })
    }

    const account = await prisma.account.findFirst({
      where: { id, companyId },
    })
    if (!account) {
      return reply.code(404).send({ error: 'Cuenta no encontrada' })
    }

    const updated = await prisma.account.update({
      where: { id },
      data: body.data,
    })

    return reply.send(updated)
  })

  fastify.delete('/accounts/:id', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }

    const account = await prisma.account.findFirst({
      where: { id, companyId },
    })
    if (!account) {
      return reply.code(404).send({ error: 'Cuenta no encontrada' })
    }
    if (account.isSystem) {
      return reply.code(403).send({ error: 'No se pueden eliminar cuentas del PUC base' })
    }

    await prisma.account.delete({ where: { id } })
    return reply.code(204).send()
  })
}
