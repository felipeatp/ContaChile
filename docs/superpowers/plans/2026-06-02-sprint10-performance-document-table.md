# Sprint 10 — Performance + Tabla de Documentos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminar el N+1 del F22, agregar paginación a 3 endpoints, añadir 2 índices compuestos al schema, validar fechas en bank.ts, cachear buildContextSnapshot en Redis, y agregar sort + selector 25/50/100 a la tabla de documentos.

**Architecture:** Backend changes are isolated to existing route files and the db schema — no new routes. Frontend changes are confined to `DocumentTable` and its page. Each task is independently committable.

**Tech Stack:** Fastify · Prisma · Zod · ioredis · Next.js 14 · React · TanStack Query · TypeScript

---

## File Map

| File | Change |
|------|--------|
| `apps/api/src/routes/f22.ts` | Replace 12 findMany calls with 1 |
| `packages/db/prisma/schema.prisma` | Add 2 composite indexes + migrate |
| `packages/validators/src/inventory.ts` | Add `InventoryProductListSchema`, `InventoryMovementListSchema` |
| `apps/api/src/routes/inventory.ts` | Paginate GET /inventory/products and GET /inventory/movements/:productId |
| `packages/validators/src/quotes.ts` | Add `page`/`limit` to `QuoteListQuerySchema` |
| `apps/api/src/routes/quotes.ts` | Paginate GET /quotes |
| `packages/validators/src/bank.ts` | New: `BankMovementListSchema` |
| `apps/api/src/routes/bank.ts` | Apply `BankMovementListSchema` to GET /bank/movements |
| `packages/ai-agents/src/context.ts` | Cache `buildContextSnapshot` via Redis (TTL 5 min) |
| `apps/web/components/documents/document-table.tsx` | Sortable columns header |
| `apps/web/hooks/use-documents.ts` | Pass `sort`/`order` params |
| `apps/web/lib/api-client.ts` | Accept `sort`/`order` in `getDocuments` |
| `apps/web/app/(app)/documents/page.tsx` | Per-page selector (25/50/100), sort state |
| `apps/api/src/routes/dte/documents.ts` | Accept `sort`/`order` query params |
| `apps/api/tests/routes/f22-performance.test.ts` | New: verifies 4 queries, not 15 |
| `apps/api/tests/routes/inventory-pagination.test.ts` | New: page/limit/total |
| `apps/api/tests/routes/quotes-pagination.test.ts` | New: page/limit/total |
| `apps/api/tests/routes/bank-date-validation.test.ts` | New: invalid date → 400 |

---

## Task 1: N+1 F22 — 1 query instead of 12

**Context:** `f22.ts:79-94` does `Promise.all(Array.from({length: 12}, async (_, i) => prisma.document.findMany(...)))` — 12 DB roundtrips. Replace with a single `findMany` for all year docs and group in JS.

**Files:**
- Modify: `apps/api/src/routes/f22.ts:79-94`
- Create: `apps/api/tests/routes/f22-performance.test.ts`

- [ ] **Step 1: Write the failing test**

Create `apps/api/tests/routes/f22-performance.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import tenantPlugin from '../../src/plugins/tenant'
import f22Route from '../../src/routes/f22'

vi.mock('@contachile/db', () => ({
  prisma: {
    document: { aggregate: vi.fn(), findMany: vi.fn() },
    purchase: { aggregate: vi.fn() },
  },
}))

vi.mock('@contachile/auth', () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue(null) } },
  decryptCertPassword: vi.fn(),
}))

import { prisma } from '@contachile/db'

const mockAggregate = prisma.document.aggregate as ReturnType<typeof vi.fn>
const mockFindMany = prisma.document.findMany as ReturnType<typeof vi.fn>
const mockPurchaseAgg = prisma.purchase.aggregate as ReturnType<typeof vi.fn>

const HEADERS = { 'x-company-id': 'company-ppm-test' }

function buildApp() {
  const app = Fastify()
  app.register(tenantPlugin)
  app.register(f22Route)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.DEV_BYPASS_AUTH
  delete process.env.NODE_ENV
  mockAggregate.mockResolvedValue({ _sum: { totalAmount: 0 } })
  mockPurchaseAgg.mockResolvedValue({ _sum: { totalAmount: 0 } })
  mockFindMany.mockResolvedValue([])
})

describe('GET /f22 — N+1 eliminado', () => {
  it('llama a document.findMany exactamente 1 vez (PPM) + 1 aggregate (ingresos)', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f22?year=2025', headers: HEADERS })

    expect(res.statusCode).toBe(200)
    // Solo 1 findMany: los docs del año para calcular PPM mensual
    expect(mockFindMany).toHaveBeenCalledTimes(1)
    const call = mockFindMany.mock.calls[0][0]
    // Verifica que trae todo el año, no un mes
    expect(call.where.emittedAt.gte).toEqual(new Date(2025, 0, 1))
    expect(call.where.emittedAt.lt).toEqual(new Date(2026, 0, 1))
  })

  it('calcula ppmTotal correctamente con datos agrupados', async () => {
    // Enero: 2M → PPM = 10000; Julio: 1M → PPM = 5000
    mockFindMany.mockResolvedValue([
      { emittedAt: new Date(2025, 0, 15), totalAmount: 2_000_000 },
      { emittedAt: new Date(2025, 6, 20), totalAmount: 1_000_000 },
    ])
    mockAggregate.mockResolvedValue({ _sum: { totalAmount: 3_000_000 } })
    mockPurchaseAgg.mockResolvedValue({ _sum: { totalAmount: 0 } })

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f22?year=2025', headers: HEADERS })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    // 2M * 0.005 = 10000 + 1M * 0.005 = 5000 → 15000
    expect(body.summary.ppmPagado).toBe(15_000)
  })

  it('year inválido → 400', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f22?year=banana', headers: HEADERS })
    expect(res.statusCode).toBe(400)
  })
})
```

