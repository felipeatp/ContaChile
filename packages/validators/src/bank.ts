import { z } from 'zod'

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(s: string): boolean {
  if (!dateRegex.test(s)) return false
  const [y, m, d] = s.split('-').map(Number)
  const dt = new Date(s)
  return !isNaN(dt.getTime()) && dt.getUTCFullYear() === y && dt.getUTCMonth() + 1 === m && dt.getUTCDate() === d
}

export const BankMovementListSchema = z.object({
  status: z.string().optional(),
  bankAccountId: z.string().optional(),
  from: z.string().refine(isValidDate, { message: 'Fecha from inválida (YYYY-MM-DD)' }).optional(),
  to: z.string().refine(isValidDate, { message: 'Fecha to inválida (YYYY-MM-DD)' }).optional(),
})

export type BankMovementListQuery = z.infer<typeof BankMovementListSchema>
