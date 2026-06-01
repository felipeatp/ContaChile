import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import tenantPlugin from '../../src/plugins/tenant'
import f22AiRoute from '../../src/routes/ai/f22'

vi.mock('@contachile/ai-agents', () => ({
  streamF22Assistant: vi.fn(),
}))

vi.mock('@contachile/db', () => ({
  prisma: {
    companyMembership: {
      findMany: vi.fn().mockResolvedValue([{ companyId: 'test-company', role: 'owner' }]),
    },
    company: { upsert: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
  },
}))

vi.mock('@contachile/auth', () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue(null) } },
  decryptCertPassword: vi.fn(),
}))

import { streamF22Assistant } from '@contachile/ai-agents'
const mockStream = vi.mocked(streamF22Assistant)

async function* makeGenerator(...events: object[]) {
  for (const e of events) yield e
}

describe('POST /ai/f22', () => {
  beforeEach(() => {
    process.env.DEV_BYPASS_AUTH = 'true'
    mockStream.mockReset()
  })

  it('retorna 400 cuando el año es invalido', async () => {
    const app = Fastify()
    app.register(tenantPlugin)
    app.register(f22AiRoute)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/ai/f22',
      payload: { year: 1990 },
    })

    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error).toBeTruthy()
  })

  it('emite eventos SSE con text_delta del agente', async () => {
    mockStream.mockImplementation(() =>
      makeGenerator(
        { type: 'text_delta', text: 'Tu F22 del año 2025 ' },
        { type: 'text_delta', text: 'muestra saldo a pagar de $50.000.' },
        { type: 'done', fullText: 'Tu F22 del año 2025 muestra saldo a pagar de $50.000.' }
      )
    )

    const app = Fastify()
    app.register(tenantPlugin)
    app.register(f22AiRoute)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/ai/f22',
      payload: { year: 2025 },
    })

    expect(res.statusCode).toBe(200)
    expect(res.headers['content-type']).toContain('text/event-stream')
    expect(res.body).toContain('event: delta')
    expect(res.body).toContain('Tu F22 del año 2025')
    expect(res.body).toContain('event: done')
  })

  it('usa el año actual cuando no se pasa year', async () => {
    mockStream.mockImplementation(() => makeGenerator({ type: 'done', fullText: 'ok' }))

    const app = Fastify()
    app.register(tenantPlugin)
    app.register(f22AiRoute)
    await app.ready()

    await app.inject({ method: 'POST', url: '/ai/f22', payload: {} })

    expect(mockStream).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(String),
      new Date().getFullYear()
    )
  })

  it('emite evento SSE error cuando el agente lanza excepcion', async () => {
    mockStream.mockImplementation(async function* () {
      throw new Error('Anthropic timeout')
    })

    const app = Fastify()
    app.register(tenantPlugin)
    app.register(f22AiRoute)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/ai/f22',
      payload: { year: 2025 },
    })

    expect(res.statusCode).toBe(200)
    expect(res.body).toContain('event: error')
  })
})