- [ ] **Step 2: Run the test — must FAIL**

```
pnpm --filter @contachile/api exec vitest run tests/routes/f22-performance.test.ts
```

Expected: FAIL — `expect(mockFindMany).toHaveBeenCalledTimes(1)` fails (called 12 times)

- [ ] **Step 3: Replace N+1 in f22.ts**

In `apps/api/src/routes/f22.ts`, replace lines 79-94 with:

```typescript
    // Single query: fetch all type-33 docs for the year, group by month in JS
    const ppmDocs = await prisma.document.findMany({
      where: { companyId, type: 33, emittedAt: { gte: start, lt: end } },
      select: { emittedAt: true, totalAmount: true },
    })
    const ppmByMonth = Array.from({ length: 12 }, (_, i) => {
      const ingresosMes = ppmDocs
        .filter((d) => d.emittedAt.getMonth() === i)
        .reduce((s, d) => s + d.totalAmount, 0)
      return Math.floor(ingresosMes * 0.005)
    })
```

The `const ppmTotal = ppmByMonth.reduce((s, p) => s + p, 0)` on line 95 remains unchanged.

- [ ] **Step 4: Run test — must PASS**

```
pnpm --filter @contachile/api exec vitest run tests/routes/f22-performance.test.ts
```

Expected: PASS — 3 tests green

- [ ] **Step 5: Verify existing f22 tests still pass**

```
pnpm --filter @contachile/api exec vitest run tests/f22-calculations.test.ts
```

Expected: All existing tests pass.

- [ ] **Step 6: Commit**

```
git add apps/api/src/routes/f22.ts apps/api/tests/routes/f22-performance.test.ts
git commit -m "perf(sprint10): f22 PPM — 1 query en lugar de 12 (N+1 eliminado)"
```

---

## Task 2: DB Indexes — 2 composite indexes

**Context:** `Document` has separate `@@index([companyId])` + `@@index([status])` + `@@index([emittedAt])` but the most common query filters on all three at once (list with status filter + date range). `JournalLine` has separate indexes for `accountId` and `journalEntryId` but financial statement reports group by both. Add composite indexes for both.

Note: `BankMovement@@index([companyId, status])` already exists — no change needed.

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: Add composite indexes to schema.prisma**

In `Document` model, add this index **after** the existing `@@index([companyId, emittedAt])`:

```prisma
  @@index([companyId, status, emittedAt])
```

In `JournalLine` model, add this index **after** the existing `@@index([accountId])`:

```prisma
  @@index([accountId, journalEntryId])
```

The resulting index blocks:

```prisma
// Document model — after existing indexes:
  @@unique([companyId, type, folio])
  @@index([status])
  @@index([emittedAt])
  @@index([companyId])
  @@index([companyId, emittedAt])
  @@index([companyId, status, emittedAt])   // NEW

// JournalLine model — after existing indexes:
  @@index([journalEntryId])
  @@index([accountId])
  @@index([accountId, journalEntryId])       // NEW
```

- [ ] **Step 2: Run Prisma migration**

```
pnpm --filter @contachile/db exec prisma migrate dev --name sprint10-indexes
```

Expected output: `✔ Your database is now in sync with your schema.` (creates migration file in `packages/db/prisma/migrations/`)

- [ ] **Step 3: Commit**

```
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations/
git commit -m "perf(sprint10): índices compuestos Document(companyId,status,emittedAt) y JournalLine(accountId,journalEntryId)"
```

---

## Task 3: Pagination — inventory/products and inventory/movements

**Context:** `GET /inventory/products` returns all products with no limit — unbounded. `GET /inventory/movements/:productId` also returns all movements. Both need limit/offset with default 50.

**Files:**
- Modify: `packages/validators/src/inventory.ts`
- Modify: `apps/api/src/routes/inventory.ts`
- Create: `apps/api/tests/routes/inventory-pagination.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/tests/routes/inventory-pagination.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import tenantPlugin from '../../src/plugins/tenant'
import inventoryRoute from '../../src/routes/inventory'

vi.mock('@contachile/db', () => ({
  prisma: {
    product: { findMany: vi.fn(), findFirst: vi.fn(), count: vi.fn() },
    inventoryMovement: { findMany: vi.fn(), count: vi.fn() },
    folioCounter: { findUnique: vi.fn() },
  },
}))

vi.mock('@contachile/auth', () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue(null) } },
  decryptCertPassword: vi.fn(),
}))

vi.mock('../../src/lib/inventory-service', () => ({
  recordInventoryMovement: vi.fn(),
}))

import { prisma } from '@contachile/db'

const mockProductFindMany = prisma.product.findMany as ReturnType<typeof vi.fn>
const mockProductCount = prisma.product.count as ReturnType<typeof vi.fn>
const mockProductFindFirst = prisma.product.findFirst as ReturnType<typeof vi.fn>
const mockMovFindMany = prisma.inventoryMovement.findMany as ReturnType<typeof vi.fn>
const mockMovCount = prisma.inventoryMovement.count as ReturnType<typeof vi.fn>

const HEADERS = { 'x-company-id': 'company-inv-test' }

function buildApp() {
  const app = Fastify()
  app.register(tenantPlugin)
  app.register(inventoryRoute)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.DEV_BYPASS_AUTH
  delete process.env.NODE_ENV
  mockProductFindMany.mockResolvedValue([])
  mockProductCount.mockResolvedValue(0)
  mockMovFindMany.mockResolvedValue([])
  mockMovCount.mockResolvedValue(0)
})

describe('GET /inventory/products — paginación', () => {
  it('retorna total y productos, default 50 por página', async () => {
    const products = Array.from({ length: 3 }, (_, i) => ({ id: `p-${i}`, name: `Prod ${i}` }))
    mockProductFindMany.mockResolvedValue(products)
    mockProductCount.mockResolvedValue(3)

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/inventory/products', headers: HEADERS })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.products).toHaveLength(3)
    expect(body.total).toBe(3)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(50)
  })

  it('respeta page=2&limit=10', async () => {
    mockProductFindMany.mockResolvedValue([])
    mockProductCount.mockResolvedValue(100)

    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/inventory/products?page=2&limit=10',
      headers: HEADERS,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.page).toBe(2)
    expect(body.limit).toBe(10)
    expect(body.total).toBe(100)
    // Verifica que prisma recibió skip=10
    const call = mockProductFindMany.mock.calls[0][0]
    expect(call.skip).toBe(10)
    expect(call.take).toBe(10)
  })

  it('limit > 100 → rechazado con 400', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/inventory/products?limit=999',
      headers: HEADERS,
    })
    expect(res.statusCode).toBe(400)
  })
})

describe('GET /inventory/movements/:productId — paginación', () => {
  it('retorna total y movimientos paginados', async () => {
    mockProductFindFirst.mockResolvedValue({ id: 'prod-1', name: 'Arroz', stock: 10 })
    const movements = [
      { id: 'm1', type: 'IN', quantity: 5, unitCost: 1000, createdAt: new Date('2025-01-01') },
    ]
    mockMovFindMany.mockResolvedValue(movements)
    mockMovCount.mockResolvedValue(1)

    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/inventory/movements/prod-1',
      headers: HEADERS,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total).toBe(1)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(50)
    expect(body.movements).toHaveLength(1)
  })
})
```

