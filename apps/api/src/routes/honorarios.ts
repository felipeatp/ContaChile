import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import {
  CreateHonorarioSchema,
  UpdateHonorarioSchema,
  HonorarioListQuerySchema,
  calcularRetencionHonorarios,
  validateRUT,
} from '@contachile/validators'
import { createHonorarioEntry } from '../lib/accounting-entries'

export default async function (fastify: FastifyInstance) {
  fastify.get('/honorarios', async (request, reply) => {
    const companyId = request.companyId
    const parsed = HonorarioListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Parámetros inválidos', issues: parsed.error.issues })
    }
    const { type, year, month } = parsed.data

    const where: Record<string, unknown> = { companyId }
    if (type) where.type = type
    if (year || month) {
      const yearNum = year ? parseInt(year, 10) : new Date().getFullYear()
      const monthNum = month ? parseInt(month, 10) - 1 : 0
      const endMonth = month ? monthNum : 11
      const start = new Date(yearNum, monthNum, 1)
      const end = new Date(yearNum, endMonth + 1, 1)
      where.date = { gte: start, lt: end }
    }

    const honorarios = await prisma.honorario.findMany({
      where,
      orderBy: { date: 'desc' },
    })

    const totals = honorarios.reduce(
      (acc, h) => {
        if (h.type === 'ISSUED') {
          acc.issuedGross += h.grossAmount
          acc.issuedRetention += h.retentionAmount
          acc.issuedNet += h.netAmount
        } else {
          acc.receivedGross += h.grossAmount
          acc.receivedRetention += h.retentionAmount
          acc.receivedNet += h.netAmount
        }
        return acc
      },
      {
        issuedGross: 0,
        issuedRetention: 0,
        issuedNet: 0,
        receivedGross: 0,
        receivedRetention: 0,
        receivedNet: 0,
      }
    )

    return reply.send({ honorarios, totals })
  })

  fastify.get('/honorarios/:id', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }

    const honorario = await prisma.honorario.findFirst({
      where: { id, companyId },
    })
    if (!honorario) return reply.code(404).send({ error: 'Boleta no encontrada' })
    return reply.send(honorario)
  })

  fastify.post('/honorarios', async (request, reply) => {
    const companyId = request.companyId
    const parsed = CreateHonorarioSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', issues: parsed.error.issues })
    }
    const data = parsed.data

    if (!validateRUT(data.counterpartRut)) {
      return reply.code(400).send({ error: 'RUT inválido' })
    }

    const existing = await prisma.honorario.findUnique({
      where: { companyId_type_number: { companyId, type: data.type, number: data.number } },
    })
    if (existing) {
      return reply.code(409).send({ error: 'Boleta duplicada (mismo tipo y número)' })
    }

    const calc = calcularRetencionHonorarios(data.grossAmount, data.retentionRate)

    const honorario = await prisma.honorario.create({
      data: {
        companyId,
        type: data.type,
        number: data.number,
        date: new Date(data.date),
        counterpartRut: data.counterpartRut,
        counterpartName: data.counterpartName,
        description: data.description,
        grossAmount: calc.gross,
        retentionRate: calc.rate,
        retentionAmount: calc.retention,
        netAmount: calc.net,
      },
    })

    if (honorario.type === 'RECEIVED') {
      await createHonorarioEntry(honorario, fastify.log).catch((err: Error) => {
        fastify.log.warn(
          { err: err.message, honorarioId: honorario.id },
          'createHonorarioEntry falló — boleta registrada sin asiento'
        )
      })
    }

    return reply.code(201).send(honorario)
  })

  fastify.patch('/honorarios/:id', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }
    const parsed = UpdateHonorarioSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', issues: parsed.error.issues })
    }
    const data = parsed.data

    const existing = await prisma.honorario.findFirst({
      where: { id, companyId },
    })
    if (!existing) return reply.code(404).send({ error: 'Boleta no encontrada' })

    const updated = await prisma.honorario.update({
      where: { id },
      data: {
        ...data,
        paidAt: data.paidAt ? new Date(data.paidAt) : undefined,
      },
    })

    return reply.send(updated)
  })

  fastify.delete('/honorarios/:id', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }

    const existing = await prisma.honorario.findFirst({
      where: { id, companyId },
    })
    if (!existing) return reply.code(404).send({ error: 'Boleta no encontrada' })

    await prisma.honorario.delete({ where: { id } })
    return reply.code(204).send()
  })
}
