import { describe, it, expect } from 'vitest'
import { SIIClient } from '../src/client'

describe('SIIClient', () => {
  it('returns a trackId on send', async () => {
    const client = new SIIClient({ baseURL: 'https://maullin.sii.cl', env: 'test' })
    const result = await client.sendDTE('<xml/>')
    expect(result.trackId).toBeDefined()
    expect(result.trackId.length).toBeGreaterThan(0)
  })
})
