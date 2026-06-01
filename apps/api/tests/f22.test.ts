import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import tenantPlugin from '../src/plugins/tenant'
import f22Route from '../src/routes/f22'

vi.mock('@contachile/db', () => ({
  prisma: {
    companyMembership: {
      findMany: vi.fn().mockResolvedValue([{ companyId: 'test-company', role: 'owner' }]),
    },
    company: { upsert: vi.fn(), findUnique: vi.fn(), findFirst: vi.fn() },
    document: {
      aggregate: vi.fn(),
      findMany: vi.fn().mockResolvedValue([]),
    },
    purchase: {
      aggregate: vi.fn(),
    },
  },
}))

vi.mock('@contachile/auth', () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue(null) } },
  decryptCertPassword: vi.fn(),
}))

import { prisma } from '@contachile/db'
const mockPrisma = prisma as any

describe('GET /f22', () => {
  beforeEach(() => {
    process.env.DEV_BYPASS_AUTH = 'true'
    mockPrisma.document.aggregate.mockReset()
    mockPrisma.purchase.aggregate.mockReset()
    mockPrisma.document.findMany.mockResolvedValue([])
  })

  it('retorna 400 cuando el año es inválido', async () => {
    const app = Fastify()
    app.register(tenantPlugin)
    app.register(f22Route)
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/f22?year=1990' })
    expect(res.statusCode).toBe(400)
    expect(JSON.parse(res.body).error).toContain('Ano invalido')
  })

  it('retorna zeros cuando no hay documentos', async () => {
    mockPrisma.document.aggregate.mockResolvedValue({ _sum: { totalAmount: null } })
    mockPrisma.purchase.aggregate.mockResolvedValue({ _sum: { totalAmount: null } })

    const app = Fastify()
    app.register(tenantPlugin)
    app.register(f22Route)
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/f22?year=2025' })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.year).toBe(2025)
    expect(body.summary.ingresos).toBe(0)
    expect(body.summary.rentaLiquida).toBe(0)
    expect(body.summary.impuesto).toBe(0)
    expect(body.summary.saldoPagar).toBe(0)
    expect(body.summary.saldoDevolver).toBe(0)
  })

  it('calcula renta liquida correctamente: ingresos - costos - gastos', async () => {
    // 10M ingresos, 3M costos, 2M gastos → renta liquida 5M
    mockPrisma.document.aggregate.mockResolvedValue({ _sum: { totalAmount: 10_000_000 } })
    mockPrisma.purchase.aggregate
      .mockResolvedValueOnce({ _sum: { totalAmount: 3_000_000 } })
      .mockResolvedValueOnce({ _sum: { totalAmount: 2_000_000 } })

    const app = Fastify()
    app.register(tenantPlugin)
    app.register(f22Route)
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/f22?year=2025' })

    expect(res.statusCode).toBe(200)
    const body = JSON.parse(res.body)
    expect(body.summary.ingresos).toBe(10_000_000)
    expect(body.summary.costos).toBe(3_000_000)
    expect(body.summary.gastos).toBe(2_000_000)
    expect(body.summary.rentaLiquida).toBe(5_000_000)
  })

  it('retorna las 8 lineas F22 con codigos SII correctos', async () => {
    mockPrisma.document.aggregate.mockResolvedValue({ _sum: { totalAmount: 0 } })
    mockPrisma.purchase.aggregate.mockResolvedValue({ _sum: { totalAmount: 0 } })

    const app = Fastify()
    app.register(tenantPlugin)
    app.register(f22Route)
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/f22?year=2025' })

    const body = JSON.parse(res.body)
    const codes = body.lines.map((l: { code: string }) => l.code)
    expect(codes).toContain('525') // Ingresos brutos
    expect(codes).toContain('585') // PPM pagado
    expect(codes).toContain('594') // Impuesto determinado
    expect(codes).toContain('595') // Saldo a pagar
    expect(codes).toContain('596') // Saldo a devolver
    expect(body.lines).toHaveLength(8)
  })

  it('usa el año actual cuando no se pasa parametro year', async () => {
    mockPrisma.document.aggregate.mockResolvedValue({ _sum: { totalAmount: 0 } })
    mockPrisma.purchase.aggregate.mockResolvedValue({ _sum: { totalAmount: 0 } })

    const app = Fastify()
    app.register(tenantPlugin)
    app.register(f22Route)
    await app.ready()

    const res = await app.inject({ method: 'GET', url: '/f22' })

    expect(res.statusCode).toBe(200)
    expect(JSON.parse(res.body).year).toBe(new Date().getFullYear())
  })
})
