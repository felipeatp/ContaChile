import { describe, it, expect, vi, beforeEach } from "vitest"
import Fastify from "fastify"
import { prisma } from "@contachile/db"
import documentsRoute from "../../src/routes/dte/documents"

vi.mock("@contachile/db", () => ({
  prisma: {
    document: {
      count: vi.fn(),
      groupBy: vi.fn(),
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      aggregate: vi.fn(),
    },
  },
}))
vi.mock("../../src/queues/dte", () => ({ enqueuePollJob: vi.fn() }))
vi.mock("../../src/lib/email", () => ({
  createEmailService: () => ({ sendDocumentEmitted: vi.fn(), sendDocumentAccepted: vi.fn() }),
}))
vi.mock("../../src/lib/redis", () => ({
  createRedisClient: () => ({
    get: vi.fn().mockResolvedValue(null),
    setex: vi.fn().mockResolvedValue("OK"),
    quit: vi.fn().mockResolvedValue("OK"),
  }),
}))

async function buildApp() {
  const app = Fastify()
  app.addHook("onRequest", async (req) => { (req as any).companyId = "co-1" })
  await app.register(documentsRoute)
  return app
}

describe("GET /documents/stats", () => {
  beforeEach(() => vi.clearAllMocks())

  it("agrega totales y estados filtrando por companyId", async () => {
    ;(prisma.document.count as any)
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(3)  // emittedToday
    ;(prisma.document.groupBy as any).mockResolvedValue([
      { status: "PENDING", _count: { _all: 4 } },
      { status: "ACCEPTED", _count: { _all: 5 } },
      { status: "REJECTED", _count: { _all: 1 } },
    ])
    ;(prisma.document.findMany as any).mockResolvedValue([])
    ;(prisma.document.aggregate as any).mockResolvedValue({ _sum: { totalAmount: 0 } })

    const app = await buildApp()
    const res = await app.inject({ method: "GET", url: "/documents/stats" })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total).toBe(10)
    expect(body.emittedToday).toBe(3)
    expect(body.byStatus.pending).toBe(4)
    expect(body.byStatus.accepted).toBe(5)
    expect(body.byStatus.rejected).toBe(1)
    expect((prisma.document.groupBy as any).mock.calls[0][0].where.companyId).toBe("co-1")
    await app.close()
  })

  it("computa la serie mensual de 12 meses y la comparación YoY", async () => {
    const now = new Date()
    const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`
    ;(prisma.document.count as any)
      .mockResolvedValueOnce(2)
      .mockResolvedValueOnce(0)
    ;(prisma.document.groupBy as any).mockResolvedValue([])
    ;(prisma.document.findMany as any).mockResolvedValue([
      { emittedAt: new Date(), totalAmount: 119000 },
      { emittedAt: new Date(), totalAmount: 59500 },
    ])
    ;(prisma.document.aggregate as any)
      .mockResolvedValueOnce({ _sum: { totalAmount: 200000 } }) // current year
      .mockResolvedValueOnce({ _sum: { totalAmount: 100000 } }) // prev year

    const app = await buildApp()
    const res = await app.inject({ method: "GET", url: "/documents/stats" })
    const body = res.json()

    expect(body.monthly).toHaveLength(12)
    const thisMonth = body.monthly.find((m: any) => m.month === thisMonthKey)
    expect(thisMonth.count).toBe(2)
    expect(thisMonth.totalAmount).toBe(178500)
    expect(body.yoy.current).toBe(200000)
    expect(body.yoy.previous).toBe(100000)
    expect(body.yoy.deltaPct).toBe(100)
    await app.close()
  })

  it("sirve desde cache cuando Redis tiene hit", async () => {
    const redisModule = await import("../../src/lib/redis")
    const cached = JSON.stringify({
      total: 99,
      emittedToday: 0,
      byStatus: { pending: 0, accepted: 0, rejected: 0, failed: 0 },
      monthly: [],
      yoy: { current: 0, previous: 0, deltaPct: 0 },
    })
    vi.spyOn(redisModule, "createRedisClient").mockReturnValue({
      get: vi.fn().mockResolvedValue(cached),
      setex: vi.fn(),
      quit: vi.fn().mockResolvedValue("OK"),
    } as any)

    const app = await buildApp()
    const res = await app.inject({ method: "GET", url: "/documents/stats" })

    expect(res.json().total).toBe(99)
    expect(prisma.document.count).not.toHaveBeenCalled()
    await app.close()
  })
})
