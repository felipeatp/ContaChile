import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

vi.mock('@contachile/db', () => ({
  prisma: {
    payroll: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    company: { findUnique: vi.fn() },
    companyMembership: {
      findMany: vi.fn().mockResolvedValue([{ companyId: 'company-pay', role: 'owner' }]),
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@contachile/auth', () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue(null) } },
  decryptCertPassword: vi.fn(),
}))

vi.mock('../../src/lib/payroll-service', () => ({
  generatePayrollForMonth: vi.fn(),
}))

vi.mock('../../src/lib/accounting-entries', () => ({
  createPayrollEntry: vi.fn().mockResolvedValue({ id: 'entry-1' }),
}))

vi.mock('../../src/lib/payroll-pdf', () => ({
  generatePayrollPdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake')),
}))

vi.mock('../../src/lib/payroll-exports', () => ({
  generatePreviRedFile: vi.fn().mockReturnValue('PREVIRED_CONTENT'),
  generateDdjj1887File: vi.fn().mockReturnValue('DDJJ_CONTENT'),
}))

import { prisma } from '@contachile/db'
import { generatePayrollForMonth } from '../../src/lib/payroll-service'
import tenantPlugin from '../../src/plugins/tenant'
import payrollRoute from '../../src/routes/payroll'

const mockPayrollFindMany = prisma.payroll.findMany as ReturnType<typeof vi.fn>
const mockPayrollFindFirst = prisma.payroll.findFirst as ReturnType<typeof vi.fn>
const mockPayrollUpdate = prisma.payroll.update as ReturnType<typeof vi.fn>
const mockGenerate = vi.mocked(generatePayrollForMonth)

const COMPANY = 'company-pay'
const HEADERS = { 'x-company-id': COMPANY, 'x-user-id': 'user-1' }

function buildApp() {
  const app = Fastify()
  app.register(tenantPlugin)
  app.register(payrollRoute)
  return app
}

const MOCK_PAYROLL = {
  id: 'pay-1',
  companyId: COMPANY,
  employeeId: 'emp-1',
  year: 2026,
  month: 5,
  bruto: 1_000_000,
  afp: 112_700,
  salud: 70_000,
  cesantia: 6_000,
  impuesto: 0,
  liquido: 811_300,
  status: 'DRAFT',
  approvedAt: null,
  employee: { rut: '12345678-5', name: 'Juan Pérez', position: 'Desarrollador', afp: 'HABITAT' },
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.DEV_BYPASS_AUTH
  process.env.NODE_ENV = 'test'
  mockGenerate.mockResolvedValue({ generated: 1, skipped: 0, errors: [] })
})

describe('POST /payroll/generate', () => {
  it('genera payroll para un mes pasado → 201', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/payroll/generate',
      headers: HEADERS,
      payload: { year: 2026, month: 5 },
    })

    expect(res.statusCode).toBe(201)
    expect(mockGenerate).toHaveBeenCalledWith(COMPANY, 2026, 5)
    const body = res.json()
    expect(body.generated).toBe(1)
  })

  it('rechaza un mes futuro → 400', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/payroll/generate',
      headers: HEADERS,
      payload: { year: 2099, month: 12 },
    })

    expect(res.statusCode).toBe(400)
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it('rechaza body inválido (mes fuera de rango) → 400', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/payroll/generate',
      headers: HEADERS,
      payload: { year: 2026, month: 13 },
    })

    expect(res.statusCode).toBe(400)
  })
})

describe('GET /payroll/:year/:month', () => {
  it('retorna liquidaciones y totales → 200', async () => {
    mockPayrollFindMany.mockResolvedValue([MOCK_PAYROLL])

    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/payroll/2026/5',
      headers: HEADERS,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.payrolls).toHaveLength(1)
    expect(body.totals.bruto).toBe(1_000_000)
    expect(body.totals.liquido).toBe(811_300)
  })

  it('mes inválido → 400', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/payroll/2026/99',
      headers: HEADERS,
    })

    expect(res.statusCode).toBe(400)
  })

  it('lista vacía cuando no hay liquidaciones', async () => {
    mockPayrollFindMany.mockResolvedValue([])

    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/payroll/2026/5',
      headers: HEADERS,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.payrolls).toHaveLength(0)
    expect(body.totals.bruto).toBe(0)
  })
})

describe('POST /payroll/item/:id/approve', () => {
  it('aprueba liquidación DRAFT → 200 y crea asiento', async () => {
    mockPayrollFindFirst.mockResolvedValue(MOCK_PAYROLL)
    mockPayrollUpdate.mockResolvedValue({ ...MOCK_PAYROLL, status: 'APPROVED', approvedAt: new Date() })

    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `/payroll/item/${MOCK_PAYROLL.id}/approve`,
      headers: HEADERS,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.status).toBe('APPROVED')
    expect(mockPayrollUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'APPROVED' }),
      })
    )
  })

  it('rechaza aprobar una liquidación que no está en DRAFT → 400', async () => {
    mockPayrollFindFirst.mockResolvedValue({ ...MOCK_PAYROLL, status: 'APPROVED' })

    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `/payroll/item/${MOCK_PAYROLL.id}/approve`,
      headers: HEADERS,
    })

    expect(res.statusCode).toBe(400)
    expect(mockPayrollUpdate).not.toHaveBeenCalled()
  })

  it('retorna 404 si la liquidación no pertenece al tenant', async () => {
    mockPayrollFindFirst.mockResolvedValue(null)

    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/payroll/item/no-existe/approve',
      headers: HEADERS,
    })

    expect(res.statusCode).toBe(404)
  })
})
