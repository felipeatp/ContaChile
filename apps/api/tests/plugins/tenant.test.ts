import { describe, it, expect, vi } from 'vitest'
import Fastify from 'fastify'
import tenantPlugin from '../../src/plugins/tenant'

vi.mock('@clerk/backend', () => ({
  verifyToken: vi.fn(),
}))

import { verifyToken } from '@clerk/backend'

describe('tenantPlugin', () => {
  const mockVerifyToken = verifyToken as any

  it('allows x-company-id header when clerk is not configured', async () => {
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

  it('verifies clerk JWT when Authorization header is present', async () => {
    mockVerifyToken.mockResolvedValue({ orgId: 'org_456', sub: 'user_123' })

    const originalEnv = process.env.CLERK_SECRET_KEY
    process.env.CLERK_SECRET_KEY = 'sk_test_xxx'

    const app = Fastify()
    app.register(tenantPlugin)
    app.get('/test', async (request) => ({ companyId: request.companyId }))

    const response = await app.inject({
      method: 'GET',
      url: '/test',
      headers: { Authorization: 'Bearer test-jwt-token' },
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.companyId).toBe('org_456')
    expect(mockVerifyToken).toHaveBeenCalledWith('test-jwt-token', {
      secretKey: 'sk_test_xxx',
    })

    process.env.CLERK_SECRET_KEY = originalEnv
  })
})
