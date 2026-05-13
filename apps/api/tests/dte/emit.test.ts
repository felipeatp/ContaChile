import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { prisma } from '@contachile/db'
import tenantPlugin from '../../src/plugins/tenant'
import emitRoute from '../../src/routes/dte/emit'

vi.mock('@contachile/db', () => ({
  prisma: {
    folioCounter: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    document: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
  },
}))

vi.mock('../../src/queues/dte', () => ({
  enqueuePollJob: vi.fn(),
}))

describe('POST /dte/emit', () => {
  const mockPrisma = prisma as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns 201 with persisted document metadata', async () => {
    mockPrisma.folioCounter.findUnique.mockResolvedValue(null)
    mockPrisma.folioCounter.create.mockResolvedValue({ id: 'fc-1' })
    mockPrisma.document.create.mockResolvedValue({
      id: 'doc-abc123',
      type: 33,
      folio: 1,
      status: 'PENDING',
      trackId: 'SII-12345',
      emittedAt: new Date('2026-05-13T10:00:00Z'),
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
        },
        items: [{ description: 'Servicio', quantity: 1, unitPrice: 100000 }],
        paymentMethod: 'CONTADO',
      },
    })

    expect(response.statusCode).toBe(201)
    const body = JSON.parse(response.body)
    expect(body.id).toBe('doc-abc123')
    expect(body.folio).toBe(1)
    expect(body.status).toBe('PENDING')
    expect(body.trackId).toBe('SII-12345')

    expect(mockPrisma.folioCounter.findUnique).toHaveBeenCalledWith({
      where: { companyId_type: { companyId: 'company-123', type: 33 } },
    })
    expect(mockPrisma.folioCounter.create).toHaveBeenCalled()
    expect(mockPrisma.document.create).toHaveBeenCalled()
  })

  it('increments existing folio counter', async () => {
    mockPrisma.folioCounter.findUnique.mockResolvedValue({
      id: 'fc-1',
      companyId: 'company-123',
      type: 33,
      nextFolio: 42,
    })
    mockPrisma.folioCounter.update.mockResolvedValue({ id: 'fc-1', nextFolio: 43 })
    mockPrisma.document.create.mockResolvedValue({
      id: 'doc-xyz',
      type: 33,
      folio: 42,
      status: 'PENDING',
      trackId: 'SII-999',
      emittedAt: new Date('2026-05-13T10:00:00Z'),
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
        },
        items: [{ description: 'Servicio', quantity: 1, unitPrice: 100000 }],
        paymentMethod: 'CONTADO',
      },
    })

    expect(response.statusCode).toBe(201)
    const body = JSON.parse(response.body)
    expect(body.folio).toBe(42)
    expect(mockPrisma.folioCounter.update).toHaveBeenCalledWith({
      where: { id: 'fc-1' },
      data: { nextFolio: { increment: 1 } },
    })
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
        },
        items: [{ description: 'Servicio', quantity: 1, unitPrice: 100000 }],
        paymentMethod: 'CONTADO',
      },
    })

    expect(response.statusCode).toBe(201)
    const body = JSON.parse(response.body)
    expect(body.id).toBe('doc-existing')
    expect(body.folio).toBe(7)
    expect(mockPrisma.document.create).not.toHaveBeenCalled()
    expect(mockPrisma.document.findUnique).toHaveBeenCalledWith({
      where: { idempotencyKey: 'key-123' },
    })
  })
})
