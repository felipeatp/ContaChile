import { describe, it, expect } from 'vitest'
import { StubEmailService } from '../../src/lib/email'

describe('StubEmailService', () => {
  it('records sendDocumentAccepted calls', async () => {
    const service = new StubEmailService()
    await service.sendDocumentAccepted({
      documentId: 'doc-123',
      folio: 42,
      type: 33,
      receiverName: 'Cliente SpA',
      receiverEmail: 'cliente@example.com',
    })

    expect(service.calls).toHaveLength(1)
    expect(service.calls[0].method).toBe('sendDocumentAccepted')
    expect(service.calls[0].params).toMatchObject({
      documentId: 'doc-123',
      receiverEmail: 'cliente@example.com',
    })
  })
})