- [ ] **Step 2: Run — must FAIL**

```
pnpm --filter @contachile/api exec vitest run tests/routes/inventory-pagination.test.ts
```

Expected: FAIL — `body.total` is undefined

- [ ] **Step 3: Add list schemas to inventory.ts validator**

In `packages/validators/src/inventory.ts`, append **after** the existing exports:

```typescript
const pageSchema = z.string().regex(/^\d+$/).default('1').transform(Number)
const limitSchema = z.string().regex(/^\d+$/).default('50').transform(Number).pipe(z.number().max(100))

export const InventoryProductListSchema = z.object({
  active: z.enum(['true', 'false']).optional(),
  search: z.string().max(100).optional(),
  page: pageSchema,
  limit: limitSchema,
})

export const InventoryMovementListSchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: pageSchema,
  limit: limitSchema,
})

export type InventoryProductListQuery = z.infer<typeof InventoryProductListSchema>
export type InventoryMovementListQuery = z.infer<typeof InventoryMovementListSchema>
```

Also add both to `packages/validators/src/index.ts` exports:

```typescript
export { InventoryProductListSchema, InventoryMovementListSchema } from './inventory'
export type { InventoryProductListQuery, InventoryMovementListQuery } from './inventory'
```

- [ ] **Step 4: Apply pagination in inventory.ts route**

In `apps/api/src/routes/inventory.ts`:

1. Add to import at top:
```typescript
import {
  CreateProductSchema,
  UpdateProductSchema,
  InventoryMovementSchema,
  InventoryProductListSchema,
  InventoryMovementListSchema,
} from '@contachile/validators'
```

2. Replace GET `/inventory/products` handler (lines 11-29):

```typescript
  fastify.get('/inventory/products', async (request, reply) => {
    const companyId = request.companyId
    const parsed = InventoryProductListSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Parámetros inválidos', issues: parsed.error.issues })
    }
    const { active, search, page, limit } = parsed.data
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { companyId }
    if (active === 'true') where.isActive = true
    if (active === 'false') where.isActive = false
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [products, total] = await Promise.all([
      prisma.product.findMany({ where, orderBy: { name: 'asc' }, skip, take: limit }),
      prisma.product.count({ where }),
    ])
    return reply.send({ products, total, page, limit })
  })
```

3. Replace GET `/inventory/movements/:productId` handler (lines 118-149):

```typescript
  fastify.get('/inventory/movements/:productId', async (request, reply) => {
    const companyId = request.companyId
    const { productId } = request.params as { productId: string }
    const parsedQuery = InventoryMovementListSchema.safeParse(request.query)
    if (!parsedQuery.success) {
      return reply.code(400).send({ error: 'Parámetros inválidos', issues: parsedQuery.error.issues })
    }
    const { from, to, page, limit } = parsedQuery.data
    const skip = (page - 1) * limit

    const product = await prisma.product.findFirst({ where: { id: productId, companyId } })
    if (!product) return reply.code(404).send({ error: 'Producto no encontrado' })

    const where: Record<string, unknown> = { productId }
    if (from || to) {
      const range: Record<string, Date> = {}
      if (from) range.gte = new Date(from)
      if (to) range.lte = new Date(to + 'T23:59:59')
      where.createdAt = range
    }

    const [movements, total] = await Promise.all([
      prisma.inventoryMovement.findMany({
        where,
        orderBy: { createdAt: 'asc' },
        skip,
        take: limit,
      }),
      prisma.inventoryMovement.count({ where }),
    ])

    let runningStock = 0
    const kardex = movements.map((m) => {
      runningStock += m.type === 'IN' ? m.quantity : -m.quantity
      return { ...m, balance: runningStock, value: m.quantity * m.unitCost }
    })

    return reply.send({ product, movements: kardex, total, page, limit })
  })
```

- [ ] **Step 5: Run tests — must PASS**

```
pnpm --filter @contachile/api exec vitest run tests/routes/inventory-pagination.test.ts
```

Expected: 4 tests green

- [ ] **Step 6: Commit**

