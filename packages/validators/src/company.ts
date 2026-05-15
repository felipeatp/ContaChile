import { z } from 'zod'
import { validateRUT } from './rut'

export const CompanySchema = z.object({
  rut: z.string().refine((val) => validateRUT(val), {
    message: 'RUT inválido',
  }),
  name: z.string().min(1).max(100),
  giro: z.string().min(1).max(200).optional(),
  address: z.string().min(1).max(200).optional(),
  commune: z.string().min(1).max(100).optional(),
  city: z.string().min(1).max(100).optional(),
  economicActivity: z.string().min(1).max(20).optional(),
  phone: z.string().min(1).max(50).optional(),
  email: z.string().email().optional(),
  defaultPaymentMethod: z.enum(['CONTADO', 'CREDITO']).default('CONTADO'),
  defaultDocumentType: z.number().int().min(33).max(61).default(33),
})

export const UpdateCompanySchema = CompanySchema.partial()

export type CompanyInput = z.infer<typeof CompanySchema>
export type UpdateCompanyInput = z.infer<typeof UpdateCompanySchema>
