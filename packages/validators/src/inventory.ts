import { z } from 'zod'

export const CreateProductSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
  description: z.string().max(500).optional(),
  unit: z.string().max(20).default('unidad'),
  salePrice: z.number().int().min(0),
  costPrice: z.number().int().min(0).default(0),
  initialStock: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(0),
  affectedIVA: z.boolean().default(true),
})

export const UpdateProductSchema = z.object({
  code: z.string().min(1).max(50).optional(),
  name: z.string().min(1).max(150).optional(),
  description: z.string().max(500).optional(),
  unit: z.string().max(20).optional(),
  salePrice: z.number().int().min(0).optional(),
  minStock: z.number().int().min(0).optional(),
  affectedIVA: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export const InventoryMovementSchema = z.object({
  productId: z.string().cuid(),
  type: z.enum(['IN', 'OUT']),
  quantity: z.number().int().min(1),
  unitCost: z.number().int().min(0).optional(),
  reason: z.string().max(50).default('manual'),
  reference: z.string().max(100).optional(),
  notes: z.string().max(300).optional(),
})

export type CreateProductInput = z.infer<typeof CreateProductSchema>
export type UpdateProductInput = z.infer<typeof UpdateProductSchema>
export type InventoryMovementInput = z.infer<typeof InventoryMovementSchema>

const pageSchema = z.string().regex(/^\d+$/).default('1').transform(Number).pipe(z.number().min(1))
const limitSchema = z.string().regex(/^\d+$/).default('50').transform(Number).pipe(z.number().max(100))

export const InventoryProductListSchema = z.object({
  active: z.enum(['true', 'false']).optional(),
  search: z.string().max(100).optional(),
  page: pageSchema,
  limit: limitSchema,
})

export const InventoryMovementListSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: pageSchema,
  limit: limitSchema,
})

export type InventoryProductListQuery = z.infer<typeof InventoryProductListSchema>
export type InventoryMovementListQuery = z.infer<typeof InventoryMovementListSchema>