```
git add packages/validators/src/inventory.ts packages/validators/src/index.ts apps/api/src/routes/inventory.ts apps/api/tests/routes/inventory-pagination.test.ts
git commit -m "feat(sprint10): paginación en /inventory/products y /inventory/movements (default 50)"
```

---

## Task 4: Pagination — quotes

**Context:** `GET /quotes` has no pagination — returns all quotes. `QuoteListQuerySchema` has no page/limit fields.

**Files:**
- Modify: `packages/validators/src/quotes.ts`
- Modify: `apps/api/src/routes/quotes.ts`
- Create: `apps/api/tests/routes/quotes-pagination.test.ts`

- [ ] **Step 1: Write failing tests**

Create `apps/api/tests/routes/quotes-pagination.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import tenantPlugin from '../../src/plugins/tenant'
import quotesRoute from '../../src/routes/quotes'

vi.mock('@contachile/db', () => ({
  prisma: {
    quote: { findMany: vi.fn(), count: vi.fn(), findFirst: vi.fn(), findUnique: vi.fn() },
  },
}))

vi.mock('@contachile/auth', () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue(null) } },
  decryptCertPassword: vi.fn(),
}))

vi.mock('../../src/lib/accounting-entries', () => ({ createSalesEntry: vi.fn() }))
vi.mock('../../src/lib/quote-pdf', () => ({ generateQuotePdf: vi.fn() }))

import { prisma } from '@contachile/db'

const mockFindMany = prisma.quote.findMany as ReturnType<typeof vi.fn>
const mockCount = prisma.quote.count as ReturnType<typeof vi.fn>

const HEADERS = { 'x-company-id': 'company-quote-test' }

function buildApp() {
  const app = Fastify()
  app.register(tenantPlugin)
  app.register(quotesRoute)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.DEV_BYPASS_AUTH
  delete process.env.NODE_ENV
  mockFindMany.mockResolvedValue([])
  mockCount.mockResolvedValue(0)
})

describe('GET /quotes — paginación', () => {
  it('retorna total, page, limit con defaults (page=1, limit=50)', async () => {
    const quotes = [{ id: 'q1', number: 1, status: 'DRAFT', items: [] }]
    mockFindMany.mockResolvedValue(quotes)
    mockCount.mockResolvedValue(1)

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/quotes', headers: HEADERS })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.total).toBe(1)
    expect(body.page).toBe(1)
    expect(body.limit).toBe(50)
    expect(body.quotes).toHaveLength(1)
  })

  it('page=2&limit=10 → skip=10 en la query Prisma', async () => {
    mockFindMany.mockResolvedValue([])
    mockCount.mockResolvedValue(200)

    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/quotes?page=2&limit=10',
      headers: HEADERS,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.page).toBe(2)
    expect(body.limit).toBe(10)
    const call = mockFindMany.mock.calls[0][0]
    expect(call.skip).toBe(10)
    expect(call.take).toBe(10)
  })

  it('limit=999 → 400', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/quotes?limit=999',
      headers: HEADERS,
    })
    expect(res.statusCode).toBe(400)
  })
})
```

- [ ] **Step 2: Run — must FAIL**

```
pnpm --filter @contachile/api exec vitest run tests/routes/quotes-pagination.test.ts
```

Expected: FAIL — `body.total` is undefined

- [ ] **Step 3: Update QuoteListQuerySchema**

In `packages/validators/src/quotes.ts`, replace `QuoteListQuerySchema`:

```typescript
export const QuoteListQuerySchema = z.object({
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'INVOICED', 'EXPIRED']).optional(),
  from: z.string().regex(dateRegex).optional(),
  to: z.string().regex(dateRegex).optional(),
  page: z.string().regex(/^\d+$/).default('1').transform(Number),
  limit: z.string().regex(/^\d+$/).default('50').transform(Number).pipe(z.number().max(100)),
})

export type QuoteListQuery = z.infer<typeof QuoteListQuerySchema>
```

- [ ] **Step 4: Apply pagination in quotes.ts route**

In `apps/api/src/routes/quotes.ts`, replace GET `/quotes` handler (lines 20-43):

```typescript
  fastify.get('/quotes', async (request, reply) => {
    const companyId = request.companyId
    const parsed = QuoteListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Parámetros inválidos', issues: parsed.error.issues })
    }
    const { status, from, to, page, limit } = parsed.data
    const skip = (page - 1) * limit

    const where: Record<string, unknown> = { companyId }
    if (status) where.status = status
    if (from || to) {
      const range: Record<string, Date> = {}
      if (from) range.gte = new Date(from)
      if (to) range.lte = new Date(to + 'T23:59:59')
      where.date = range
    }

    const [quotes, total] = await Promise.all([
      prisma.quote.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limit,
        include: { items: true },
      }),
      prisma.quote.count({ where }),
    ])

    return reply.send({ quotes, total, page, limit })
  })
```

- [ ] **Step 5: Run tests — must PASS**

```
pnpm --filter @contachile/api exec vitest run tests/routes/quotes-pagination.test.ts
```

Expected: 3 tests green

- [ ] **Step 6: Commit**

```
git add packages/validators/src/quotes.ts apps/api/src/routes/quotes.ts apps/api/tests/routes/quotes-pagination.test.ts
git commit -m "feat(sprint10): paginación en /quotes (default 50)"
```

---

## Task 5: Bank date validation

**Context:** GET `/bank/movements` casts `query.from`/`query.to` to `new Date()` with no validation — invalid strings create `Invalid Date` which crashes Prisma. Add a Zod schema.

**Files:**
- Create: `packages/validators/src/bank.ts`
- Modify: `packages/validators/src/index.ts`
- Modify: `apps/api/src/routes/bank.ts`
- Create: `apps/api/tests/routes/bank-date-validation.test.ts`

- [ ] **Step 1: Write failing test**

