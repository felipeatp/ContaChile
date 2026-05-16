import { z } from 'zod'

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

export const QuoteItemSchema = z.object({
  description: z.string().min(1).max(200),
  quantity: z.number().int().min(1),
  unitPrice: z.number().int().min(0),
})

export const CreateQuoteSchema = z.object({
  number: z.number().int().min(1),
  date: z.string().regex(dateRegex).optional(),
  validUntil: z.string().regex(dateRegex).optional(),
  receiverRut: z.string().min(8).max(15),
  receiverName: z.string().min(1).max(150),
  receiverEmail: z.string().email().optional(),
  receiverAddress: z.string().max(200).optional(),
  paymentMethod: z.string().max(50).default('CONTADO'),
  notes: z.string().max(500).optional(),
  items: z.array(QuoteItemSchema).min(1),
})

export const UpdateQuoteSchema = CreateQuoteSchema.partial()

export const QuoteListQuerySchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'INVOICED', 'EXPIRED']).optional(),
  from: z.string().regex(dateRegex).optional(),
  to: z.string().regex(dateRegex).optional(),
})

export type CreateQuoteInput = z.infer<typeof CreateQuoteSchema>
export type UpdateQuoteInput = z.infer<typeof UpdateQuoteSchema>
export type QuoteListQuery = z.infer<typeof QuoteListQuerySchema>
