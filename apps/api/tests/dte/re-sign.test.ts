import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import tenantPlugin from '../../src/plugins/tenant'
import reSignRoute from '../../src/routes/dte/re-sign'

vi.mock('@contachile/db', () => ({
  prisma: {
    document: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
    },
    auditLog: {
      create: vi.fn().mockResolvedValue({}),
    },
  },
}))

vi.mock('@contachile/dte', () => ({
  runPipeline: vi.fn(),
  extractPrivateKeyFromPfx: vi.fn(),
}))

vi.mock('@contachile/auth', () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue(null) } },
}))

import { prisma } from '@contachile/db'
import { runPipeline, extractPrivateKeyFromPfx } from '@contachile/dte'

const mockFindFirst = prisma.document.findFirst as ReturnType<typeof vi.fn>
const mockCompanyFindUnique = prisma.company.findUnique as ReturnType<typeof vi.fn>
const mockDocumentUpdate = prisma.document.update as ReturnType<typeof vi.fn>
const mockRunPipeline = runPipeline as ReturnType<typeof vi.fn>
const mockExtractKey = extractPrivateKeyFromPfx as ReturnType<typeof vi.fn>

const COMPANY_ID = 'company-resign-test'
const VALID_CERT = 'A'.repeat(200)

const MOCK_DOC = {
  id: 'doc-1',
  companyId: COMPANY_ID,
  type: 33,
  folio: 42,
  status: 'FAILED',
  receiverRut: '12.345.678-5',
  receiverName: 'Cliente Test',
  receiverAddress: 'Calle Falsa 123',
  receiverCommune: 'Santiago',
  receiverCity: 'Santiago',
  emittedAt: new Date('2026-06-01'),
  paymentMethod: 'CONTADO',
  rejectionReason: 'Error firma',
  items: [{ description: 'Servicio', quantity: 1, unitPrice: 100_000 }],
}

const MOCK_COMPANY = {
  id: COMPANY_ID,
  rut: '76.123.456-7',
  name: 'Empresa Test SpA',
  address: 'Calle Test 1',
  commune: 'Santiago',
  city: 'Santiago',
  giro: 'Servicios',
  economicActivity: '620200',
  certEncrypted: VALID_CERT,
  certPassword: 'secret',
}

function buildApp() {
  const app = Fastify()
  app.register(tenantPlugin)
  app.register(reSignRoute)
  return app
}

const headers = { 'x-active-company-id': COMPANY_ID, 'x-user-id': 'user-1' }

beforeEach(() => {
  vi.clearAllMocks()
  process.env.DEV_BYPASS_AUTH = 'true'
  mockDocumentUpdate.mockResolvedValue({ ...MOCK_DOC, status: 'PENDING', xmlContent: '<signed/>' })
})

describe('POST /documents/:id/re-sign', () => {
  it('re-firma el documento FAILED con el certificado de la empresa', async () => {
    mockFindFirst.mockResolvedValue(MOCK_DOC)
    mockCompanyFindUnique.mockResolvedValue(MOCK_COMPANY)
    mockExtractKey.mockReturnValue('-----BEGIN RSA PRIVATE KEY-----\nfake\n-----END RSA PRIVATE KEY-----')
    mockRunPipeline.mockResolvedValue({ xml: '<DTE signed/>', pdf: Buffer.from('') })

    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/documents/doc-1/re-sign',
      headers,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.signed).toBe(true)
    expect(body.status).toBe('PENDING')

    expect(mockDocumentUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'doc-1' },
        data: expect.objectContaining({ status: 'PENDING', xmlContent: '<DTE signed/>' }),
      })
    )
  })

  it('retorna 404 si el documento no está en estado FAILED/REJECTED', async () => {
    mockFindFirst.mockResolvedValue(null)

    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/documents/doc-999/re-sign',
      headers,
    })

    expect(res.statusCode).toBe(404)
  })

  it('retorna 400 si la empresa no tiene certificado configurado', async () => {
    mockFindFirst.mockResolvedValue(MOCK_DOC)
    mockCompanyFindUnique.mockResolvedValue({
      ...MOCK_COMPANY,
      certEncrypted: null,
    })

    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/documents/doc-1/re-sign',
      headers,
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toContain('certificado')
  })

  it('retorna 400 si la empresa no tiene certPassword', async () => {
    mockFindFirst.mockResolvedValue(MOCK_DOC)
    mockCompanyFindUnique.mockResolvedValue({
      ...MOCK_COMPANY,
      certPassword: null,
    })

    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/documents/doc-1/re-sign',
      headers,
    })

    expect(res.statusCode).toBe(400)
  })

  it('retorna 500 si runPipeline lanza error', async () => {
    mockFindFirst.mockResolvedValue(MOCK_DOC)
    mockCompanyFindUnique.mockResolvedValue(MOCK_COMPANY)
    mockExtractKey.mockReturnValue('fake-pem')
    mockRunPipeline.mockRejectedValue(new Error('Firma inválida'))

    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/documents/doc-1/re-sign',
      headers,
    })

    expect(res.statusCode).toBe(500)
    expect(res.json().error).toContain('re-firmar')
  })
})