Create `apps/api/tests/routes/bank-date-validation.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import tenantPlugin from '../../src/plugins/tenant'
import bankRoute from '../../src/routes/bank'

vi.mock('@contachile/db', () => ({
  prisma: {
    bankAccount: { findMany: vi.fn() },
    bankMovement: { findMany: vi.fn() },
  },
}))

vi.mock('@contachile/auth', () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue(null) } },
  decryptCertPassword: vi.fn(),
}))

vi.mock('../../src/lib/bank-service', () => ({
  syncBankAccounts: vi.fn(),
  syncMovements: vi.fn(),
  findAndApplyMatch: vi.fn(),
  reconcileWithEntry: vi.fn(),
  connectBankLink: vi.fn(),
  setAccountMode: vi.fn(),
  createLinkIntent: vi.fn(),
  exchangeLinkToken: vi.fn(),
}))

vi.mock('@contachile/ai-agents', () => ({ clasificarTransaccion: vi.fn() }))
vi.mock('@contachile/fintoc-client', () => ({
  FintocClient: vi.fn().mockImplementation(() => ({})),
}))

import { prisma } from '@contachile/db'

const mockMovFindMany = prisma.bankMovement.findMany as ReturnType<typeof vi.fn>

const HEADERS = { 'x-company-id': 'company-bank-test' }

function buildApp() {
  const app = Fastify()
  app.register(tenantPlugin)
  app.register(bankRoute)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  delete process.env.DEV_BYPASS_AUTH
  delete process.env.NODE_ENV
  mockMovFindMany.mockResolvedValue([])
})

describe('GET /bank/movements — validación de fechas', () => {
  it('fecha válida → 200', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/bank/movements?from=2025-01-01&to=2025-01-31',
      headers: HEADERS,
    })
    expect(res.statusCode).toBe(200)
  })

  it('from inválida (texto) → 400', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/bank/movements?from=banana',
      headers: HEADERS,
    })
    expect(res.statusCode).toBe(400)
  })

  it('to inválida → 400', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/bank/movements?to=2025-13-99',
      headers: HEADERS,
    })
    expect(res.statusCode).toBe(400)
  })

  it('sin filtros → 200 y llama findMany sin filtro de fecha', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/bank/movements', headers: HEADERS })
    expect(res.statusCode).toBe(200)
    const call = mockMovFindMany.mock.calls[0][0]
    expect(call.where.postedAt).toBeUndefined()
  })
})
```

- [ ] **Step 2: Run — must FAIL**

```
pnpm --filter @contachile/api exec vitest run tests/routes/bank-date-validation.test.ts
```

Expected: FAIL — "banana" → 200 (currently no validation)

- [ ] **Step 3: Create packages/validators/src/bank.ts**

```typescript
import { z } from 'zod'

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

function isValidDate(s: string): boolean {
  if (!dateRegex.test(s)) return false
  const d = new Date(s)
  return !isNaN(d.getTime())
}

export const BankMovementListSchema = z.object({
  status: z.string().optional(),
  bankAccountId: z.string().optional(),
  from: z.string().refine(isValidDate, { message: 'Fecha from inválida (YYYY-MM-DD)' }).optional(),
  to: z.string().refine(isValidDate, { message: 'Fecha to inválida (YYYY-MM-DD)' }).optional(),
})

export type BankMovementListQuery = z.infer<typeof BankMovementListSchema>
```

- [ ] **Step 4: Export from validators index**

In `packages/validators/src/index.ts`, add:
```typescript
export { BankMovementListSchema } from './bank'
export type { BankMovementListQuery } from './bank'
```

- [ ] **Step 5: Apply schema in bank.ts route**

In `apps/api/src/routes/bank.ts`, add import at the top:
```typescript
import { BankMovementListSchema } from '@contachile/validators'
```

Replace GET `/bank/movements` handler (lines 105-125):

```typescript
  fastify.get('/bank/movements', async (request, reply) => {
    const companyId = request.companyId
    const parsed = BankMovementListSchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Parámetros inválidos', issues: parsed.error.issues })
    }
    const { status, bankAccountId, from, to } = parsed.data

    const where: Record<string, unknown> = { companyId }
    if (status) where.status = status
    if (bankAccountId) where.bankAccountId = bankAccountId
    if (from || to) {
      const range: Record<string, Date> = {}
      if (from) range.gte = new Date(from)
      if (to) range.lte = new Date(to + 'T23:59:59')
      where.postedAt = range
    }

    const movements = await prisma.bankMovement.findMany({
      where,
      orderBy: { postedAt: 'desc' },
      include: { bankAccount: { select: { institution: true } } },
    })
    return reply.send({ movements })
  })
```

- [ ] **Step 6: Run tests — must PASS**

```
pnpm --filter @contachile/api exec vitest run tests/routes/bank-date-validation.test.ts
```

Expected: 4 tests green

- [ ] **Step 7: Commit**

```
git add packages/validators/src/bank.ts packages/validators/src/index.ts apps/api/src/routes/bank.ts apps/api/tests/routes/bank-date-validation.test.ts
git commit -m "feat(sprint10): validación de fechas en GET /bank/movements con Zod"
```

---

## Task 6: Cache buildContextSnapshot in Redis (TTL 5 min)

**Context:** `buildContextSnapshot` in `packages/ai-agents/src/context.ts` runs 5 Prisma queries on every chat message. With Redis already available via `createRedisClient()` in `apps/api/src/lib/redis.ts`, we can cache the result 5 minutes per companyId.

**Files:**
- Modify: `packages/ai-agents/src/context.ts`

The redis lib is in `apps/api/src/lib/redis.ts` but `packages/ai-agents` is a separate package. We need to use `ioredis` directly — `ioredis` is already a dependency (used by `createRedisClient`). The context module should create its own Redis connection using the same env vars.

