import { describe, it, expect, vi } from 'vitest'
import Fastify from 'fastify'
import tenantPlugin from '../../src/plugins/tenant'

vi.mock('@contachile/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

import { auth } from '@contachile/auth'

describe('tenantPlugin', () => {
  const mockGetSession = auth.api.getSession as any

  it('allows x-company-id header when auth is not configured', async () => {
    const app = Fastify()
    app.register(tenantPlugin)
    app.get('/test', async (request) => ({ companyId: request.companyId }))

    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { 'x-company-id': 'company-123' },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.companyId).toBe('company-123')
  })

  it('rejects request without company id', async () => {
    const app = Fastify()
    app.register(tenantPlugin)
    app.get('/test', async () => 'ok')

    const response = await app.inject({
      method: 'GET',
      url: '/test',
    })

    expect(response.statusCode).toBe(401)
  })

  it('extracts companyId from Better Auth session', async () => {
    mockGetSession.mockResolvedValue({ user: { id: 'user_123' } })

    const app = Fastify()
    app.register(tenantPlugin)
    app.get('/test', async (request) => ({ companyId: request.companyId }))

    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { cookie: 'better-auth.session_token=valid-token' },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.companyId).toBe('user_123')
    expect(mockGetSession).toHaveBeenCalled()
  })
})
