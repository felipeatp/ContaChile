import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import tenantPlugin from '../../src/plugins/tenant'
import quotesRoute from '../../src/routes/quotes'

vi.mock('@contachile/db', () => ({
  prisma: {
    quote: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), create: vi.fn(), update: vi.fn(), delete: vi.fn() },
    folioCounter: { findUnique: vi.fn(), update: vi.fn(), create: vi.fn() },
    document: { create: vi.fn() },
    quoteItem: { deleteMany: vi.fn() },
    company: { findUnique: vi.fn() },
  },
}))

vi.mock('@contachile/auth', () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue(null) } },
  decryptCertPassword: vi.fn(),
}))

vi.mock('../../src/lib/accounting-entries', () => ({ createSalesEntry: vi.fn() }))
vi.mock('../../src/lib/quote-pdf', () => ({ generateQuotePdf: vi.fn() }))

import { prisma } from '@contachile/db'

const mockFindMany = prisma.quote.findMany as ReturnType<typeof vi.fn>
const mockCount = prisma.quote.count as ReturnType<typeof vi.fn>

const HEADERS = { 'x-company-id': 'company-quote-test' }

function buildApp() {
  const app = Fastify()
  app.register(tenantPlugin)
  app.register(quotesRoute)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.DEV_BYPASS_AUTH
  delete process.env.NODE_ENV
  mockFindMany.mockResolvedValue([])
  mockCount.mockResolvedValue(0)
})

describe('GET /quotes — paginación', () => {
  it('retorna total, page, limit con defaults (page=1, limit=50)', async () => {
    const quotes = [{ id: 'q1', number: 1, status: 'DRAFT', items: [] }]
    mockFindMany.mockResolvedValue(quotes)
    mockCount.mockResolvedValue(1)

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/quotes', headers: HEADERS })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total).toBe(1)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(50)
    expect(body.quotes).toHaveLength(1)
  })

  it('page=2&limit=10 → skip=10 en Prisma', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(200)

    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/quotes?page=2&limit=10',
      headers: HEADERS,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.page).toBe(2)
    expect(body.limit).toBe(10)
    const call = mockFindMany.mock.calls[0][0]
    expect(call.skip).toBe(10)
    expect(call.take).toBe(10)
  })

  it('limit=999 → 400', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/quotes?limit=999',
      headers: HEADERS,
    })
    expect(res.statusCode).toBe(400)
  })
})