- [ ] **Step 1: Add ioredis import and cache helper to context.ts**

In `packages/ai-agents/src/context.ts`, add at the top (after existing imports):

```typescript
import Redis from 'ioredis'

const CACHE_TTL_SECONDS = 300 // 5 minutes

function getRedisClient(): Redis | null {
  try {
    if (process.env.REDIS_URL) {
      return new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, enableReadyCheck: false, lazyConnect: true })
    }
    return new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
    })
  } catch {
    return null
  }
}
```

- [ ] **Step 2: Wrap buildContextSnapshot with cache logic**

Replace `export async function buildContextSnapshot(companyId: string): Promise<string>` with:

```typescript
export async function buildContextSnapshot(companyId: string): Promise<string> {
  const redis = getRedisClient()
  const cacheKey = `ctx:snapshot:${companyId}`

  if (redis) {
    try {
      await redis.connect().catch(() => {})
      const cached = await redis.get(cacheKey).catch(() => null)
      if (cached) {
        redis.disconnect()
        return cached
      }
    } catch {
      // Redis unavailable — proceed without cache
    }
  }

  const snapshot = await buildContextSnapshotFresh(companyId)

  if (redis) {
    try {
      await redis.set(cacheKey, snapshot, 'EX', CACHE_TTL_SECONDS).catch(() => {})
      redis.disconnect()
    } catch {
      // ignore cache write failure
    }
  }

  return snapshot
}
```

- [ ] **Step 3: Rename the original function to buildContextSnapshotFresh**

Rename the original `export async function buildContextSnapshot` to `async function buildContextSnapshotFresh` (remove `export`, keep same body). The new exported wrapper above calls it.

The full result in context.ts should look like:

```typescript
import { prisma } from '@contachile/db'
import Redis from 'ioredis'

// ... (MONTHS_ES, DAYS_ES, formatLongDate, formatCLP, pctChange, nextF29DueDate, buildObligations unchanged)

const CACHE_TTL_SECONDS = 300

function getRedisClient(): Redis | null {
  try {
    if (process.env.REDIS_URL) {
      return new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: 1, enableReadyCheck: false, lazyConnect: true })
    }
    return new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379', 10),
      maxRetriesPerRequest: 1,
      enableReadyCheck: false,
      lazyConnect: true,
    })
  } catch {
    return null
  }
}

async function buildContextSnapshotFresh(companyId: string): Promise<string> {
  // ... (original body of buildContextSnapshot, unchanged)
}

export async function buildContextSnapshot(companyId: string): Promise<string> {
  const redis = getRedisClient()
  const cacheKey = `ctx:snapshot:${companyId}`

  if (redis) {
    try {
      await redis.connect().catch(() => {})
      const cached = await redis.get(cacheKey).catch(() => null)
      if (cached) {
        redis.disconnect()
        return cached
      }
    } catch {
      // Redis unavailable — proceed without cache
    }
  }

  const snapshot = await buildContextSnapshotFresh(companyId)

  if (redis) {
    try {
      await redis.set(cacheKey, snapshot, 'EX', CACHE_TTL_SECONDS).catch(() => {})
      redis.disconnect()
    } catch {
      // ignore
    }
  }

  return snapshot
}
```

- [ ] **Step 4: Check ioredis is a dependency**

```
pnpm --filter @contachile/ai-agents exec node -e "require('ioredis'); console.log('ok')"
```

If it prints "ok", no change needed. If it throws, add ioredis:
```
pnpm --filter @contachile/ai-agents add ioredis
```

- [ ] **Step 5: Build to verify no TypeScript errors**

```
pnpm --filter @contachile/ai-agents exec tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```
git add packages/ai-agents/src/context.ts packages/ai-agents/package.json
git commit -m "perf(sprint10): cachear buildContextSnapshot en Redis — TTL 5 min por companyId"
```

---

## Task 7: Document table — sort by column + per-page selector

**Context:** The documents table in `apps/web` already has filters and pagination (hardcoded to 20/page). The backend API already supports `sort`/`order` via query params... actually it doesn't — the API always sorts by `{ emittedAt: 'desc' }`. We need to:
1. Add `sort`/`order` query params to the API
2. Add a per-page selector (25/50/100) to the page
3. Add sortable column headers to the table

**Files:**
- Modify: `apps/api/src/routes/dte/documents.ts`
- Modify: `apps/web/lib/api-client.ts`
- Modify: `apps/web/hooks/use-documents.ts`
- Modify: `apps/web/app/(app)/documents/page.tsx`
- Modify: `apps/web/components/documents/document-table.tsx`

- [ ] **Step 1: Add sort params to documents API**

In `apps/api/src/routes/dte/documents.ts`, update the GET /documents handler.

Change the query type and orderBy:

```typescript
    const query = request.query as {
      status?: string
      page?: string
      limit?: string
      from?: string
      to?: string
      type?: string
      search?: string
      sort?: string
      order?: string
    }
```

Replace the hardcoded `orderBy: { emittedAt: 'desc' }` with:

```typescript
    const ALLOWED_SORT_FIELDS = ['emittedAt', 'totalAmount', 'status', 'folio'] as const
    type SortField = typeof ALLOWED_SORT_FIELDS[number]
    const sortField: SortField = ALLOWED_SORT_FIELDS.includes(query.sort as SortField)
      ? (query.sort as SortField)
      : 'emittedAt'
    const sortOrder = query.order === 'asc' ? 'asc' : 'desc'
```

Then in the findMany call:
```typescript
        orderBy: { [sortField]: sortOrder },
