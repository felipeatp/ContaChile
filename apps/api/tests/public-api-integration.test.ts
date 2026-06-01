import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import tenantPlugin from '../src/plugins/tenant'
import publicApiPlugin from '../src/plugins/public-api'
import publicApiRoute from '../src/routes/public-api'
import apiKeysRoute from '../src/routes/api-keys'
import webhooksRoute from '../src/routes/webhooks'

vi.mock('@contachile/db', () => ({
  prisma: {
    apiKey: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn().mockResolvedValue({}),
      updateMany: vi.fn(),
    },
    companyMembership: {
      findMany: vi.fn().mockResolvedValue([{ companyId: 'company-1', role: 'owner' }]),
      create: vi.fn(),
    },
    webhook: {
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
    },
    company: {
      findUnique: vi.fn(),
    },
    document: {
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
    purchase: {
      findMany: vi.fn(),
      count: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}))

vi.mock('@contachile/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

import { prisma } from '@contachile/db'
import { auth } from '@contachile/auth'

const mockPrisma = prisma as any
const mockSession = auth.api.getSession as any

describe('Public API Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.mockResolvedValue({
      user: { id: 'user-1', email: 'test@test.com', name: 'Test' },
    })
  })

  describe('Public endpoints with API key', () => {
    const apiKey = 'ck_live_testkey123'
    // sha256('ck_live_testkey123') — must match plugins/public-api.ts hashKey().
    const keyHash = 'e4796c11a0a79566f5f73a03df96cd1205fb1cf8a42a9dd79221e50e475472d8'

    beforeEach(() => {
      mockPrisma.apiKey.findUnique.mockImplementation(async ({ where }: any) => {
        if (where.keyHash === keyHash) {
          return {
            id: 'key-1',
            companyId: 'company-1',
            name: 'Test Key',
            keyHash,
            scopes: ['read:company', 'read:documents', 'read:purchases', 'read:accounting'],
            revoked: false,
          }
        }
        return null
      })
    })

    it('GET /public/v1/company returns company data', async () => {
      mockPrisma.company.findUnique.mockResolvedValue({
        id: 'company-1',
        rut: '76.123.456-7',
        name: 'Test SpA',
        createdAt: new Date(),
      })

      const app = Fastify()
      app.register(publicApiPlugin)
      app.register(publicApiRoute)

      const response = await app.inject({
        method: 'GET',
        url: '/public/v1/company',
        headers: { 'x-api-key': apiKey },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.company.name).toBe('Test SpA')
    })

    it('GET /public/v1/company returns 401 without API key', async () => {
      // No API key and no session → must be rejected.
      mockSession.mockResolvedValue(null)

      const app = Fastify()
      app.register(publicApiPlugin)
      app.register(publicApiRoute)

      const response = await app.inject({
        method: 'GET',
        url: '/public/v1/company',
      })

      expect(response.statusCode).toBe(401)
    })

    it('GET /public/v1/company returns 403 with missing scope', async () => {
      mockPrisma.apiKey.findUnique.mockResolvedValue({
        id: 'key-2',
        companyId: 'company-1',
        keyHash,
        scopes: ['read:documents'],
        revoked: false,
      })

      const app = Fastify()
      app.register(publicApiPlugin)
      app.register(publicApiRoute)

      const response = await app.inject({
        method: 'GET',
        url: '/public/v1/company',
        headers: { 'x-api-key': apiKey },
      })

      expect(response.statusCode).toBe(403)
    })

    it('GET /public/v1/documents lists documents', async () => {
      mockPrisma.document.findMany.mockResolvedValue([])
      mockPrisma.document.count.mockResolvedValue(0)

      const app = Fastify()
      app.register(publicApiPlugin)
      app.register(publicApiRoute)

      const response = await app.inject({
        method: 'GET',
        url: '/public/v1/documents?limit=10',
        headers: { 'x-api-key': apiKey },
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.documents).toEqual([])
      expect(body.limit).toBe(10)
    })
  })

  describe('API Keys management (session auth)', () => {
    it('POST /api-keys creates a new key', async () => {
      mockPrisma.apiKey.create.mockResolvedValue({
        id: 'key-1',
        companyId: 'company-1',
        name: 'Integration Test Key',
        keyHash: 'anyhash',
        scopes: ['read:company'],
        createdAt: new Date(),
      })

      const app = Fastify()
      app.register(tenantPlugin)
      app.register(apiKeysRoute)

      const response = await app.inject({
        method: 'POST',
        url: '/api-keys',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ name: 'Integration Test Key', scopes: ['dte:read'] }),
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.name).toBe('Integration Test Key')
      expect(body.key).toMatch(/^ck_live_/)
    })

    it('GET /api-keys lists keys', async () => {
      mockPrisma.apiKey.findMany.mockResolvedValue([
        { id: 'key-1', name: 'Key 1', scopes: ['read:company'], lastUsedAt: null, revoked: false, createdAt: new Date() },
      ])

      const app = Fastify()
      app.register(tenantPlugin)
      app.register(apiKeysRoute)

      const response = await app.inject({
        method: 'GET',
        url: '/api-keys',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.keys).toHaveLength(1)
    })

    it('DELETE /api-keys/:id revokes a key', async () => {
      mockPrisma.apiKey.updateMany.mockResolvedValue({ count: 1 })

      const app = Fastify()
      app.register(tenantPlugin)
      app.register(apiKeysRoute)

      const response = await app.inject({
        method: 'DELETE',
        url: '/api-keys/key-1',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
    })
  })

  describe('Webhooks management (session auth)', () => {
    it('POST /webhooks creates a webhook', async () => {
      mockPrisma.webhook.create.mockResolvedValue({
        id: 'wh-1',
        companyId: 'company-1',
        url: 'https://example.com/webhook',
        events: ['document.created'],
        secret: 'supersecret',
        active: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      })

      const app = Fastify()
      app.register(tenantPlugin)
      app.register(webhooksRoute)

      const response = await app.inject({
        method: 'POST',
        url: '/webhooks',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ url: 'https://example.com/webhook', events: ['document.created'] }),
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.webhook.url).toBe('https://example.com/webhook')
    })

    it('GET /webhooks lists webhooks', async () => {
      mockPrisma.webhook.findMany.mockResolvedValue([])

      const app = Fastify()
      app.register(tenantPlugin)
      app.register(webhooksRoute)

      const response = await app.inject({
        method: 'GET',
        url: '/webhooks',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.webhooks).toEqual([])
    })

    it('DELETE /webhooks/:id removes a webhook', async () => {
      mockPrisma.webhook.deleteMany.mockResolvedValue({ count: 1 })

      const app = Fastify()
      app.register(tenantPlugin)
      app.register(webhooksRoute)

      const response = await app.inject({
        method: 'DELETE',
        url: '/webhooks/wh-1',
      })

      expect(response.statusCode).toBe(200)
      const body = JSON.parse(response.body)
      expect(body.success).toBe(true)
    })
  })
})
