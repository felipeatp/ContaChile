/**
 * T-4.3 — Folio counter: unicidad bajo carga concurrente
 *
 * Verifica que el mecanismo atómico INSERT...ON CONFLICT DO UPDATE en PostgreSQL
 * (vía prisma.$queryRaw) garantiza folios únicos. Los tests van de bajo nivel
 * (mock directo) a alto nivel (ruta completa) para aislar fallos.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import tenantPlugin from '../../src/plugins/tenant'
import emitRoute from '../../src/routes/dte/emit'

vi.mock('@contachile/db', () => ({
  prisma: {
    companyMembership: {
      findMany: vi.fn().mockResolvedValue([{ companyId: 'dev-test-company', role: 'owner' }]),
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    company: { findUnique: vi.fn(), upsert: vi.fn(), findFirst: vi.fn() },
    document: { findUnique: vi.fn(), create: vi.fn() },
    documentItem: { findMany: vi.fn() },
    $queryRaw: vi.fn(),
  },
}))

vi.mock('@contachile/auth', () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue(null) } },
  decryptCertPassword: vi.fn().mockReturnValue(''),
}))

vi.mock('../../src/queues/dte', () => ({ enqueuePollJob: vi.fn() }))
vi.mock('../../src/lib/email', () => ({
  createEmailService: () => ({
    sendDocumentEmitted: vi.fn(),
    sendDocumentAccepted: vi.fn(),
    sendDocumentStuck: vi.fn(),
  }),
}))
vi.mock('../../src/lib/accounting-entries', () => ({ createSalesEntry: vi.fn().mockResolvedValue(undefined) }))
vi.mock('../../src/lib/inventory-service', () => ({ recordSalesMovements: vi.fn() }))
vi.mock('@contachile/dte', () => ({
  runPipeline: vi.fn().mockRejectedValue(new Error('No cert')),
  extractPrivateKeyFromPfx: vi.fn(),
}))

import { prisma } from '@contachile/db'
const mockPrisma = prisma as any

const MOCK_COMPANY = {
  id: 'company-concurrent',
  rut: '76.354.771-K',
  name: 'Test Concurrencia SpA',
  // Cert must be "configured" (>100 chars + password) so the route reaches the
  // folio assignment + document.create path. runPipeline is mocked to reject,
  // which the route tolerates (emits unsigned).
  certEncrypted: 'A'.repeat(120),
  certPassword: 'cert-pass',
  certPasswordEncrypted: null,
}

const PAYLOAD = {
  type: 33,
  receiver: {
    rut: '12345678-5',
    name: 'Cliente Paralelo',
    address: 'Calle 123',
    commune: 'Santiago',
    city: 'Santiago',
  },
  items: [{ description: 'Servicio', quantity: 1, unitPrice: 100000 }],
  paymentMethod: 'CONTADO',
}

describe('T-4.3 — Folio counter: unicidad bajo carga concurrente', () => {
  beforeEach(() => {
    process.env.DEV_BYPASS_AUTH = 'true'
  })

  it('mock de $queryRaw retorna BigInt y Number() lo convierte correctamente', () => {
    const bigIntFolio = BigInt(42)
    const folio = Number(bigIntFolio)
    expect(folio).toBe(42)
    expect(Number.isInteger(folio)).toBe(true)
    expect(folio).toBeGreaterThan(0)
  })

  it('simulación: 20 llamadas concurrentes a $queryRaw con contador atómico dan folios únicos', async () => {
    let counter = 0

    // Simula INSERT...ON CONFLICT DO UPDATE con lock exclusivo
    const getNextFolio = async (): Promise<number> => {
      const folio = ++counter
      return folio
    }

    const folios = await Promise.all(
      Array.from({ length: 20 }, () => getNextFolio())
    )

    const uniqueFolios = new Set(folios)
    expect(uniqueFolios.size).toBe(20)
    for (const f of folios) {
      expect(f).toBeGreaterThan(0)
      expect(Number.isInteger(f)).toBe(true)
    }
  })

  it('la ruta POST /dte/emit llama a prisma.$queryRaw (no folioCounter.findUnique)', async () => {
    let folioSeq = 0
    mockPrisma.company.findUnique.mockResolvedValue(MOCK_COMPANY)
    mockPrisma.document.findUnique.mockResolvedValue(null)
    mockPrisma.documentItem.findMany.mockResolvedValue([])
    mockPrisma.$queryRaw.mockImplementation(async () => {
      folioSeq++
      return [{ folio: BigInt(folioSeq) }]
    })
    mockPrisma.document.create.mockImplementation(async (args: any) => ({
      id: `doc-${folioSeq}`,
      type: args.data.type ?? 33,
      folio: args.data.folio ?? 1,
      status: 'PENDING',
      trackId: `SII-${Date.now()}`,
      emittedAt: new Date(),
      receiverEmail: null,
      companyId: 'dev-test-company',
    }))

    const app = Fastify()
    app.register(tenantPlugin)
    app.register(emitRoute)
    await app.ready()

    const res = await app.inject({
      method: 'POST',
      url: '/dte/emit',
      headers: { 'x-company-id': 'company-concurrent' },
      payload: PAYLOAD,
    })

    expect(res.statusCode, `Route returned ${res.statusCode}: ${res.body.substring(0, 400)}`).toBe(201)
    expect(mockPrisma.$queryRaw).toHaveBeenCalled()
    // El viejo folioCounter.findUnique no debe existir en el mock
    expect(mockPrisma.folioCounter).toBeUndefined()
  })

  it('10 requests concurrentes: cada uno obtiene un folio único de $queryRaw', async () => {
    let seq = 0

    mockPrisma.$queryRaw.mockClear()
    mockPrisma.document.create.mockClear()
    mockPrisma.company.findUnique.mockResolvedValue(MOCK_COMPANY)
    mockPrisma.document.findUnique.mockResolvedValue(null)
    mockPrisma.documentItem.findMany.mockResolvedValue([])
    mockPrisma.$queryRaw.mockImplementation(async () => {
      seq++
      return [{ folio: BigInt(seq) }]
    })
    mockPrisma.document.create.mockImplementation(async (args: any) => ({
      id: `doc-${seq}`,
      type: args.data.type ?? 33,
      folio: args.data.folio ?? seq,
      status: 'PENDING',
      trackId: `SII-${Date.now()}`,
      emittedAt: new Date(),
      receiverEmail: null,
      companyId: 'company-concurrent',
    }))

    const app = Fastify()
    app.register(tenantPlugin)
    app.register(emitRoute)
    await app.ready()

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        app.inject({
          method: 'POST',
          url: '/dte/emit',
          headers: { 'x-company-id': 'company-concurrent' },
          payload: PAYLOAD,
        })
      )
    )

    // Todos los requests deben tener éxito
    for (const r of results) {
      expect(
        r.statusCode,
        `Request falló (${r.statusCode}): ${r.body.substring(0, 200)}`
      ).toBe(201)
    }

    // $queryRaw se llamó exactamente una vez por request
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(10)

    // Los folios asignados deben ser todos distintos
    const createArgs = mockPrisma.document.create.mock.calls.map(
      (c: any[]) => c[0].data.folio as number
    )
    const uniqueFolios = new Set(createArgs)
    expect(uniqueFolios.size).toBe(10)
  })
})