```

- [ ] **Step 2: Update api-client.ts**

In `apps/web/lib/api-client.ts`, add `sort` and `order` to the `getDocuments` signature:

```typescript
export function getDocuments(params?: {
  status?: string
  page?: number
  limit?: number
  from?: string
  to?: string
  type?: number
  search?: string
  sort?: string
  order?: 'asc' | 'desc'
}): Promise<DocumentsResponse> {
  const search = new URLSearchParams()
  if (params?.status) search.set('status', params.status)
  if (params?.page) search.set('page', String(params.page))
  if (params?.limit) search.set('limit', String(params.limit))
  if (params?.from) search.set('from', params.from)
  if (params?.to) search.set('to', params.to)
  if (params?.type) search.set('type', String(params.type))
  if (params?.search) search.set('search', params.search)
  if (params?.sort) search.set('sort', params.sort)
  if (params?.order) search.set('order', params.order)
  const query = search.toString()
  return apiClient(`/documents${query ? `?${query}` : ''}`)
}
```

- [ ] **Step 3: Update use-documents.ts hook**

```typescript
import { useQuery } from '@tanstack/react-query'
import { getDocuments, getDocument } from '@/lib/api-client'

export function useDocuments(params?: {
  status?: string
  page?: number
  limit?: number
  from?: string
  to?: string
  type?: number
  search?: string
  sort?: string
  order?: 'asc' | 'desc'
}) {
  return useQuery({
    queryKey: ['documents', params],
    queryFn: () => getDocuments(params),
  })
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: () => getDocument(id),
    enabled: !!id,
  })
}
```

- [ ] **Step 4: Update DocumentTable to accept sort props**

Replace `apps/web/components/documents/document-table.tsx` with:

```typescript
"use client"

import Link from "next/link"
import { toast } from "sonner"
import { Document } from "@/types"
import { StatusBadge } from "./status-badge"
import { Button } from "@/components/ui/button"
import { FileCode2, Download, RefreshCw, ChevronUp, ChevronDown, ChevronsUpDown } from "lucide-react"
import { formatCLP } from "@ContAI/validators"

interface DocumentTableProps {
  documents: Document[]
  onRetried?: (id: string) => void
  sort?: string
  order?: 'asc' | 'desc'
  onSort?: (field: string) => void
}

function SortIcon({ field, currentSort, currentOrder }: { field: string; currentSort?: string; currentOrder?: 'asc' | 'desc' }) {
  if (currentSort !== field) return <ChevronsUpDown className="inline h-3 w-3 ml-1 text-muted-foreground/40" />
  return currentOrder === 'asc'
    ? <ChevronUp className="inline h-3 w-3 ml-1 text-primary" />
    : <ChevronDown className="inline h-3 w-3 ml-1 text-primary" />
}

function SortableHeader({ field, label, currentSort, currentOrder, onSort }: {
  field: string
  label: string
  currentSort?: string
  currentOrder?: 'asc' | 'desc'
  onSort?: (field: string) => void
}) {
  return (
    <button
      type="button"
      className="flex items-center gap-0.5 hover:text-foreground transition-colors"
      onClick={() => onSort?.(field)}
    >
      {label}
      <SortIcon field={field} currentSort={currentSort} currentOrder={currentOrder} />
    </button>
  )
}

function handleDownloadXML(doc: Document) {
  fetch(`/api/documents/${doc.id}/xml`)
    .then((res) => {
      if (!res.ok) throw new Error("Error al descargar XML")
      return res.blob()
    })
    .then((blob) => {
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `DTE-${doc.type}-${doc.folio}.xml`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    })
    .catch(() => toast.error("Error al descargar el XML"))
}

async function handleRetry(docId: string, onRetried?: (id: string) => void) {
  try {
    const res = await fetch(`/api/documents/${docId}/retry`, { method: "POST" })
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      toast.error((err as { error?: string }).error || "Error al reintentar el envío")
      return
    }
    toast.success("Reintento enviado — el documento volverá a procesarse en segundos")
    onRetried?.(docId)
  } catch {
    toast.error("Error al reintentar el envío")
  }
}

