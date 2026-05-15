import { z } from 'zod'

export const JournalLineSchema = z
  .object({
    accountId: z.string().cuid(),
    debit: z.number().int().min(0).default(0),
    credit: z.number().int().min(0).default(0),
    description: z.string().max(200).optional(),
  })
  .refine(
    (line) => (line.debit > 0) !== (line.credit > 0),
    { message: 'Cada línea debe tener débito o crédito (uno y solo uno)' }
  )

export const CreateJournalEntrySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    description: z.string().min(1).max(300),
    reference: z.string().max(100).optional(),
    lines: z.array(JournalLineSchema).min(2),
  })
  .refine(
    (entry) => {
      const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0)
      const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0)
      return totalDebit === totalCredit && totalDebit > 0
    },
    { message: 'El asiento no cuadra: la suma del debe debe ser igual a la del haber y mayor que cero' }
  )

export const JournalListQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  source: z.enum(['manual', 'dte', 'purchase']).optional(),
  page: z.string().default('1'),
  limit: z.string().default('20'),
})

export const LedgerQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export type CreateJournalEntryInput = z.infer<typeof CreateJournalEntrySchema>
export type JournalListQuery = z.infer<typeof JournalListQuerySchema>
export type LedgerQuery = z.infer<typeof LedgerQuerySchema>
