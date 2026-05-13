import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import emitBridgeRoute from '../../src/routes/dte/emit-bridge'

describe('POST /dte/emit-bridge', () => {
  it('returns 201 with bridge document metadata', async () => {
    const app = Fastify()
    app.register(emitBridgeRoute)

    const response = await app.inject({
      method: 'POST',
      url: '/dte/emit-bridge',
      headers: { 'x-company-id': 'company-123' },
      payload: {
        type: 33,
        receiver: {
          rut: '12345678-9',
          name: 'Cliente',
          address: 'Calle 123',
        },
        items: [{ description: 'Servicio', quantity: 1, unitPrice: 100000 }],
        paymentMethod: 'CONTADO',
      },
    })

    expect(response.statusCode).toBe(201)
    const body = JSON.parse(response.body)
    expect(body).toHaveProperty('id')
    expect(body.status).toBe('PENDING')
  })
})