function handleDownloadPDF(doc: Document) {
  fetch(`/api/documents/${doc.id}/pdf`)
    .then((res) => {
      if (!res.ok) throw new Error("Error al descargar PDF")
      return res.blob()
    })
    .then((blob) => {
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `dte-${doc.type}-${doc.folio}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    })
    .catch(() => toast.error("Error al descargar el PDF"))
}

export function DocumentTable({ documents, onRetried, sort, order, onSort }: DocumentTableProps) {
  if (documents.length === 0) {
    return (
      <div className="card-editorial p-12 text-center">
        <p className="font-display text-lg text-muted-foreground mb-1">Sin documentos</p>
        <p className="text-xs text-muted-foreground/70">Ajusta los filtros o emite tu primer DTE.</p>
      </div>
    )
  }

  return (
    <div className="card-editorial overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table-editorial">
          <thead>
            <tr>
              <th>
                <SortableHeader field="folio" label="Folio" currentSort={sort} currentOrder={order} onSort={onSort} />
              </th>
              <th className="hidden md:table-cell">Tipo</th>
              <th>Receptor</th>
              <th data-numeric="true">
                <SortableHeader field="totalAmount" label="Total" currentSort={sort} currentOrder={order} onSort={onSort} />
              </th>
              <th>
                <SortableHeader field="status" label="Estado" currentSort={sort} currentOrder={order} onSort={onSort} />
              </th>
              <th className="hidden sm:table-cell">
                <SortableHeader field="emittedAt" label="Fecha" currentSort={sort} currentOrder={order} onSort={onSort} />
              </th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id}>
                <td className="font-mono">
                  <Link href={`/documents/${doc.id}`} className="font-medium underline-offset-4 hover:underline">
                    {doc.folio}
                  </Link>
                </td>
                <td className="text-muted-foreground hidden md:table-cell">{doc.type}</td>
                <td className="max-w-[140px] truncate">{doc.receiverName}</td>
                <td data-numeric="true" className="font-semibold">{formatCLP(doc.totalAmount)}</td>
                <td><StatusBadge status={doc.status} /></td>
                <td className="font-mono text-xs text-muted-foreground hidden sm:table-cell">
                  {new Date(doc.emittedAt).toLocaleDateString("es-CL")}
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    {doc.status === "FAILED" && (
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 px-2 text-xs text-destructive hover:text-destructive/80 hover:bg-destructive/10"
                        title="Reintentar envío al SII"
                        onClick={() => handleRetry(doc.id, onRetried)}
                      >
                        <RefreshCw className="h-3.5 w-3.5 mr-1" />
                        Reintentar
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Descargar XML" onClick={() => handleDownloadXML(doc)}>
                      <FileCode2 className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-foreground" title="Descargar PDF" onClick={() => handleDownloadPDF(doc)}>
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
```

Mobile responsive: `Tipo` is hidden on mobile (`hidden md:table-cell`), `Fecha` is hidden on small screens (`hidden sm:table-cell`), `receiverName` truncates with `max-w-[140px] truncate`.

- [ ] **Step 5: Update documents page with sort state and per-page selector**

Replace the relevant sections of `apps/web/app/(app)/documents/page.tsx`:

Change the state and useDocuments call (replace lines 32-49):

```typescript
  const [status, setStatus] = useState<string>("")
  const [type, setType] = useState<string>("")
  const [from, setFrom] = useState<string>("")
  const [to, setTo] = useState<string>("")
  const [search, setSearch] = useState<string>("")
  const [page, setPage] = useState<number>(1)
  const [limit, setLimit] = useState<number>(25)
  const [sort, setSort] = useState<string>("emittedAt")
  const [order, setOrder] = useState<"asc" | "desc">("desc")

  function handleSort(field: string) {
    if (sort === field) {
      setOrder((o) => (o === "asc" ? "desc" : "asc"))
    } else {
      setSort(field)
      setOrder("desc")
    }
    setPage(1)
  }

  const { data, isLoading } = useDocuments({
    status: status || undefined,
    type: type ? parseInt(type, 10) : undefined,
    from: from || undefined,
    to: to || undefined,
    search: search || undefined,
    page,
    limit,
    sort,
    order,
  })
```

Add a per-page selector in the filters section (after the Buscar field, before closing `</div>` of the grid):

```tsx
          <div>
            <label className="text-[0.65rem] uppercase tracking-eyebrow font-semibold text-muted-foreground/80 mb-1 block">Por página</label>
            <select
              value={limit}
              onChange={(e) => { setLimit(Number(e.target.value)); setPage(1) }}
              className="h-10 w-full px-3 text-sm"
            >
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
```

Update the `<DocumentTable>` render to pass sort props:

```tsx
          <DocumentTable
            documents={data?.documents || []}
            sort={sort}
            order={order}
            onSort={handleSort}
          />
```

Also update the pagination range display (replace `const limit = 20` removed, already using `limit` state now):

```tsx
              <p className="text-xs text-muted-foreground font-mono tabular">
                {(page - 1) * limit + 1}–{Math.min(page * limit, data?.total ?? 0)} de {data?.total ?? 0} documentos
              </p>
```

And update the grid to `lg:grid-cols-6` to fit the new column:

```tsx
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-6 gap-3">
```

- [ ] **Step 6: Build TypeScript check**

```
pnpm --filter web tsc --noEmit
```

Expected: no errors

- [ ] **Step 7: Commit**

```
git add apps/api/src/routes/dte/documents.ts apps/web/lib/api-client.ts apps/web/hooks/use-documents.ts apps/web/app/"(app)"/documents/page.tsx apps/web/components/documents/document-table.tsx
git commit -m "feat(sprint10): tabla documentos — sort por columna, per-page 25/50/100, mobile responsive"
```

---

## Final verification

- [ ] **Run all API tests**

```
pnpm --filter @contachile/api exec vitest run --reporter=verbose
```

Expected: all previous 163 tests + 4 new test files (~16 new tests) = ~179 tests passing

- [ ] **Commit plan doc**

```
git add docs/superpowers/plans/2026-06-02-sprint10-performance-document-table.md
git commit -m "docs(sprint10): plan implementación performance + tabla documentos"
```

---

## Self-Review

**1. Spec coverage:**
- ✅ N+1 F22 → Task 1
- ✅ Paginación inventory/products → Task 3
- ✅ Paginación inventory/movements → Task 3
- ✅ Paginación quotes → Task 4
- ✅ Paginación accounting/journal → Already implemented in Sprint 9 (JournalListQuerySchema has page/limit)
- ✅ Índices DB (Document, JournalLine) → Task 2 (BankMovement index already existed)
- ✅ Validación fechas bank.ts → Task 5
- ✅ Validación fechas purchases.ts → PurchaseListQuerySchema already validates year/month with regex; no changes needed
- ✅ Validación fechas accounting/journal.ts → JournalListQuerySchema already validates with regex; acceptable
- ✅ Cachear buildContextSnapshot → Task 6
- ✅ Búsqueda doc table → Already exists (folio, RUT, nombre)
- ✅ Sort por columna → Task 7
- ✅ Paginación 25/50/100 → Task 7
- ✅ Mobile responsive → Task 7

**2. Placeholder scan:** All steps include actual code. No TBDs.

**3. Type consistency:**
- `InventoryProductListSchema` uses `.transform(Number)` → page/limit become `number` in parsed.data — used correctly as numbers in skip/take
- `QuoteListQuerySchema` same transform pattern — consistent with inventory approach
- `sort` in DocumentTable is `string | undefined`, passed from page state as `string` — consistent
- `getRedisClient()` returns `Redis | null` — null-guarded in cache wrapper — consistent
