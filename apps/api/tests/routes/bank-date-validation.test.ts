import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import tenantPlugin from '../../src/plugins/tenant'
import bankRoute from '../../src/routes/bank'

vi.mock('@contachile/db', () => ({
  prisma: {
    bankAccount: { findMany: vi.fn() },
    bankMovement: { findMany: vi.fn(), findFirst: vi.fn(), update: vi.fn() },
  },
}))

vi.mock('@contachile/auth', () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue(null) } },
  decryptCertPassword: vi.fn(),
}))

vi.mock('../../src/lib/bank-service', () => ({
  syncBankAccounts: vi.fn(),
  syncMovements: vi.fn(),
  findAndApplyMatch: vi.fn(),
  reconcileWithEntry: vi.fn(),
  connectBankLink: vi.fn(),
  setAccountMode: vi.fn(),
  createLinkIntent: vi.fn(),
  exchangeLinkToken: vi.fn(),
}))

vi.mock('@contachile/ai-agents', () => ({ clasificarTransaccion: vi.fn() }))
vi.mock('@contachile/fintoc-client', () => ({
  FintocClient: vi.fn().mockImplementation(() => ({})),
}))

import { prisma } from '@contachile/db'

const mockMovFindMany = prisma.bankMovement.findMany as ReturnType<typeof vi.fn>

const HEADERS = { 'x-company-id': 'company-bank-test' }

function buildApp() {
  const app = Fastify()
  app.register(tenantPlugin)
  app.register(bankRoute)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.DEV_BYPASS_AUTH
  delete process.env.NODE_ENV
  mockMovFindMany.mockResolvedValue([])
})

describe('GET /bank/movements — validación de fechas', () => {
  it('fechas válidas → 200', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/bank/movements?from=2025-01-01&to=2025-01-31',
      headers: HEADERS,
    })
    expect(res.statusCode).toBe(200)
  })

  it('from inválida (texto) → 400', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/bank/movements?from=banana',
      headers: HEADERS,
    })
    expect(res.statusCode).toBe(400)
  })

  it('to inválida (fecha imposible) → 400', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/bank/movements?to=2025-13-99',
      headers: HEADERS,
    })
    expect(res.statusCode).toBe(400)
  })

  it('sin filtros → 200 sin filtro de fecha en query', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/bank/movements', headers: HEADERS })
    expect(res.statusCode).toBe(200)
    const call = mockMovFindMany.mock.calls[0][0]
    expect(call.where.postedAt).toBeUndefined()
  })
})
