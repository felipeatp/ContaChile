import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import tenantPlugin from '../../src/plugins/tenant'
import documentsRoute from '../../src/routes/dte/documents'
import employeesRoute from '../../src/routes/employees'
import purchasesRoute from '../../src/routes/purchases'

vi.mock('@contachile/db', () => ({
  prisma: {
    document: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    employee: {
      findMany: vi.fn().mockResolvedValue([]),
      findFirst: vi.fn().mockResolvedValue(null),
      findUnique: vi.fn().mockResolvedValue(null),
    },
    purchase: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
      aggregate: vi.fn().mockResolvedValue({ _sum: { totalAmount: 0 } }),
      findFirst: vi.fn().mockResolvedValue(null),
    },
    companyMembership: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

vi.mock('@contachile/auth', () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue(null) } },
  decryptCertPassword: vi.fn(),
}))

vi.mock('@contachile/transport-sii', () => ({
  SIIClient: vi.fn().mockImplementation(() => ({
    queryStatus: vi.fn().mockResolvedValue({ status: 'PENDING', detail: '' }),
    sendDTE: vi.fn().mockResolvedValue({ trackId: 'SII-TEST' }),
  })),
}))

vi.mock('@contachile/transport-acepta', () => ({
  AceptaClient: vi.fn().mockImplementation(() => ({
    queryStatus: vi.fn().mockResolvedValue({ status: 'PENDING', detail: '' }),
    sendDTE: vi.fn().mockResolvedValue({ trackId: 'ACEPTA-TEST' }),
  })),
}))

vi.mock('../../src/queues/dte', () => ({ enqueuePollJob: vi.fn() }))
vi.mock('../../src/lib/email', () => ({
  createEmailService: () => ({
    sendDocumentEmitted: vi.fn(),
    sendDocumentAccepted: vi.fn(),
  }),
}))

vi.mock('../../src/lib/accounting-entries', () => ({
  createPurchaseEntry: vi.fn().mockResolvedValue(undefined),
}))

import { prisma } from '@contachile/db'

const mockDocumentFindMany = prisma.document.findMany as ReturnType<typeof vi.fn>
const mockEmployeeFindMany = prisma.employee.findMany as ReturnType<typeof vi.fn>
const mockPurchaseFindMany = prisma.purchase.findMany as ReturnType<typeof vi.fn>

const COMPANY_A = 'company-alpha'
const COMPANY_B = 'company-beta'
const USER_A = 'user-alpha'

function buildApp() {
  const app = Fastify()
  app.register(tenantPlugin)
  app.register(documentsRoute)
  app.register(employeesRoute)
  app.register(purchasesRoute)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDocumentFindMany.mockResolvedValue([])
  ;(prisma.document.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)
  ;(prisma.document.findFirst as ReturnType<typeof vi.fn>).mockResolvedValue(null)
  mockEmployeeFindMany.mockResolvedValue([])
  mockPurchaseFindMany.mockResolvedValue([])
  ;(prisma.purchase.count as ReturnType<typeof vi.fn>).mockResolvedValue(0)
  // Use x-company-id header path (no session, no bypass) so each test controls the companyId
  delete process.env.DEV_BYPASS_AUTH
  delete process.env.NODE_ENV
})

describe('Multi-tenancy: aislamiento de datos entre empresas', () => {
  describe('GET /documents', () => {
    it('empresa A solo consulta sus propios documentos', async () => {
      const app = buildApp()
      await app.inject({
        method: 'GET',
        url: '/documents',
        headers: { 'x-company-id': COMPANY_A },
      })
      expect(mockDocumentFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: COMPANY_A }),
        })
      )
    })

    it('empresa B usa su propio companyId en la query', async () => {
      const app = buildApp()
      await app.inject({
        method: 'GET',
        url: '/documents',
        headers: { 'x-company-id': COMPANY_B },
      })
      expect(mockDocumentFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: COMPANY_B }),
        })
      )
    })

    it('empresa A nunca filtra por el companyId de empresa B', async () => {
      const app = buildApp()
      await app.inject({
        method: 'GET',
        url: '/documents',
        headers: { 'x-company-id': COMPANY_A },
      })
      for (const [args] of mockDocumentFindMany.mock.calls) {
        if (args?.where?.companyId) {
          expect(args.where.companyId).not.toBe(COMPANY_B)
        }
      }
    })
  })

  describe('GET /employees', () => {
    it('la query incluye companyId del tenant activo', async () => {
      const app = buildApp()
      await app.inject({
        method: 'GET',
        url: '/employees',
        headers: { 'x-company-id': COMPANY_A },
      })
      expect(mockEmployeeFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: COMPANY_A }),
        })
      )
    })
  })

  describe('GET /purchases', () => {
    it('la query incluye companyId del tenant activo', async () => {
      const app = buildApp()
      await app.inject({
        method: 'GET',
        url: '/purchases',
        headers: { 'x-company-id': COMPANY_A },
      })
      expect(mockPurchaseFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: COMPANY_A }),
        })
      )
    })
  })

  describe('Sin companyId — petición rechazada', () => {
    it('GET /documents sin x-company-id retorna 401', async () => {
      const app = buildApp()
      const res = await app.inject({ method: 'GET', url: '/documents' })
      expect([400, 401, 403]).toContain(res.statusCode)
      expect(mockDocumentFindMany).not.toHaveBeenCalled()
    })
  })
})
