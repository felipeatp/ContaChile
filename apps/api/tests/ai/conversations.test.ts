import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import { prisma } from '@contachile/db'
import tenantPlugin from '../../src/plugins/tenant'
import conversationsRoute from '../../src/routes/ai/conversations'

vi.mock('@contachile/db', () => ({
  prisma: {
    agentConversation: {
      findMany: vi.fn(),
      count: vi.fn(),
      findFirst: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  },
}))

// ─── Helpers ─────────────────────────────────────────────────────────────────

const COMPANY_A = 'company-aaa'
const COMPANY_B = 'company-bbb'
const USER_A = 'user-aaa'
const USER_B = 'user-bbb'

const CONV_A = {
  id: 'conv-1',
  companyId: COMPANY_A,
  userId: USER_A,
  agentType: 'consultor',
  title: '¿Cuánto IVA debo declarar?',
  messages: [
    { role: 'user', content: '¿Cuánto IVA debo declarar?', timestamp: '2026-06-01T10:00:00Z' },
    { role: 'assistant', content: 'El IVA es el 19% del monto neto.', timestamp: '2026-06-01T10:00:05Z' },
  ],
  createdAt: new Date('2026-06-01T10:00:00Z'),
  updatedAt: new Date('2026-06-01T10:00:05Z'),
}

const CONV_B = {
  id: 'conv-2',
  companyId: COMPANY_B,
  userId: USER_B,
  agentType: 'consultor',
  title: 'Consulta de otra empresa',
  messages: [],
  createdAt: new Date('2026-06-01T09:00:00Z'),
  updatedAt: new Date('2026-06-01T09:00:00Z'),
}

function buildApp(companyId: string, userId?: string) {
  const app = Fastify()
  // Decorar request directamente para el test
  app.addHook('onRequest', async (request) => {
    (request as any).companyId = companyId
    ;(request as any).userId = userId
  })
  app.register(conversationsRoute)
  return app
}

// ─── POST /ai/conversations ───────────────────────────────────────────────────

describe('POST /ai/conversations', () => {
  const mockPrisma = prisma as any

  beforeEach(() => vi.clearAllMocks())

  it('crea conversación asociada al companyId del usuario', async () => {
    mockPrisma.agentConversation.create.mockResolvedValue(CONV_A)

    const app = buildApp(COMPANY_A, USER_A)
    const response = await app.inject({
      method: 'POST',
      url: '/ai/conversations',
      payload: {
        agentType: 'consultor',
        messages: [
          { role: 'user', content: '¿Cuánto IVA debo declarar?', timestamp: '2026-06-01T10:00:00Z' },
        ],
      },
    })

    expect(response.statusCode).toBe(201)
    expect(mockPrisma.agentConversation.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          companyId: COMPANY_A,
          userId: USER_A,
          agentType: 'consultor',
        }),
      })
    )
    const body = JSON.parse(response.body)
    expect(body.id).toBe('conv-1')
  })

  it('devuelve 401 si no hay userId', async () => {
    const app = buildApp(COMPANY_A, undefined)
    const response = await app.inject({
      method: 'POST',
      url: '/ai/conversations',
      payload: {
        agentType: 'consultor',
        messages: [{ role: 'user', content: 'Test', timestamp: '2026-06-01T10:00:00Z' }],
      },
    })
    expect(response.statusCode).toBe(401)
  })

  it('devuelve 400 con body inválido', async () => {
    const app = buildApp(COMPANY_A, USER_A)
    const response = await app.inject({
      method: 'POST',
      url: '/ai/conversations',
      payload: { agentType: 'invalid-type', messages: [] },
    })
    expect(response.statusCode).toBe(400)
  })
})

// ─── GET /ai/conversations ────────────────────────────────────────────────────

describe('GET /ai/conversations', () => {
  const mockPrisma = prisma as any

  beforeEach(() => vi.clearAllMocks())

  it('lista solo conversaciones del companyId del usuario (no de otras empresas)', async () => {
    mockPrisma.agentConversation.findMany.mockResolvedValue([CONV_A])
    mockPrisma.agentConversation.count.mockResolvedValue(1)

    const app = buildApp(COMPANY_A, USER_A)
    const response = await app.inject({
      method: 'GET',
      url: '/ai/conversations?agentType=consultor',
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.conversations).toHaveLength(1)
    expect(body.total).toBe(1)

    // Verificar que la query filtra por companyId Y userId
    expect(mockPrisma.agentConversation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: COMPANY_A,
          userId: USER_A,
        }),
      })
    )
    // COMPANY_B no aparece en los resultados
    expect(body.conversations[0].companyId).not.toBe(COMPANY_B)
  })

  it('devuelve 401 si no hay userId', async () => {
    const app = buildApp(COMPANY_A, undefined)
    const response = await app.inject({ method: 'GET', url: '/ai/conversations' })
    expect(response.statusCode).toBe(401)
  })

  it('devuelve lista vacía cuando no hay conversaciones', async () => {
    mockPrisma.agentConversation.findMany.mockResolvedValue([])
    mockPrisma.agentConversation.count.mockResolvedValue(0)

    const app = buildApp(COMPANY_A, USER_A)
    const response = await app.inject({ method: 'GET', url: '/ai/conversations' })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.conversations).toHaveLength(0)
    expect(body.total).toBe(0)
  })
})

