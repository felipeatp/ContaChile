import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import {
  CreateEmployeeSchema,
  UpdateEmployeeSchema,
  validateRUT,
} from '@contachile/validators'

export default async function (fastify: FastifyInstance) {
  fastify.get('/employees', async (request, reply) => {
    const companyId = request.companyId
    const { active } = request.query as { active?: string }

    const employees = await prisma.employee.findMany({
      where: {
        companyId,
        ...(active === 'true' ? { isActive: true } : active === 'false' ? { isActive: false } : {}),
      },
      orderBy: { name: 'asc' },
    })

    return reply.send({ employees })
  })

  fastify.get('/employees/:id', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }

    const employee = await prisma.employee.findFirst({
      where: { id, companyId },
    })

    if (!employee) return reply.code(404).send({ error: 'Trabajador no encontrado' })
    return reply.send(employee)
  })

  fastify.post('/employees', async (request, reply) => {
    const companyId = request.companyId
    const parsed = CreateEmployeeSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', issues: parsed.error.issues })
    }
    const data = parsed.data

    if (!validateRUT(data.rut)) {
      return reply.code(400).send({ error: 'RUT inválido' })
    }

    const existing = await prisma.employee.findUnique({
      where: { companyId_rut: { companyId, rut: data.rut } },
    })
    if (existing) {
      return reply.code(409).send({ error: 'Ya existe un trabajador con ese RUT' })
    }

    const employee = await prisma.employee.create({
      data: {
        companyId,
        rut: data.rut,
        name: data.name,
        email: data.email,
        position: data.position,
        startDate: new Date(data.startDate),
        endDate: data.endDate ? new Date(data.endDate) : undefined,
        contractType: data.contractType,
        workHours: data.workHours,
        baseSalary: data.baseSalary,
        afp: data.afp,
        healthPlan: data.healthPlan,
        healthAmount: data.healthAmount,
      },
    })

    return reply.code(201).send(employee)
  })

  fastify.patch('/employees/:id', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }
    const parsed = UpdateEmployeeSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', issues: parsed.error.issues })
    }
    const data = parsed.data

    if (data.rut && !validateRUT(data.rut)) {
      return reply.code(400).send({ error: 'RUT inválido' })
    }

    const existing = await prisma.employee.findFirst({
      where: { id, companyId },
    })
    if (!existing) return reply.code(404).send({ error: 'Trabajador no encontrado' })

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        ...data,
        startDate: data.startDate ? new Date(data.startDate) : undefined,
        endDate: data.endDate ? new Date(data.endDate) : undefined,
      },
    })

    return reply.send(updated)
  })

  fastify.delete('/employees/:id', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }

    const existing = await prisma.employee.findFirst({
      where: { id, companyId },
    })
    if (!existing) return reply.code(404).send({ error: 'Trabajador no encontrado' })

    await prisma.employee.update({
      where: { id },
      data: { isActive: false, endDate: existing.endDate ?? new Date() },
    })

    return reply.code(204).send()
  })
}
