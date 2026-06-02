import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import tenantPlugin from '../src/plugins/tenant'
import f22Route from '../src/routes/f22'

vi.mock('@contachile/db', () => ({
  prisma: {
    document: {
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
    purchase: {
      aggregate: vi.fn(),
    },
  },
}))

vi.mock('@contachile/auth', () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue(null) } },
  decryptCertPassword: vi.fn(),
}))

import { prisma } from '@contachile/db'

const mockDocumentAggregate = prisma.document.aggregate as ReturnType<typeof vi.fn>
const mockDocumentFindMany = prisma.document.findMany as ReturnType<typeof vi.fn>
const mockPurchaseAggregate = prisma.purchase.aggregate as ReturnType<typeof vi.fn>

// Use x-company-id header path: no session, no DEV_BYPASS_AUTH, NODE_ENV != production
const COMPANY_ID = 'company-f22-test'
const headers = {
  'x-company-id': COMPANY_ID,
}

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
  mockDocumentFindMany.mockResolvedValue([])
})

describe('GET /f22 — cálculos tributarios anuales', () => {
  it('renta neta = 0 → impuesto = 0, sin saldo a pagar ni devolver', async () => {
    mockDocumentAggregate.mockResolvedValue({ _sum: { totalAmount: 0 } })
    mockPurchaseAggregate.mockResolvedValue({ _sum: { totalAmount: 0 } })

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f22?year=2026', headers })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.summary.rentaLiquida).toBe(0)
    expect(body.summary.impuesto).toBe(0)
    expect(body.summary.saldoPagar).toBe(0)
    expect(body.summary.saldoDevolver).toBe(0)
  })

  it('ingresos < costos+gastos → renta neta = 0 (no negativa)', async () => {
    mockDocumentAggregate.mockResolvedValue({ _sum: { totalAmount: 1_000_000 } })
    mockPurchaseAggregate
      .mockResolvedValueOnce({ _sum: { totalAmount: 1_500_000 } })
      .mockResolvedValueOnce({ _sum: { totalAmount: 500_000 } })

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f22?year=2026', headers })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.summary.rentaLiquida).toBe(0)
    expect(body.summary.impuesto).toBe(0)
  })

  it('renta moderada (20M) → calcula impuesto progresivo', async () => {
    mockDocumentAggregate.mockResolvedValue({ _sum: { totalAmount: 20_000_000 } })
    mockPurchaseAggregate.mockResolvedValue({ _sum: { totalAmount: 0 } })

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f22?year=2026', headers })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.summary.rentaLiquida).toBe(20_000_000)
    expect(body.summary.impuesto).toBeGreaterThan(0)
  })

  it('PPM acumulado > impuesto → saldoDevolver > 0, saldoPagar = 0', async () => {
    // rentaLiquida = 5M → 5M < 15 UTA (10.8M) → impuesto = 0
    // PPM = 12 meses × floor(1_000_000 * 0.005) = 12 × 5_000 = 60_000
    mockDocumentAggregate.mockResolvedValue({ _sum: { totalAmount: 5_000_000 } })
    mockPurchaseAggregate.mockResolvedValue({ _sum: { totalAmount: 0 } })
    mockDocumentFindMany.mockResolvedValue([{ totalAmount: 1_000_000 }])

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f22?year=2026', headers })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.summary.ppmPagado).toBe(60_000)
    expect(body.summary.saldoPagar).toBe(0)
    expect(body.summary.saldoDevolver).toBe(60_000)
  })

  it('PPM = 0 y renta alta → saldoPagar > 0, saldoDevolver = 0', async () => {
    mockDocumentAggregate.mockResolvedValue({ _sum: { totalAmount: 20_000_000 } })
    mockPurchaseAggregate.mockResolvedValue({ _sum: { totalAmount: 0 } })
    mockDocumentFindMany.mockResolvedValue([])

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f22?year=2026', headers })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.summary.ppmPagado).toBe(0)
    expect(body.summary.saldoPagar).toBeGreaterThan(0)
    expect(body.summary.saldoDevolver).toBe(0)
  })

  it('año inválido retorna 400', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f22?year=1999', headers })
    expect(res.statusCode).toBe(400)
  })

  it('retorna las líneas de F22 con códigos esperados', async () => {
    mockDocumentAggregate.mockResolvedValue({ _sum: { totalAmount: 0 } })
    mockPurchaseAggregate.mockResolvedValue({ _sum: { totalAmount: 0 } })

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f22?year=2026', headers })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    const codes = body.lines.map((l: { code: string }) => l.code)
    expect(codes).toContain('525')
    expect(codes).toContain('528')
    expect(codes).toContain('585')
    expect(codes).toContain('594')
  })
})
