import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

vi.mock('@contachile/auth', () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue(null) } },
  decryptCertPassword: vi.fn(),
}))

vi.mock('@contachile/db', () => ({
  prisma: {
    companyMembership: {
      findMany: vi.fn().mockResolvedValue([{ companyId: 'company-rpt', role: 'owner' }]),
      findFirst: vi.fn(),
    },
    company: { findUnique: vi.fn(), upsert: vi.fn(), findFirst: vi.fn() },
  },
}))

vi.mock('../../../src/lib/financial-statements', () => ({
  computeTrialBalance: vi.fn(),
  computeIncomeStatement: vi.fn(),
  computeBalanceSheet: vi.fn(),
}))

import {
  computeTrialBalance,
  computeIncomeStatement,
  computeBalanceSheet,
} from '../../../src/lib/financial-statements'
import tenantPlugin from '../../../src/plugins/tenant'
import reportsRoute from '../../../src/routes/accounting/reports'

const mockTrialBalance = vi.mocked(computeTrialBalance)
const mockIncomeStatement = vi.mocked(computeIncomeStatement)
const mockBalanceSheet = vi.mocked(computeBalanceSheet)

const COMPANY = 'company-rpt'

const TRIAL_BALANCE_RESPONSE = {
  asOf: '2026-03-31',
  rows: [],
  totals: { totalDebit: 1_190_000, totalCredit: 1_190_000, saldoDeudor: 1_190_000, saldoAcreedor: 1_190_000, balanced: true },
}

const INCOME_RESPONSE = {
  from: '2026-01-01',
  to: '2026-03-31',
  ingresos: { total: 1_000_000, rows: [] },
  costos: { total: 0, rows: [] },
  gastos: { total: 0, rows: [] },
  utilidadBruta: 1_000_000,
  utilidadEjercicio: 1_000_000,
}

const BALANCE_RESPONSE = {
  asOf: '2026-03-31',
  activo: { total: 1_190_000, rows: [] },
  pasivo: { total: 190_000, rows: [] },
  patrimonio: { total: 0, rows: [] },
  utilidadEjercicio: 1_000_000,
  totalPasivoPatrimonio: 1_190_000,
  balanced: true,
}

function buildApp() {
  const app = Fastify()
  app.register(tenantPlugin)
  app.register(reportsRoute)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.DEV_BYPASS_AUTH
  process.env.NODE_ENV = 'test'
  mockTrialBalance.mockResolvedValue(TRIAL_BALANCE_RESPONSE)
  mockIncomeStatement.mockResolvedValue(INCOME_RESPONSE)
  mockBalanceSheet.mockResolvedValue(BALANCE_RESPONSE)
})

describe('GET /accounting/reports/trial-balance', () => {
  it('retorna balance de comprobación con campo balanced → 200', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/accounting/reports/trial-balance?asOf=2026-03-31',
      headers: { 'x-company-id': COMPANY },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.totals.balanced).toBe(true)
    expect(mockTrialBalance).toHaveBeenCalledWith(COMPANY, expect.any(Date))
  })

  it('usa fecha de hoy cuando asOf no se especifica', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/accounting/reports/trial-balance',
      headers: { 'x-company-id': COMPANY },
    })

    expect(res.statusCode).toBe(200)
    expect(mockTrialBalance).toHaveBeenCalledOnce()
  })
})

describe('GET /accounting/reports/income-statement', () => {
  it('retorna estado de resultados con utilidadEjercicio → 200', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/accounting/reports/income-statement?from=2026-01-01&to=2026-03-31',
      headers: { 'x-company-id': COMPANY },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.utilidadEjercicio).toBe(1_000_000)
    expect(body.ingresos.total).toBe(1_000_000)
  })

  it('retorna 400 cuando faltan parámetros from/to', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/accounting/reports/income-statement?from=2026-01-01',
      headers: { 'x-company-id': COMPANY },
    })

    expect(res.statusCode).toBe(400)
    expect(mockIncomeStatement).not.toHaveBeenCalled()
  })
})

describe('GET /accounting/reports/balance-sheet', () => {
  it('retorna balance general con campo balanced → 200', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/accounting/reports/balance-sheet?asOf=2026-03-31',
      headers: { 'x-company-id': COMPANY },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.balanced).toBe(true)
    expect(body.activo.total).toBe(1_190_000)
    expect(body.totalPasivoPatrimonio).toBe(1_190_000)
  })

  it('usa fecha de hoy cuando asOf no se especifica', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/accounting/reports/balance-sheet',
      headers: { 'x-company-id': COMPANY },
    })

    expect(res.statusCode).toBe(200)
    expect(mockBalanceSheet).toHaveBeenCalledOnce()
  })
})