// ─── PATCH /ai/conversations/:id ─────────────────────────────────────────────

describe('PATCH /ai/conversations/:id', () => {
  const mockPrisma = prisma as any

  beforeEach(() => vi.clearAllMocks())

  it('solo puede modificar conversaciones propias (no de otra empresa)', async () => {
    // COMPANY_A intenta parchear una conversación que pertenece a COMPANY_B
    mockPrisma.agentConversation.findFirst.mockResolvedValue(null) // no encontrada para COMPANY_A

    const app = buildApp(COMPANY_A, USER_A)
    const response = await app.inject({
      method: 'PATCH',
      url: `/ai/conversations/${CONV_B.id}`,
      payload: {
        messages: [
          { role: 'user', content: 'Test', timestamp: '2026-06-01T11:00:00Z' },
        ],
      },
    })

    expect(response.statusCode).toBe(404)
    expect(mockPrisma.agentConversation.update).not.toHaveBeenCalled()

    // Verificar que el findFirst usó el companyId correcto (COMPANY_A), no COMPANY_B
    expect(mockPrisma.agentConversation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          companyId: COMPANY_A,
          userId: USER_A,
          id: CONV_B.id,
        }),
      })
    )
  })

  it('permite actualizar mensajes de la conversación propia', async () => {
    const updatedMessages = [
      ...CONV_A.messages,
      { role: 'user', content: 'Pregunta adicional', timestamp: '2026-06-01T11:00:00Z' },
    ]
    mockPrisma.agentConversation.findFirst.mockResolvedValue(CONV_A)
    mockPrisma.agentConversation.update.mockResolvedValue({
      ...CONV_A,
      messages: updatedMessages,
    })

    const app = buildApp(COMPANY_A, USER_A)
    const response = await app.inject({
      method: 'PATCH',
      url: `/ai/conversations/${CONV_A.id}`,
      payload: { messages: updatedMessages },
    })

    expect(response.statusCode).toBe(200)
    expect(mockPrisma.agentConversation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: CONV_A.id },
        data: expect.objectContaining({ messages: updatedMessages }),
      })
    )
  })

  it('devuelve 401 si no hay userId', async () => {
    const app = buildApp(COMPANY_A, undefined)
    const response = await app.inject({
      method: 'PATCH',
      url: `/ai/conversations/${CONV_A.id}`,
      payload: { messages: CONV_A.messages },
    })
    expect(response.statusCode).toBe(401)
  })
})

// ─── GET /ai/conversations/:id ───────────────────────────────────────────────

describe('GET /ai/conversations/:id', () => {
  const mockPrisma = prisma as any

  beforeEach(() => vi.clearAllMocks())

  it('devuelve la conversación con mensajes', async () => {
    mockPrisma.agentConversation.findFirst.mockResolvedValue(CONV_A)

    const app = buildApp(COMPANY_A, USER_A)
    const response = await app.inject({
      method: 'GET',
      url: `/ai/conversations/${CONV_A.id}`,
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.id).toBe(CONV_A.id)
    expect(body.messages).toHaveLength(2)
  })

  it('devuelve 404 si la conversación no pertenece al usuario/empresa', async () => {
    mockPrisma.agentConversation.findFirst.mockResolvedValue(null)

    const app = buildApp(COMPANY_A, USER_A)
    const response = await app.inject({
      method: 'GET',
      url: `/ai/conversations/${CONV_B.id}`,
    })

    expect(response.statusCode).toBe(404)
  })
})

// ─── DELETE /ai/conversations/:id ────────────────────────────────────────────

describe('DELETE /ai/conversations/:id', () => {
  const mockPrisma = prisma as any

  beforeEach(() => vi.clearAllMocks())

  it('elimina conversación propia', async () => {
    mockPrisma.agentConversation.findFirst.mockResolvedValue(CONV_A)
    mockPrisma.agentConversation.delete.mockResolvedValue(CONV_A)

    const app = buildApp(COMPANY_A, USER_A)
    const response = await app.inject({
      method: 'DELETE',
      url: `/ai/conversations/${CONV_A.id}`,
    })

    expect(response.statusCode).toBe(204)
    expect(mockPrisma.agentConversation.delete).toHaveBeenCalledWith({ where: { id: CONV_A.id } })
  })

  it('devuelve 404 al intentar eliminar conversación de otra empresa', async () => {
    mockPrisma.agentConversation.findFirst.mockResolvedValue(null)

    const app = buildApp(COMPANY_A, USER_A)
    const response = await app.inject({
      method: 'DELETE',
      url: `/ai/conversations/${CONV_B.id}`,
    })

    expect(response.statusCode).toBe(404)
    expect(mockPrisma.agentConversation.delete).not.toHaveBeenCalled()
  })
})
