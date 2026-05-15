import { z } from 'zod'
import { validateRUT } from './rut'

export const PurchaseSchema = z.object({
  type: z.number().int().min(33).max(61),
  folio: z.number().int().positive(),
  issuerRut: z.string().refine((val) => validateRUT(val), {
    message: 'RUT del emisor inválido',
  }),
  issuerName: z.string().min(1).max(100),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'Fecha debe estar en formato YYYY-MM-DD',
  }),
  netAmount: z.number().int().positive(),
  taxAmount: z.number().int().min(0),
  totalAmount: z.number().int().positive(),
  category: z.string().min(1).max(100).optional(),
})

export const PurchaseListQuerySchema = z.object({
  year: z.string().regex(/^\d{4}$/).optional(),
  month: z.string().regex(/^(0?[1-9]|1[0-2])$/).optional(),
  page: z.string().regex(/^\d+$/).optional().default('1'),
  limit: z.string().regex(/^\d+$/).optional().default('20'),
})

export type PurchaseInput = z.infer<typeof PurchaseSchema>
export type PurchaseListQuery = z.infer<typeof PurchaseListQuerySchema>
