import { z } from 'zod'

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(s: string): boolean {
  if (!dateRegex.test(s)) return false
  const d = new Date(s)
  return !isNaN(d.getTime())
}

export const BankMovementListSchema = z.object({
  status: z.string().optional(),
  bankAccountId: z.string().optional(),
  from: z.string().refine(isValidDate, { message: 'Fecha from inválida (YYYY-MM-DD)' }).optional(),
  to: z.string().refine(isValidDate, { message: 'Fecha to inválida (YYYY-MM-DD)' }).optional(),
})

export type BankMovementListQuery = z.infer<typeof BankMovementListSchema>
