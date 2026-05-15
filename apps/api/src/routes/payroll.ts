import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import { GeneratePayrollSchema } from '@contachile/validators'
import { generatePayrollForMonth } from '../lib/payroll-service'
import { createPayrollEntry } from '../lib/accounting-entries'

export default async function (fastify: FastifyInstance) {
  fastify.post('/payroll/generate', async (request, reply) => {
    const companyId = request.companyId
    const parsed = GeneratePayrollSchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', issues: parsed.error.issues })
    }
    const { year, month } = parsed.data

    const today = new Date()
    if (year > today.getFullYear() || (year === today.getFullYear() && month > today.getMonth() + 1)) {
      return reply.code(400).send({ error: 'No se puede generar payroll para un mes futuro' })
    }

    const result = await generatePayrollForMonth(companyId, year, month)
    return reply.code(201).send(result)
  })

  fastify.get('/payroll/:year/:month', async (request, reply) => {
    const companyId = request.companyId
    const { year, month } = request.params as { year: string; month: string }

    const yearNum = parseInt(year, 10)
    const monthNum = parseInt(month, 10)

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return reply.code(400).send({ error: 'Año/mes inválido' })
    }

    const payrolls = await prisma.payroll.findMany({
      where: { companyId, year: yearNum, month: monthNum },
      include: {
        employee: { select: { rut: true, name: true, position: true, afp: true } },
      },
      orderBy: { employee: { name: 'asc' } },
    })

    const totals = payrolls.reduce(
      (acc, p) => ({
        bruto: acc.bruto + p.bruto,
        afp: acc.afp + p.afp,
        salud: acc.salud + p.salud,
        cesantia: acc.cesantia + p.cesantia,
        impuesto: acc.impuesto + p.impuesto,
        liquido: acc.liquido + p.liquido,
      }),
      { bruto: 0, afp: 0, salud: 0, cesantia: 0, impuesto: 0, liquido: 0 }
    )

    return reply.send({ payrolls, totals })
  })

  fastify.get('/payroll/item/:id', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }

    const payroll = await prisma.payroll.findFirst({
      where: { id, companyId },
      include: { employee: true },
    })
    if (!payroll) return reply.code(404).send({ error: 'Liquidación no encontrada' })
    return reply.send(payroll)
  })

  fastify.post('/payroll/item/:id/approve', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }

    const payroll = await prisma.payroll.findFirst({
      where: { id, companyId },
    })
    if (!payroll) return reply.code(404).send({ error: 'Liquidación no encontrada' })

    if (payroll.status !== 'DRAFT') {
      return reply.code(400).send({ error: `Solo se pueden aprobar liquidaciones en estado DRAFT (actual: ${payroll.status})` })
    }

    const updated = await prisma.payroll.update({
      where: { id },
      data: { status: 'APPROVED', approvedAt: new Date() },
    })

    await createPayrollEntry(updated, fastify.log).catch((err: Error) => {
      fastify.log.warn(
        { err: err.message, payrollId: id },
        'createPayrollEntry falló — liquidación aprobada sin asiento'
      )
    })

    return reply.send(updated)
  })
}
