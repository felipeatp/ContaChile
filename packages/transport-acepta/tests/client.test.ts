import { describe, it, expect } from 'vitest'
import { AceptaClient } from '../src/client'

describe('AceptaClient', () => {
  it('returns documentId on emit', async () => {
    const client = new AceptaClient({ apiKey: 'test-key' })
    const result = await client.emitDocument({
      type: 33,
      receiver: { rut: '12345678-9', name: 'Cliente', address: 'A', commune: 'C', city: 'S' },
      items: [{ description: 'X', quantity: 1, unitPrice: 100 }],
      paymentMethod: 'CONTADO',
    })
    expect(result.documentId).toBeDefined()
  })
})
