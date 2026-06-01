import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { prisma } from '@contachile/db'
import tenantPlugin from '../../src/plugins/tenant'
import emitRoute from '../../src/routes/dte/emit'

// Cert needs > 100 chars for the route's "configured" check to pass.
const FAKE_CERT = 'A'.repeat(120)

const COMPANY = {
  id: 'company-123',
  rut: '76.123.456-7',
  name: 'Emisor SpA',
  giro: 'Servicios',
  address: 'Calle 1',
  commune: 'Santiago',
  city: 'Santiago',
  economicActivity: '620200',
  certEncrypted: FAKE_CERT,
  certPassword: 'cert-pass',
}

vi.mock('@contachile/db', () => ({
  prisma: {
    company: { findUnique: vi.fn() },
    document: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    documentItem: { findMany: vi.fn().mockResolvedValue([]) },
    $queryRaw: vi.fn(),
  },
}))

vi.mock('@contachile/auth', () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue(null) } },
  decryptCertPassword: vi.fn(),
}))

// runPipeline rejects → route logs a warning and still persists (signed:false).
vi.mock('@contachile/dte', () => ({
  runPipeline: vi.fn().mockRejectedValue(new Error('no signing in tests')),
  extractPrivateKeyFromPfx: vi.fn().mockReturnValue('PEM'),
}))

vi.mock('../../src/queues/dte', () => ({ enqueuePollJob: vi.fn() }))
vi.mock('../../src/lib/email', () => ({
  createEmailService: () => ({ sendDocumentEmitted: vi.fn() }),
}))
vi.mock('../../src/lib/accounting-entries', () => ({
  createSalesEntry: vi.fn().mockResolvedValue(undefined),
}))
vi.mock('../../src/lib/inventory-service', () => ({
  recordSalesMovements: vi.fn().mockResolvedValue(undefined),
}))

describe('POST /dte/emit', () => {
  const mockPrisma = prisma as any

  beforeEach(() => {
    vi.clearAllMocks()
    mockPrisma.company.findUnique.mockResolvedValue(COMPANY)
    mockPrisma.document.findUnique.mockResolvedValue(null)
    mockPrisma.documentItem.findMany.mockResolvedValue([])
    // Atomic folio assignment returns a BigInt folio.
    mockPrisma.$queryRaw.mockResolvedValue([{ folio: BigInt(1) }])
  })

  it('returns 201 with persisted document metadata', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ folio: BigInt(1) }])
    mockPrisma.document.create.mockResolvedValue({
      id: 'doc-abc123',
      type: 33,
      folio: 1,
      status: 'PENDING',
      trackId: 'SII-12345',
      emittedAt: new Date('2026-05-13T10:00:00Z'),
      receiverEmail: null,
      companyId: 'company-123',
    })

    const app = Fastify()
    app.register(tenantPlugin)
    app.register(emitRoute)

    const response = await app.inject({
      method: 'POST',
      url: '/dte/emit',
      headers: { 'x-company-id': 'company-123' },
      payload: {
        type: 33,
        receiver: {
          rut: '12345678-5',
          name: 'Cliente',
          address: 'Calle 123',
          commune: 'Santiago',
          city: 'Santiago',
        },
        items: [{ description: 'Servicio', quantity: 1, unitPrice: 100000 }],
        paymentMethod: 'CONTADO',
      },
    })

    expect(response.statusCode, response.body).toBe(201)
    const body = JSON.parse(response.body)
    expect(body.id).toBe('doc-abc123')
    expect(body.folio).toBe(1)
    expect(body.status).toBe('PENDING')
    expect(body.trackId).toBe('SII-12345')

    expect(mockPrisma.$queryRaw).toHaveBeenCalled()
    expect(mockPrisma.document.create).toHaveBeenCalled()
  })

  it('uses the folio returned by the atomic counter', async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ folio: BigInt(42) }])
    mockPrisma.document.create.mockResolvedValue({
      id: 'doc-xyz',
      type: 33,
      folio: 42,
      status: 'PENDING',
      trackId: 'SII-999',
      emittedAt: new Date('2026-05-13T10:00:00Z'),
      receiverEmail: null,
      companyId: 'company-123',
    })

    const app = Fastify()
    app.register(tenantPlugin)
    app.register(emitRoute)

    const response = await app.inject({
      method: 'POST',
      url: '/dte/emit',
      headers: { 'x-company-id': 'company-123' },
      payload: {
        type: 33,
        receiver: {
          rut: '12345678-5',
          name: 'Cliente',
          address: 'Calle 123',
          commune: 'Santiago',
          city: 'Santiago',
        },
        items: [{ description: 'Servicio', quantity: 1, unitPrice: 100000 }],
        paymentMethod: 'CONTADO',
      },
    })

    expect(response.statusCode, response.body).toBe(201)
    const body = JSON.parse(response.body)
    expect(body.folio).toBe(42)
    expect(mockPrisma.$queryRaw).toHaveBeenCalled()
  })

  it('returns existing document for duplicate idempotency key', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      id: 'doc-existing',
      type: 33,
      folio: 7,
      status: 'PENDING',
      trackId: 'SII-OLD',
      emittedAt: new Date('2026-05-13T10:00:00Z'),
    })

    const app = Fastify()
    app.register(tenantPlugin)
    app.register(emitRoute)

    const response = await app.inject({
      method: 'POST',
      url: '/dte/emit',
      headers: { 'x-company-id': 'company-123', 'Idempotency-Key': 'key-123' },
      payload: {
        type: 33,
        receiver: {
          rut: '12345678-5',
          name: 'Cliente',
          address: 'Calle 123',
          commune: 'Santiago',
          city: 'Santiago',
        },
        items: [{ description: 'Servicio', quantity: 1, unitPrice: 100000 }],
        paymentMethod: 'CONTADO',
      },
    })

    expect(response.statusCode, response.body).toBe(201)
    const body = JSON.parse(response.body)
    expect(body.id).toBe('doc-existing')
    expect(body.folio).toBe(7)
    expect(mockPrisma.document.create).not.toHaveBeenCalled()
    expect(mockPrisma.document.findUnique).toHaveBeenCalledWith({
      where: { idempotencyKey: 'key-123' },
    })
  })
})
