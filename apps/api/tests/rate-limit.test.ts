import { describe, it, expect } from 'vitest'
import Fastify from 'fastify'
import rateLimit from '@fastify/rate-limit'

describe('rate limiting', () => {
  it('returns 429 after exceeding limit', async () => {
    const app = Fastify()
    await app.register(rateLimit, {
      max: 2,
      timeWindow: '1 minute',
    })

    app.get('/test', async () => 'ok')

    // First 2 requests should succeed
    const res1 = await app.inject({ method: 'GET', url: '/test' })
    const res2 = await app.inject({ method: 'GET', url: '/test' })
    expect(res1.statusCode).toBe(200)
    expect(res2.statusCode).toBe(200)

    // Third request should be rate limited
    const res3 = await app.inject({ method: 'GET', url: '/test' })
    expect(res3.statusCode).toBe(429)
    expect(JSON.parse(res3.body)).toMatchObject({
      statusCode: 429,
      error: 'Too Many Requests',
    })
  })
})
