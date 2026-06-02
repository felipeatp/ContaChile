import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import tenantPlugin from '../src/plugins/tenant'
import f29Route from '../src/routes/f29'

vi.mock('@contachile/db', () => ({
  prisma: {
    document: {
      findMany: vi.fn(),
    },
    purchase: {
      findMany: vi.fn(),
    },
  },
}))

vi.mock('@contachile/auth', () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue(null) } },
  decryptCertPassword: vi.fn(),
}))

import { prisma } from '@contachile/db'

const mockDocumentFindMany = prisma.document.findMany as ReturnType<typeof vi.fn>
const mockPurchaseFindMany = prisma.purchase.findMany as ReturnType<typeof vi.fn>

// Use x-company-id header path: no session, no DEV_BYPASS_AUTH, NODE_ENV != production
// This allows controlling the companyId directly in tests
const COMPANY_ID = 'company-f29-test'
const headers = {
  'x-company-id': COMPANY_ID,
}

function buildApp() {
  const app = Fastify()
  app.register(tenantPlugin)
  app.register(f29Route)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.DEV_BYPASS_AUTH
  delete process.env.NODE_ENV
})

describe('GET /f29 — cálculos tributarios', () => {
  it('sin ventas ni compras — todos los valores son 0', async () => {
    mockDocumentFindMany.mockResolvedValue([])
    mockPurchaseFindMany.mockResolvedValue([])

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f29?year=2026&month=3', headers })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.f29['502']).toBe(0)
    expect(body.f29['503']).toBe(0)
    expect(body.f29['595']).toBe(0)
    expect(body.f29['91']).toBe(0)
  })

  it('solo ventas — débito > crédito → IVA determinado positivo', async () => {
    mockDocumentFindMany.mockResolvedValue([
      { type: 33, totalNet: 1_000_000, totalTax: 190_000, totalAmount: 1_190_000 },
      { type: 33, totalNet: 1_000_000, totalTax: 190_000, totalAmount: 1_190_000 },
    ])
    mockPurchaseFindMany.mockResolvedValue([])

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f29?year=2026&month=3', headers })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.f29['502']).toBe(380_000)
    expect(body.f29['503']).toBe(0)
    expect(body.f29['595']).toBe(380_000)
    expect(body.sales.neto).toBe(2_000_000)
    expect(body.sales.count).toBe(2)
  })

  it('compras mayores que ventas — IVA determinado negativo (crédito a favor)', async () => {
    mockDocumentFindMany.mockResolvedValue([
      { type: 33, totalNet: 500_000, totalTax: 95_000, totalAmount: 595_000 },
    ])
    mockPurchaseFindMany.mockResolvedValue([
      { netAmount: 1_000_000, taxAmount: 190_000, totalAmount: 1_190_000 },
    ])

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f29?year=2026&month=3', headers })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.f29['502']).toBe(95_000)
    expect(body.f29['503']).toBe(190_000)
    expect(body.f29['595']).toBe(-95_000)
  })

  it('PPM = 0.4% de la venta neta total', async () => {
    mockDocumentFindMany.mockResolvedValue([
      { type: 33, totalNet: 1_000_000, totalTax: 190_000, totalAmount: 1_190_000 },
    ])
    mockPurchaseFindMany.mockResolvedValue([])

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f29?year=2026&month=3', headers })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    // PPM = Math.round(1_000_000 * 0.004) = 4_000
    expect(body.f29['547']).toBe(4_000)
    expect(body.f29['91']).toBe(190_000 + 4_000)
  })

  it('período inválido retorna 400', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f29?year=2026&month=13', headers })
    expect(res.statusCode).toBe(400)
  })

  it('consulta solo documentos del companyId correcto', async () => {
    mockDocumentFindMany.mockResolvedValue([])
    mockPurchaseFindMany.mockResolvedValue([])

    const app = buildApp()
    await app.inject({ method: 'GET', url: '/f29?year=2026&month=3', headers })

    expect(mockDocumentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: COMPANY_ID }),
      })
    )
  })
})
