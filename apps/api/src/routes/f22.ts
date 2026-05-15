import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import { calcularImpuestoRenta } from '@contachile/validators'

interface F22Line {
  code: string
  label: string
  value: number
  auto: boolean
}

interface F22Response {
  year: number
  lines: F22Line[]
  summary: {
    ingresos: number
    costos: number
    gastos: number
    rentaLiquida: number
    ppmPagado: number
    impuesto: number
    saldoPagar: number
    saldoDevolver: number
  }
}

function getYearRange(year: number): { start: Date; end: Date } {
  return {
    start: new Date(year, 0, 1),
    end: new Date(year + 1, 0, 1),
  }
}

export default async function (fastify: FastifyInstance) {
  fastify.get('/f22', async (request, reply) => {
    const companyId = request.companyId
    const yearStr = (request.query as Record<string, string>).year
    const year = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear()

    if (isNaN(year) || year < 2020 || year > new Date().getFullYear() + 1) {
      return reply.code(400).send({ error: 'Ano invalido' })
    }

    const { start, end } = getYearRange(year)

    const ingresos = await prisma.document.aggregate({
      where: {
        companyId,
        type: 33,
        emittedAt: { gte: start, lt: end },
      },
      _sum: { totalAmount: true },
    })

    const costos = await prisma.purchase.aggregate({
      where: {
        companyId,
        type: 33,
        date: { gte: start, lt: end },
      },
      _sum: { totalAmount: true },
    })

    const gastos = await prisma.purchase.aggregate({
      where: {
        companyId,
        type: { not: 33 },
        date: { gte: start, lt: end },
      },
      _sum: { totalAmount: true },
    })

    const totalIngresos = ingresos._sum.totalAmount || 0
    const totalCostos = costos._sum.totalAmount || 0
    const totalGastos = gastos._sum.totalAmount || 0
    const rentaLiquida = Math.max(0, totalIngresos - totalCostos - totalGastos)

    const ppmTotal = 0 // Simplified: PPM calculation would require F29 history

    const impuesto = calcularImpuestoRenta(rentaLiquida)
    const saldo = impuesto - ppmTotal
    const saldoPagar = saldo > 0 ? saldo : 0
    const saldoDevolver = saldo < 0 ? Math.abs(saldo) : 0

    const response: F22Response = {
      year,
      lines: [
        { code: '525', label: 'Ingresos brutos', value: totalIngresos, auto: true },
        { code: '526', label: 'Costos', value: totalCostos, auto: true },
        { code: '527', label: 'Gastos operacionales', value: totalGastos, auto: true },
        { code: '528', label: 'Renta liquida', value: rentaLiquida, auto: true },
        { code: '585', label: 'PPM pagado en el ano', value: ppmTotal, auto: true },
        { code: '594', label: 'Impuesto determinado', value: impuesto, auto: true },
        { code: '595', label: 'Saldo a pagar', value: saldoPagar, auto: true },
        { code: '596', label: 'Saldo a devolver', value: saldoDevolver, auto: true },
      ],
      summary: {
        ingresos: totalIngresos,
        costos: totalCostos,
        gastos: totalGastos,
        rentaLiquida,
        ppmPagado: ppmTotal,
        impuesto,
        saldoPagar,
        saldoDevolver,
      },
    }

    return reply.send(response)
  })
}
