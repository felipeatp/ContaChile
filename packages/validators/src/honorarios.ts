import { z } from 'zod'

export const RETENCION_HONORARIOS_RATE = 0.1375

export interface RetencionHonorarios {
  gross: number
  retention: number
  net: number
  rate: number
}

export function calcularRetencionHonorarios(
  gross: number,
  rate: number = RETENCION_HONORARIOS_RATE
): RetencionHonorarios {
  const retention = Math.round(gross * rate)
  const net = gross - retention
  return { gross, retention, net, rate }
}

const HonorarioTypeEnum = z.enum(['ISSUED', 'RECEIVED'])
const HonorarioStatusEnum = z.enum(['PENDING', 'PAID'])

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

export const CreateHonorarioSchema = z.object({
  type: HonorarioTypeEnum,
  number: z.number().int().min(1),
  date: z.string().regex(dateRegex),
  counterpartRut: z.string().min(8).max(15),
  counterpartName: z.string().min(1).max(150),
  description: z.string().max(300).optional(),
  grossAmount: z.number().int().min(1),
  retentionRate: z.number().min(0).max(0.5).optional(),
})

export const UpdateHonorarioSchema = z.object({
  status: HonorarioStatusEnum.optional(),
  paidAt: z.string().regex(dateRegex).optional(),
  description: z.string().max(300).optional(),
})

export const HonorarioListQuerySchema = z.object({
  type: HonorarioTypeEnum.optional(),
  year: z.string().optional(),
  month: z.string().optional(),
})

export type CreateHonorarioInput = z.infer<typeof CreateHonorarioSchema>
export type UpdateHonorarioInput = z.infer<typeof UpdateHonorarioSchema>
export type HonorarioListQuery = z.infer<typeof HonorarioListQuerySchema>
