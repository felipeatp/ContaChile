import { prisma } from '@contachile/db'
import { calcularLiquidacion } from '@contachile/validators'

interface GenerateResult {
  generated: number
  skipped: number
  errors: Array<{ employeeId: string; reason: string }>
}

export async function generatePayrollForMonth(
  companyId: string,
  year: number,
  month: number,
  utmValue?: number
): Promise<GenerateResult> {
  const employees = await prisma.employee.findMany({
    where: {
      companyId,
      isActive: true,
      contractType: { not: 'HONORARIOS' },
    },
  })

  let generated = 0
  let skipped = 0
  const errors: Array<{ employeeId: string; reason: string }> = []

  for (const employee of employees) {
    try {
      const existing = await prisma.payroll.findUnique({
        where: {
          companyId_employeeId_year_month: {
            companyId,
            employeeId: employee.id,
            year,
            month,
          },
        },
      })
      if (existing) {
        skipped++
        continue
      }

      const liq = calcularLiquidacion({
        baseSalary: employee.baseSalary,
        afp: employee.afp,
        healthPlan: employee.healthPlan,
        healthAmount: employee.healthAmount ?? undefined,
        contractType: employee.contractType,
        utmValue,
      })

      await prisma.payroll.create({
        data: {
          companyId,
          employeeId: employee.id,
          year,
          month,
          bruto: liq.bruto,
          horasExtras: liq.horasExtras,
          bonos: liq.bonos,
          afp: liq.afp,
          salud: liq.salud,
          cesantia: liq.cesantia,
          baseImponible: liq.baseImponible,
          impuesto: liq.impuesto,
          otrosDesc: liq.otrosDesc,
          liquido: liq.liquido,
        },
      })
      generated++
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : 'unknown'
      errors.push({ employeeId: employee.id, reason })
    }
  }

  return { generated, skipped, errors }
}
