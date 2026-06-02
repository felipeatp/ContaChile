import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import tenantPlugin from '../../src/plugins/tenant'
import f22Route from '../../src/routes/f22'

vi.mock('@contachile/db', () => ({
  prisma: {
    document: { aggregate: vi.fn(), findMany: vi.fn() },
    purchase: { aggregate: vi.fn() },
  },
}))

vi.mock('@contachile/auth', () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue(null) } },
  decryptCertPassword: vi.fn(),
}))

import { prisma } from '@contachile/db'

const mockAggregate = prisma.document.aggregate as ReturnType<typeof vi.fn>
const mockFindMany = prisma.document.findMany as ReturnType<typeof vi.fn>
const mockPurchaseAgg = prisma.purchase.aggregate as ReturnType<typeof vi.fn>

const HEADERS = { 'x-company-id': 'company-ppm-test' }

function buildApp() {
  const app = Fastify()
  app.register(tenantPlugin)
  app.register(f22Route)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.DEV_BYPASS_AUTH
  delete process.env.NODE_ENV
  mockAggregate.mockResolvedValue({ _sum: { totalAmount: 0 } })
  mockPurchaseAgg.mockResolvedValue({ _sum: { totalAmount: 0 } })
  mockFindMany.mockResolvedValue([])
})

describe('GET /f22 — N+1 eliminado', () => {
  it('llama a document.findMany exactamente 1 vez (PPM) + aggregates', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f22?year=2025', headers: HEADERS })

    expect(res.statusCode).toBe(200)
    // Solo 1 findMany: los docs del año para calcular PPM mensual
    expect(mockFindMany).toHaveBeenCalledTimes(1)
    const call = mockFindMany.mock.calls[0][0]
    // Verifica que trae todo el año, no un mes
    expect(call.where.emittedAt.gte).toEqual(new Date(2025, 0, 1))
    expect(call.where.emittedAt.lt).toEqual(new Date(2026, 0, 1))
  })

  it('calcula ppmTotal correctamente con datos agrupados', async () => {
    // Enero: 2M → PPM = 10000; Julio: 1M → PPM = 5000
    mockFindMany.mockResolvedValue([
      { emittedAt: new Date(2025, 0, 15), totalAmount: 2_000_000 },
      { emittedAt: new Date(2025, 6, 20), totalAmount: 1_000_000 },
    ])
    mockAggregate.mockResolvedValue({ _sum: { totalAmount: 3_000_000 } })
    mockPurchaseAgg.mockResolvedValue({ _sum: { totalAmount: 0 } })

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f22?year=2025', headers: HEADERS })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    // 2M * 0.005 = 10000 + 1M * 0.005 = 5000 → 15000
    expect(body.summary.ppmPagado).toBe(15_000)
  })

  it('year inválido → 400', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f22?year=banana', headers: HEADERS })
    expect(res.statusCode).toBe(400)
  })
})
