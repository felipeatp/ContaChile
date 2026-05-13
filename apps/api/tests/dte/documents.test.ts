import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { prisma } from '@contachile/db'
import tenantPlugin from '../../src/plugins/tenant'
import documentsRoute from '../../src/routes/dte/documents'

vi.mock('@contachile/db', () => ({
  prisma: {
    document: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
    },
  },
}))

const mockDocs = [
  {
    id: 'doc-1',
    type: 33,
    folio: 1,
    status: 'ACCEPTED',
    trackId: 'SII-111',
    receiverRut: '12345678-5',
    receiverName: 'Cliente A',
    receiverEmail: 'a@example.com',
    totalNet: 100000,
    totalTax: 19000,
    totalAmount: 119000,
    paymentMethod: 'CONTADO',
    emittedAt: new Date('2026-05-13T10:00:00Z'),
    acceptedAt: new Date('2026-05-13T11:00:00Z'),
  },
  {
    id: 'doc-2',
    type: 33,
    folio: 2,
    status: 'PENDING',
    trackId: 'SII-222',
    receiverRut: '87654321-0',
    receiverName: 'Cliente B',
    receiverEmail: null,
    totalNet: 50000,
    totalTax: 9500,
    totalAmount: 59500,
    paymentMethod: 'CREDITO',
    emittedAt: new Date('2026-05-12T10:00:00Z'),
    acceptedAt: null,
  },
]

describe('GET /documents', () => {
  const mockPrisma = prisma as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns list of documents', async () => {
    mockPrisma.document.findMany.mockResolvedValue(mockDocs)
    mockPrisma.document.count.mockResolvedValue(2)

    const app = Fastify()
    app.register(tenantPlugin)
    app.register(documentsRoute)

    const response = await app.inject({
      method: 'GET',
      url: '/documents',
      headers: { 'x-company-id': 'company-123' },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.documents).toHaveLength(2)
    expect(body.total).toBe(2)
    expect(body.documents[0].id).toBe('doc-1')
    expect(body.documents[1].status).toBe('PENDING')
  })

  it('filters by status query param', async () => {
    mockPrisma.document.findMany.mockResolvedValue([mockDocs[0]])
    mockPrisma.document.count.mockResolvedValue(1)

    const app = Fastify()
    app.register(tenantPlugin)
    app.register(documentsRoute)

    const response = await app.inject({
      method: 'GET',
      url: '/documents?status=ACCEPTED',
      headers: { 'x-company-id': 'company-123' },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.documents).toHaveLength(1)
    expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: 'ACCEPTED' }),
      })
    )
  })
})

describe('GET /documents/:id', () => {
  const mockPrisma = prisma as any

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns a single document with items', async () => {
    mockPrisma.document.findUnique.mockResolvedValue({
      ...mockDocs[0],
      items: [
        { id: 'item-1', description: 'Servicio', quantity: 1, unitPrice: 100000, totalPrice: 100000 },
      ],
    })

    const app = Fastify()
    app.register(tenantPlugin)
    app.register(documentsRoute)

    const response = await app.inject({
      method: 'GET',
      url: '/documents/doc-1',
      headers: { 'x-company-id': 'company-123' },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.id).toBe('doc-1')
    expect(body.items).toHaveLength(1)
    expect(body.items[0].description).toBe('Servicio')
  })

  it('returns 404 for non-existent document', async () => {
    mockPrisma.document.findUnique.mockResolvedValue(null)

    const app = Fastify()
    app.register(tenantPlugin)
    app.register(documentsRoute)

    const response = await app.inject({
      method: 'GET',
      url: '/documents/nonexistent',
      headers: { 'x-company-id': 'company-123' },
    })

    expect(response.statusCode).toBe(404)
    const body = JSON.parse(response.body)
    expect(body.error).toBe('Document not found')
  })
})
