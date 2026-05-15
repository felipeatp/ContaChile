import { z } from 'zod'
import { validateRUT } from './rut'

export const DocumentItemSchema = z.object({
  description: z.string().min(1).max(1000),
  quantity: z.number().int().positive(),
  unitPrice: z.number().int().positive(),
})

export const ReceiverSchema = z.object({
  rut: z.string().refine((val) => validateRUT(val), {
    message: 'RUT inválido',
  }),
  name: z.string().min(1).max(100),
  address: z.string().min(1).max(200),
  commune: z.string().min(1).max(100),
  city: z.string().min(1).max(100),
  email: z.string().email().optional(),
})

export const EmitDocumentSchema = z.object({
  type: z.number().int().min(33).max(61),
  receiver: ReceiverSchema,
  items: z.array(DocumentItemSchema).min(1).max(100),
  paymentMethod: z.enum(['CONTADO', 'CREDITO']).default('CONTADO'),
})

export type EmitDocumentInput = z.infer<typeof EmitDocumentSchema>
export type DocumentItem = z.infer<typeof DocumentItemSchema>
export type Receiver = z.infer<typeof ReceiverSchema>
