import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import { GeneratePayrollSchema } from '@contachile/validators'
import { generatePayrollForMonth } from '../lib/payroll-service'
import { createPayrollEntry } from '../lib/accounting-entries'
import { generatePayrollPdf } from '../lib/payroll-pdf'
import { generatePreviRedFile, generateDdjj1887File } from '../lib/payroll-exports'

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

  fastify.get('/payroll/item/:id/pdf', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }

    const payroll = await prisma.payroll.findFirst({
      where: { id, companyId },
      include: { employee: true },
    })
    if (!payroll) return reply.code(404).send({ error: 'Liquidación no encontrada' })

    const company = await prisma.company.findUnique({ where: { id: companyId } })
    if (!company) return reply.code(400).send({ error: 'Empresa no configurada' })

    const pdf = await generatePayrollPdf({
      payroll,
      employee: payroll.employee,
      company,
    })

    return reply
      .header('Content-Type', 'application/pdf')
      .header(
        'Content-Disposition',
        `inline; filename="liquidacion-${payroll.year}-${String(payroll.month).padStart(2, '0')}-${payroll.employee.rut}.pdf"`
      )
      .send(pdf)
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

  fastify.get('/payroll/previred/:year/:month', async (request, reply) => {
    const companyId = request.companyId
    const { year, month } = request.params as { year: string; month: string }
    const yearNum = parseInt(year, 10)
    const monthNum = parseInt(month, 10)

    if (isNaN(yearNum) || isNaN(monthNum) || monthNum < 1 || monthNum > 12) {
      return reply.code(400).send({ error: 'Año/mes inválido' })
    }

    const company = await prisma.company.findUnique({
      where: { id: companyId },
      select: { rut: true },
    })
    if (!company) return reply.code(400).send({ error: 'Empresa no configurada' })

    const payrolls = await prisma.payroll.findMany({
      where: { companyId, year: yearNum, month: monthNum },
      include: { employee: true },
    })

    const content = generatePreviRedFile(
      company.rut,
      yearNum,
      monthNum,
      payrolls.map((p) => ({
        payroll: { bruto: p.bruto, afp: p.afp, salud: p.salud, cesantia: p.cesantia },
        employee: {
          rut: p.employee.rut,
          name: p.employee.name,
          afp: p.employee.afp,
          healthPlan: p.employee.healthPlan,
        },
      }))
    )

    const filename = `previred_${yearNum}${String(monthNum).padStart(2, '0')}_${company.rut.replace(/\./g, '').replace(/-/g, '')}.txt`
    return reply
      .header('Content-Type', 'text/plain; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(content)
  })

  fastify.get('/payroll/ddjj-1887/:year', async (request, reply) => {
    const companyId = request.companyId
    const { year } = request.params as { year: string }
    const yearNum = parseInt(year, 10)

    if (isNaN(yearNum)) return reply.code(400).send({ error: 'Año inválido' })

    const payrolls = await prisma.payroll.findMany({
      where: { companyId, year: yearNum, status: { in: ['APPROVED', 'PAID'] } },
      include: { employee: true },
    })

    const byEmployee = new Map<
      string,
      { rut: string; name: string; totalAnual: number; retenciones: number }
    >()
    for (const p of payrolls) {
      const key = p.employee.id
      const cur = byEmployee.get(key) ?? {
        rut: p.employee.rut,
        name: p.employee.name,
        totalAnual: 0,
        retenciones: 0,
      }
      cur.totalAnual += p.bruto
      cur.retenciones += p.impuesto
      byEmployee.set(key, cur)
    }

    const content = generateDdjj1887File(yearNum, Array.from(byEmployee.values()))
    const filename = `ddjj_1887_${yearNum}.txt`
    return reply
      .header('Content-Type', 'text/plain; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(content)
  })
}
