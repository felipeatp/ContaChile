import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@contachile/db', () => ({
  prisma: {
    product: { findFirst: vi.fn(), update: vi.fn() },
    inventoryMovement: { create: vi.fn() },
  },
}))

import { prisma } from '@contachile/db'
import {
  recordInventoryMovement,
  recordSalesMovements,
} from '../../src/lib/inventory-service'

const mockProductFind = prisma.product.findFirst as ReturnType<typeof vi.fn>
const mockProductUpdate = prisma.product.update as ReturnType<typeof vi.fn>
const mockMovCreate = prisma.inventoryMovement.create as ReturnType<typeof vi.fn>

const COMPANY = 'company-inv'

function makeProduct(overrides: Partial<{
  id: string
  code: string
  companyId: string
  stock: number
  costPrice: number
}> = {}) {
  return {
    id: 'prod-1',
    code: 'P001',
    companyId: COMPANY,
    stock: 10,
    costPrice: 5_000,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockProductUpdate.mockResolvedValue({})
  mockMovCreate.mockResolvedValue({ id: 'mov-1' })
})

describe('recordInventoryMovement — IN', () => {
  it('incrementa stock y recalcula costo promedio ponderado', async () => {
    // Stock actual: 10 unidades a $5_000 = $50_000
    // Entrada: 5 unidades a $7_000 = $35_000
    // Nuevo costo: ($50_000 + $35_000) / 15 = $5_667 (rounded)
    mockProductFind.mockResolvedValue(makeProduct({ stock: 10, costPrice: 5_000 }))

    const result = await recordInventoryMovement({
      companyId: COMPANY,
      productId: 'prod-1',
      type: 'IN',
      quantity: 5,
      unitCost: 7_000,
    })

    expect(result.product.stock).toBe(15)
    expect(result.product.costPrice).toBe(5_667) // Math.round(85_000 / 15)

    expect(mockProductUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ stock: 15, costPrice: 5_667 }),
      })
    )
  })

  it('IN sobre stock=0 usa unitCost directamente como nuevo costo', async () => {
    mockProductFind.mockResolvedValue(makeProduct({ stock: 0, costPrice: 0 }))

    const result = await recordInventoryMovement({
      companyId: COMPANY,
      productId: 'prod-1',
      type: 'IN',
      quantity: 3,
      unitCost: 4_000,
    })

    expect(result.product.stock).toBe(3)
    expect(result.product.costPrice).toBe(4_000)
  })
})

describe('recordInventoryMovement — OUT', () => {
  it('decrementa stock sin modificar costPrice', async () => {
    mockProductFind.mockResolvedValue(makeProduct({ stock: 10, costPrice: 5_000 }))

    const result = await recordInventoryMovement({
      companyId: COMPANY,
      productId: 'prod-1',
      type: 'OUT',
      quantity: 3,
    })

    expect(result.product.stock).toBe(7)
    expect(result.product.costPrice).toBe(5_000) // sin cambio
  })

  it('OUT que deja stock negativo: registra movimiento igualmente (no lanza error)', async () => {
    // stock=2, OUT 5 → stock=-3. Debe logear warn pero no lanzar.
    mockProductFind.mockResolvedValue(makeProduct({ stock: 2, costPrice: 5_000 }))
    const warnSpy = vi.fn()
    const logger = { warn: warnSpy }

    const result = await recordInventoryMovement(
      {
        companyId: COMPANY,
        productId: 'prod-1',
        type: 'OUT',
        quantity: 5,
      },
      logger
    )

    // No lanza — stock queda negativo
    expect(result.product.stock).toBe(-3)
    expect(warnSpy).toHaveBeenCalledOnce()
    expect(mockMovCreate).toHaveBeenCalledOnce()
  })

  it('lanza error si el producto no existe', async () => {
    mockProductFind.mockResolvedValue(null)

    await expect(
      recordInventoryMovement({ companyId: COMPANY, productId: 'no-existe', type: 'OUT', quantity: 1 })
    ).rejects.toThrow('no encontrado')
  })
})

describe('recordSalesMovements', () => {
  it('registra OUT para cada item con productId', async () => {
    mockProductFind.mockResolvedValue(makeProduct())

    const result = await recordSalesMovements(COMPANY, 'T33-42', [
      { documentItemId: 'item-1', productId: 'prod-1', quantity: 2 },
      { documentItemId: 'item-2', productId: 'prod-1', quantity: 3 },
    ])

    expect(result.created).toBe(2)
    expect(result.skipped).toBe(0)
    expect(mockMovCreate).toHaveBeenCalledTimes(2)
  })

  it('salta items sin productId', async () => {
    const result = await recordSalesMovements(COMPANY, 'T33-43', [
      { documentItemId: 'item-1', productId: null, quantity: 1 },
    ])

    expect(result.skipped).toBe(1)
    expect(result.created).toBe(0)
    expect(mockMovCreate).not.toHaveBeenCalled()
  })

  it('salta item si el producto no existe (no bloquea el resto)', async () => {
    mockProductFind
      .mockResolvedValueOnce(makeProduct()) // prod-1 ok
      .mockResolvedValueOnce(null)          // prod-2 no existe

    const result = await recordSalesMovements(COMPANY, 'T33-44', [
      { documentItemId: 'item-1', productId: 'prod-1', quantity: 1 },
      { documentItemId: 'item-2', productId: 'prod-2', quantity: 1 },
    ])

    expect(result.created).toBe(1)
    expect(result.skipped).toBe(1)
  })
})
