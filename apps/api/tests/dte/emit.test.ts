import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import emitRoute from '../../src/routes/dte/emit'

describe('POST /dte/emit', () => {
  it('returns 201 with document metadata', async () => {
    const app = Fastify()
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
    expect(body).toHaveProperty('id')
    expect(body).toHaveProperty('folio')
    expect(body).toHaveProperty('trackId')
    expect(body.status).toBe('PENDING')
  })
})
