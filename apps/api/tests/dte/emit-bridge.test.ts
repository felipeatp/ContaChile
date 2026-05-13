import { describe, it, expect, vi } from 'vitest'
import Fastify from 'fastify'
import { prisma } from '@contachile/db'
import tenantPlugin from '../../src/plugins/tenant'
import emitBridgeRoute from '../../src/routes/dte/emit-bridge'

vi.mock('@contachile/db', () => ({
  prisma: {
    document: {
      create: vi.fn(),
    },
  },
}))

vi.mock('../../src/queues/dte', () => ({
  enqueuePollJob: vi.fn(),
}))

describe('POST /dte/emit-bridge', () => {
  const mockPrisma = prisma as any

  it('returns 201 with persisted bridge document metadata', async () => {
    mockPrisma.document.create.mockResolvedValue({
      id: 'doc-bridge-1',
      type: 33,
      status: 'PENDING',
      trackId: 'ACEPTA-12345',
      emittedAt: new Date('2026-05-13T10:00:00Z'),
    })

    const app = Fastify()
    app.register(tenantPlugin)
    app.register(emitBridgeRoute)

    const response = await app.inject({
      method: 'POST',
      url: '/dte/emit-bridge',
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
    expect(body.id).toBe('doc-bridge-1')
    expect(body.status).toBe('PENDING')
    expect(body.trackId).toBe('ACEPTA-12345')
    expect(mockPrisma.document.create).toHaveBeenCalled()
  })
})