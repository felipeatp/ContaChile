import { z } from 'zod'

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

export const TrialBalanceQuerySchema = z.object({
  asOf: z.string().regex(dateRegex).optional(),
})

export const IncomeStatementQuerySchema = z
  .object({
    from: z.string().regex(dateRegex),
    to: z.string().regex(dateRegex),
  })
  .refine((d) => d.from <= d.to, { message: 'from debe ser <= to' })

export const BalanceSheetQuerySchema = z.object({
  asOf: z.string().regex(dateRegex).optional(),
})

export type TrialBalanceQuery = z.infer<typeof TrialBalanceQuerySchema>
export type IncomeStatementQuery = z.infer<typeof IncomeStatementQuerySchema>
export type BalanceSheetQuery = z.infer<typeof BalanceSheetQuerySchema>
