import { z } from 'zod'
import {
  AFP_RATES,
  SALUD_FONASA_RATE,
  SEGURO_CESANTIA_EMPLEADO,
  TAX_BRACKETS,
  UTM_DEFAULT,
  type AfpCode,
  type ContractType,
  type HealthPlan,
} from './payroll-constants'

const AfpCodeEnum = z.enum(['CAPITAL', 'CUPRUM', 'HABITAT', 'MODELO', 'PLANVITAL', 'PROVIDA', 'UNO'])
const HealthPlanEnum = z.enum(['FONASA', 'ISAPRE'])
const ContractTypeEnum = z.enum(['INDEFINIDO', 'PLAZO_FIJO', 'HONORARIOS'])

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

export const CreateEmployeeSchema = z.object({
  rut: z.string().min(8).max(15),
  name: z.string().min(1).max(150),
  email: z.string().email().optional(),
  position: z.string().min(1).max(100),
  startDate: z.string().regex(dateRegex),
  endDate: z.string().regex(dateRegex).optional(),
  contractType: ContractTypeEnum,
  workHours: z.number().int().min(1).max(45).default(45),
  baseSalary: z.number().int().min(0),
  afp: AfpCodeEnum,
  healthPlan: HealthPlanEnum,
  healthAmount: z.number().int().min(0).optional(),
})

export const UpdateEmployeeSchema = CreateEmployeeSchema.partial().extend({
  isActive: z.boolean().optional(),
})

export const GeneratePayrollSchema = z.object({
  year: z.number().int().min(2020).max(2100),
  month: z.number().int().min(1).max(12),
})

export type CreateEmployeeInput = z.infer<typeof CreateEmployeeSchema>
export type UpdateEmployeeInput = z.infer<typeof UpdateEmployeeSchema>
export type GeneratePayrollInput = z.infer<typeof GeneratePayrollSchema>

export interface LiquidacionInput {
  baseSalary: number
  horasExtras?: number
  bonos?: number
  otrosDescuentos?: number
  afp: AfpCode
  healthPlan: HealthPlan
  healthAmount?: number
  contractType: ContractType
  utmValue?: number
}

export interface Liquidacion {
  bruto: number
  horasExtras: number
  bonos: number
  afp: number
  salud: number
  cesantia: number
  baseImponible: number
  impuesto: number
  otrosDesc: number
  liquido: number
}

function calcularImpuestoUnico(baseImponible: number, utm: number): number {
  if (baseImponible <= 0) return 0
  const baseInUtm = baseImponible / utm
  for (const bracket of TAX_BRACKETS) {
    if (baseInUtm <= bracket.upTo) {
      const taxInUtm = baseInUtm * bracket.rate - bracket.deduction
      return Math.max(0, Math.round(taxInUtm * utm))
    }
  }
  return 0
}

export function calcularLiquidacion(input: LiquidacionInput): Liquidacion {
  const utm = input.utmValue ?? UTM_DEFAULT
  const horasExtras = input.horasExtras ?? 0
  const bonos = input.bonos ?? 0
  const bruto = input.baseSalary + horasExtras + bonos

  const afp = Math.round(bruto * AFP_RATES[input.afp])

  const saludMinimo = Math.round(bruto * SALUD_FONASA_RATE)
  const salud =
    input.healthPlan === 'FONASA'
      ? saludMinimo
      : Math.max(saludMinimo, input.healthAmount ?? 0)

  const cesantia =
    input.contractType === 'INDEFINIDO' ? Math.round(bruto * SEGURO_CESANTIA_EMPLEADO) : 0

  const baseImponible = bruto - afp - salud - cesantia
  const impuesto = calcularImpuestoUnico(baseImponible, utm)
  const otrosDesc = input.otrosDescuentos ?? 0

  const liquido = bruto - afp - salud - cesantia - impuesto - otrosDesc

  return {
    bruto,
    horasExtras,
    bonos,
    afp,
    salud,
    cesantia,
    baseImponible,
    impuesto,
    otrosDesc,
    liquido,
  }
}
