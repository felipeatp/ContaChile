import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import tenantPlugin from '../../src/plugins/tenant'
import inventoryRoute from '../../src/routes/inventory'

vi.mock('@contachile/db', () => ({
  prisma: {
    product: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    inventoryMovement: { findMany: vi.fn(), count: vi.fn() },
  },
}))

vi.mock('@contachile/auth', () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue(null) } },
  decryptCertPassword: vi.fn(),
}))

vi.mock('../../src/lib/inventory-service', () => ({
  recordInventoryMovement: vi.fn(),
}))

import { prisma } from '@contachile/db'

const mockProductFindMany = prisma.product.findMany as ReturnType<typeof vi.fn>
const mockProductCount = prisma.product.count as ReturnType<typeof vi.fn>
const mockProductFindFirst = prisma.product.findFirst as ReturnType<typeof vi.fn>
const mockMovFindMany = prisma.inventoryMovement.findMany as ReturnType<typeof vi.fn>
const mockMovCount = prisma.inventoryMovement.count as ReturnType<typeof vi.fn>

const HEADERS = { 'x-company-id': 'company-inv-test' }

function buildApp() {
  const app = Fastify()
  app.register(tenantPlugin)
  app.register(inventoryRoute)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.DEV_BYPASS_AUTH
  delete process.env.NODE_ENV
  mockProductFindMany.mockResolvedValue([])
  mockProductCount.mockResolvedValue(0)
  mockMovFindMany.mockResolvedValue([])
  mockMovCount.mockResolvedValue(0)
})

describe('GET /inventory/products — paginación', () => {
  it('retorna total y productos, default 50 por página', async () => {
    const products = Array.from({ length: 3 }, (_, i) => ({ id: `p-${i}`, name: `Prod ${i}` }))
    mockProductFindMany.mockResolvedValue(products)
    mockProductCount.mockResolvedValue(3)

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/inventory/products', headers: HEADERS })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.products).toHaveLength(3)
    expect(body.total).toBe(3)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(50)
  })

  it('respeta page=2&limit=10 y pasa skip=10 a Prisma', async () => {
    mockProductFindMany.mockResolvedValue([])
    mockProductCount.mockResolvedValue(100)

    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/inventory/products?page=2&limit=10',
      headers: HEADERS,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.page).toBe(2)
    expect(body.limit).toBe(10)
    expect(body.total).toBe(100)
    const call = mockProductFindMany.mock.calls[0][0]
    expect(call.skip).toBe(10)
    expect(call.take).toBe(10)
  })

  it('limit=999 → 400', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/inventory/products?limit=999',
      headers: HEADERS,
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /inventory/movements/:productId — paginación', () => {
  it('retorna total y movimientos paginados', async () => {
    mockProductFindFirst.mockResolvedValue({ id: 'prod-1', name: 'Arroz', stock: 10 })
    const movements = [
      { id: 'm1', type: 'IN', quantity: 5, unitCost: 1000, createdAt: new Date('2025-01-01') },
    ]
    mockMovFindMany.mockResolvedValue(movements)
    mockMovCount.mockResolvedValue(1)

    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/inventory/movements/prod-1',
      headers: HEADERS,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total).toBe(1)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(50)
    expect(body.movements).toHaveLength(1)
  })
})
