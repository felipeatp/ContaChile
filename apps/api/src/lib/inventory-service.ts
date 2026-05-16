import { prisma } from '@contachile/db'

type Logger = { warn: (data: object, msg: string) => void }

interface RecordMovementInput {
  companyId: string
  productId: string
  type: 'IN' | 'OUT'
  quantity: number
  unitCost?: number
  reason?: string
  reference?: string | null
  documentItemId?: string | null
  notes?: string | null
}

/**
 * Registra un movimiento de inventario.
 *
 * IN: recalcula costo promedio ponderado.
 * OUT: usa product.costPrice como snapshot del movimiento, no actualiza costPrice.
 *
 * No falla si stock queda negativo; sólo logea warn.
 */
export async function recordInventoryMovement(input: RecordMovementInput, logger?: Logger) {
  const product = await prisma.product.findFirst({
    where: { id: input.productId, companyId: input.companyId },
  })
  if (!product) {
    throw new Error(`Producto ${input.productId} no encontrado`)
  }

  let newStock = product.stock
  let newCostPrice = product.costPrice
  let movementUnitCost = input.unitCost ?? 0

  if (input.type === 'IN') {
    const incomingCost = input.unitCost ?? product.costPrice
    movementUnitCost = incomingCost
    const totalStock = product.stock + input.quantity
    if (totalStock > 0) {
      const currentValue = product.stock * product.costPrice
      const incomingValue = input.quantity * incomingCost
      newCostPrice = Math.round((currentValue + incomingValue) / totalStock)
    }
    newStock = totalStock
  } else {
    // OUT
    movementUnitCost = input.unitCost ?? product.costPrice
    newStock = product.stock - input.quantity
    if (newStock < 0) {
      logger?.warn(
        { productId: product.id, code: product.code, oldStock: product.stock, requested: input.quantity },
        'Movimiento OUT deja stock negativo'
      )
    }
  }

  await prisma.product.update({
    where: { id: product.id },
    data: { stock: newStock, costPrice: newCostPrice },
  })

  const movement = await prisma.inventoryMovement.create({
    data: {
      companyId: input.companyId,
      productId: input.productId,
      type: input.type,
      quantity: input.quantity,
      unitCost: movementUnitCost,
      reason: input.reason ?? 'manual',
      reference: input.reference,
      documentItemId: input.documentItemId,
      notes: input.notes,
    },
  })

  return { movement, product: { ...product, stock: newStock, costPrice: newCostPrice } }
}

export interface SalesItemInput {
  documentItemId: string
  productId: string | null
  quantity: number
}

/**
 * Para cada item con productId, registra OUT con folio del documento como referencia.
 * No bloquea si un producto no existe (log warn y skip).
 */
export async function recordSalesMovements(
  companyId: string,
  documentRef: string,
  items: SalesItemInput[],
  logger?: Logger
) {
  let created = 0
  let skipped = 0
  for (const item of items) {
    if (!item.productId) {
      skipped++
      continue
    }
    try {
      await recordInventoryMovement(
        {
          companyId,
          productId: item.productId,
          type: 'OUT',
          quantity: item.quantity,
          reason: 'dte',
          reference: documentRef,
          documentItemId: item.documentItemId,
        },
        logger
      )
      created++
    } catch (err) {
      logger?.warn(
        { err: err instanceof Error ? err.message : String(err), productId: item.productId },
        'recordSalesMovements: producto no encontrado, OUT skippeado'
      )
      skipped++
    }
  }
  return { created, skipped }
}
