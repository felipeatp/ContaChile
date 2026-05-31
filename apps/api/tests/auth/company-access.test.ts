import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Fastify from 'fastify'
import tenantPlugin from '../../src/plugins/tenant'
import documentsRoute from '../../src/routes/dte/documents'

vi.mock('@contachile/db', () => ({
  prisma: {
    companyMembership: { findMany: vi.fn(), create: vi.fn() },
    company: { findUnique: vi.fn(), upsert: vi.fn(), findFirst: vi.fn() },
    document: { findMany: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn(), count: vi.fn(), create: vi.fn(), update: vi.fn() },
    auditLog: { create: vi.fn() },
  },
}))

vi.mock('@contachile/auth', () => ({
  auth: { api: { getSession: vi.fn() } },
  decryptCertPassword: vi.fn().mockReturnValue(''),
}))

vi.mock('@contachile/transport-sii', () => ({
  SIIClient: vi.fn().mockImplementation(() => ({ queryStatus: vi.fn() })),
}))
vi.mock('@contachile/transport-acepta', () => ({
  AceptaClient: vi.fn().mockImplementation(() => ({ queryStatus: vi.fn() })),
}))
vi.mock('../../src/lib/email', () => ({
  createEmailService: () => ({
    sendDocumentAccepted: vi.fn(),
    sendDocumentEmitted: vi.fn(),
    sendDocumentStuck: vi.fn(),
  }),
}))

import { prisma } from '@contachile/db'
import { auth } from '@contachile/auth'

const mockPrisma = prisma as any
const mockSession = auth.api.getSession as ReturnType<typeof vi.fn>

const savedBypassAuth = process.env.DEV_BYPASS_AUTH

function buildApp() {
  const app = Fastify()
  app.register(tenantPlugin)
  app.register(documentsRoute)
  return app
}

describe('T-4.2 — Autorización cross-tenant', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.DEV_BYPASS_AUTH
  })

  afterEach(() => {
    if (savedBypassAuth !== undefined) {
      process.env.DEV_BYPASS_AUTH = savedBypassAuth
    } else {
      delete process.env.DEV_BYPASS_AUTH
    }
  })

  it('request sin token en producción retorna 401', async () => {
    const savedEnv = process.env.NODE_ENV
    process.env.NODE_ENV = 'production'
    mockSession.mockResolvedValue(null)

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/documents' })

    expect(res.statusCode).toBe(401)
    process.env.NODE_ENV = savedEnv
  })

  it('query de documentos siempre usa el companyId del usuario autenticado', async () => {
    mockSession.mockResolvedValue({ user: { id: 'user-a', email: 'a@test.cl', name: 'A' } })
    mockPrisma.companyMembership.findMany.mockResolvedValue([
      { companyId: 'company-a', role: 'owner' },
    ])
    mockPrisma.document.findMany.mockResolvedValue([])
    mockPrisma.document.count.mockResolvedValue(0)

    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/documents',
      headers: {
        // Intento de leer documentos de otra empresa via header
        'x-active-company-id': 'company-b-hacker',
        cookie: 'better-auth.session_token=valid',
      },
    })

    expect(res.statusCode).toBe(200)
    // El companyId en la query DEBE ser company-a, no company-b-hacker
    expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: 'company-a' }),
      })
    )
  })

  it('usuario con múltiples empresas sólo accede a la empresa activa', async () => {
    mockSession.mockResolvedValue({ user: { id: 'user-multi', email: 'multi@test.cl', name: 'Multi' } })
    mockPrisma.companyMembership.findMany.mockResolvedValue([
      { companyId: 'company-1', role: 'owner' },
      { companyId: 'company-2', role: 'contador' },
    ])
    mockPrisma.document.findMany.mockResolvedValue([])
    mockPrisma.document.count.mockResolvedValue(0)

    const app = buildApp()

    // Solicitar con empresa activa = company-2
    const res = await app.inject({
      method: 'GET',
      url: '/documents',
      headers: {
        'x-active-company-id': 'company-2',
        cookie: 'better-auth.session_token=valid',
      },
    })

    expect(res.statusCode).toBe(200)
    expect(mockPrisma.document.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: 'company-2' }),
      })
    )
  })

  it('usuario con múltiples empresas no puede acceder a empresa no perteneciente', async () => {
    mockSession.mockResolvedValue({ user: { id: 'user-multi', email: 'multi@test.cl', name: 'Multi' } })
    mockPrisma.companyMembership.findMany.mockResolvedValue([
      { companyId: 'company-1', role: 'owner' },
      { companyId: 'company-2', role: 'contador' },
    ])
    mockPrisma.document.findMany.mockResolvedValue([])
    mockPrisma.document.count.mockResolvedValue(0)

    const app = buildApp()

    // Solicitar con empresa que no pertenece al usuario — debe caer al fallback
    const res = await app.inject({
      method: 'GET',
      url: '/documents',
      headers: {
        'x-active-company-id': 'company-evil-third-party',
        cookie: 'better-auth.session_token=valid',
      },
    })

    expect(res.statusCode).toBe(200)
    // Fallback a company-1 (primera membresía), NO a company-evil-third-party
    const callArgs = mockPrisma.document.findMany.mock.calls[0][0]
    expect(callArgs.where.companyId).not.toBe('company-evil-third-party')
    expect(['company-1', 'company-2']).toContain(callArgs.where.companyId)
  })

  it('DEV_BYPASS_AUTH=true en desarrollo permite acceso sin sesión', async () => {
    process.env.DEV_BYPASS_AUTH = 'true'
    mockSession.mockResolvedValue(null)
    mockPrisma.document.findMany.mockResolvedValue([])
    mockPrisma.document.count.mockResolvedValue(0)

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/documents' })

    expect(res.statusCode).toBe(200)
  })
})
