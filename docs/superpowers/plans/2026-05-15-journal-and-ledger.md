# Libro Diario y Mayor — Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to ejecutar este plan tarea por tarea. Cada tarea termina con un commit. Marcar `- [x]` al avanzar.

**Goal:** Implementar el módulo de contabilidad general (Libro Diario y Libro Mayor) con asientos manuales y asientos automáticos desde DTE y Compras.

**Architecture (resumen):** Nuevos modelos Prisma `JournalEntry` + `JournalLine`. CRUD de asientos manuales y consulta del libro mayor en `apps/api/src/routes/accounting/`. Helper `lib/accounting-entries.ts` que se invoca al emitir DTE o registrar Compra. Páginas Next.js `/contabilidad/libro-diario` y `/contabilidad/mayor`.

**Tech Stack:** Prisma, Fastify, Next.js 14, Zod, shadcn/ui

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/db/prisma/schema.prisma` | Modify | Add `JournalEntry`, `JournalLine`; relación inversa en `Account` |
| `packages/validators/src/journal.ts` | Create | Zod schemas `JournalLineSchema`, `CreateJournalEntrySchema` |
| `packages/validators/src/index.ts` | Modify | Exportar nuevos schemas |
| `apps/api/src/lib/accounting-entries.ts` | Create | `createSalesEntry()` y `createPurchaseEntry()` helpers |
| `apps/api/src/routes/accounting/journal.ts` | Create | `GET/POST /accounting/journal`, `GET /accounting/journal/:id` |
| `apps/api/src/routes/accounting/ledger.ts` | Create | `GET /accounting/ledger/:accountId` |
| `apps/api/src/routes/dte/emit.ts` | Modify | Llamar `createSalesEntry(doc)` después de crear Document |
| `apps/api/src/routes/purchases.ts` | Modify | Llamar `createPurchaseEntry(purchase)` en POST y POST import-xml |
| `apps/api/src/index.ts` | Modify | Registrar `journalRoute` y `ledgerRoute` |
| `apps/web/app/api/accounting/journal/route.ts` | Create | Proxy GET/POST Next.js |
| `apps/web/app/api/accounting/journal/[id]/route.ts` | Create | Proxy GET detalle |
| `apps/web/app/api/accounting/ledger/[accountId]/route.ts` | Create | Proxy GET ledger |
| `apps/web/app/contabilidad/libro-diario/page.tsx` | Create | UI libro diario con formulario manual |
| `apps/web/app/contabilidad/mayor/page.tsx` | Create | UI libro mayor por cuenta |
| `apps/web/components/layout/sidebar.tsx` | Modify | Items "Libro Diario" y "Libro Mayor" |

---

### Task 1: Update Prisma schema

**Files:** `packages/db/prisma/schema.prisma`

- [ ] **Step 1:** Add `JournalEntry` y `JournalLine` al final del schema y agregar relación inversa en `Account`.

```prisma
model JournalEntry {
  id          String        @id @default(cuid())
  companyId   String
  date        DateTime
  description String
  reference   String?
  source      String        // 'manual' | 'dte' | 'purchase'
  sourceId    String?
  createdAt   DateTime      @default(now())
  lines       JournalLine[]

  @@index([companyId])
  @@index([date])
  @@index([source])
}

model JournalLine {
  id             String       @id @default(cuid())
  journalEntryId String
  accountId      String
  debit          Int          @default(0)
  credit         Int          @default(0)
  description    String?

  journalEntry   JournalEntry @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)
  account        Account      @relation(fields: [accountId], references: [id])

  @@index([journalEntryId])
  @@index([accountId])
}
```

En el model `Account` existente, agregar:

```prisma
lines       JournalLine[]
```

- [ ] **Step 2:** Regenerar Prisma Client:

```bash
pnpm --filter @contachile/db db:generate
```

- [ ] **Step 3:** Crear migración:

```bash
pnpm --filter @contachile/db exec prisma migrate dev --name add_journal_entries
```

Si falla por OneDrive/Windows o por entorno no interactivo, usar `prisma db push` como fallback:

```bash
pnpm --filter @contachile/db exec prisma db push
```

- [ ] **Step 4:** Commit:

```bash
git add packages/db/prisma/schema.prisma packages/db/prisma/migrations
git commit -m "feat(db): add JournalEntry and JournalLine models

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Add validators for journal

**Files:** `packages/validators/src/journal.ts`, `packages/validators/src/index.ts`

- [ ] **Step 1:** Crear `packages/validators/src/journal.ts`:

```typescript
import { z } from 'zod'

export const JournalLineSchema = z
  .object({
    accountId: z.string().cuid(),
    debit: z.number().int().min(0).default(0),
    credit: z.number().int().min(0).default(0),
    description: z.string().max(200).optional(),
  })
  .refine(
    (line) => (line.debit > 0) !== (line.credit > 0),
    { message: 'Cada línea debe tener débito o crédito (uno y solo uno)' }
  )

export const CreateJournalEntrySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    description: z.string().min(1).max(300),
    reference: z.string().max(100).optional(),
    lines: z.array(JournalLineSchema).min(2),
  })
  .refine(
    (entry) => {
      const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0)
      const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0)
      return totalDebit === totalCredit && totalDebit > 0
    },
    { message: 'El asiento no cuadra: la suma del debe debe ser igual a la del haber y mayor que cero' }
  )

export const JournalListQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  source: z.enum(['manual', 'dte', 'purchase']).optional(),
  page: z.string().default('1'),
  limit: z.string().default('20'),
})

export const LedgerQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
})

export type CreateJournalEntryInput = z.infer<typeof CreateJournalEntrySchema>
export type JournalListQuery = z.infer<typeof JournalListQuerySchema>
export type LedgerQuery = z.infer<typeof LedgerQuerySchema>
```

- [ ] **Step 2:** Exportar desde `packages/validators/src/index.ts`:

```typescript
export {
  JournalLineSchema,
  CreateJournalEntrySchema,
  JournalListQuerySchema,
  LedgerQuerySchema,
} from './journal'
export type {
  CreateJournalEntryInput,
  JournalListQuery,
  LedgerQuery,
} from './journal'
```

- [ ] **Step 3:** Build validators:

```bash
pnpm --filter @contachile/validators build
```

- [ ] **Step 4:** Commit:

```bash
git add packages/validators/src/journal.ts packages/validators/src/index.ts
git commit -m "feat(validators): add journal entry schemas with balance validation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Create accounting-entries helper

**Files:** `apps/api/src/lib/accounting-entries.ts`

- [ ] **Step 1:** Crear el helper con funciones `createSalesEntry` y `createPurchaseEntry`:

```typescript
import type { PrismaClient } from '@contachile/db'
import { prisma } from '@contachile/db'

const PUC = {
  CLIENTES: '1103',
  IVA_CREDITO: '1115',
  PROVEEDORES: '2101',
  IVA_DEBITO: '2111',
  INGRESOS_VENTAS: '4100',
  GASTOS_DIVERSOS: '5220',
}

const CATEGORY_TO_ACCOUNT_CODE: Record<string, string> = {
  personal: '5100',
  honorarios: '5101',
  arriendo: '5110',
  servicios_basicos: '5120',
  mantenimiento: '5130',
  viaje: '5140',
  marketing: '5150',
  oficina: '5160',
  seguros: '5200',
}

async function findAccountIds(
  companyId: string,
  codes: string[]
): Promise<Record<string, string> | null> {
  const accounts = await prisma.account.findMany({
    where: { companyId, code: { in: codes }, isActive: true },
    select: { id: true, code: true },
  })
  if (accounts.length !== codes.length) return null
  return Object.fromEntries(accounts.map((a) => [a.code, a.id]))
}

export async function createSalesEntry(doc: {
  id: string
  companyId: string
  folio: number
  type: number
  totalNet: number
  totalTax: number
  totalAmount: number
  emittedAt: Date
  receiverName: string
}, logger?: { warn: (data: object, msg: string) => void }) {
  const codes = [PUC.CLIENTES, PUC.INGRESOS_VENTAS, PUC.IVA_DEBITO]
  const ids = await findAccountIds(doc.companyId, codes)
  if (!ids) {
    logger?.warn(
      { docId: doc.id, missingCodes: codes },
      'Asiento automático omitido: cuentas PUC no encontradas'
    )
    return null
  }

  return prisma.journalEntry.create({
    data: {
      companyId: doc.companyId,
      date: doc.emittedAt,
      description: `Venta DTE ${doc.type} folio ${doc.folio} - ${doc.receiverName}`,
      reference: `${doc.type}-${doc.folio}`,
      source: 'dte',
      sourceId: doc.id,
      lines: {
        create: [
          { accountId: ids[PUC.CLIENTES], debit: doc.totalAmount, credit: 0 },
          { accountId: ids[PUC.INGRESOS_VENTAS], debit: 0, credit: doc.totalNet },
          { accountId: ids[PUC.IVA_DEBITO], debit: 0, credit: doc.totalTax },
        ],
      },
    },
  })
}

export async function createPurchaseEntry(purchase: {
  id: string
  companyId: string
  type: number
  folio: number
  date: Date
  netAmount: number
  taxAmount: number
  totalAmount: number
  category: string | null
  issuerName: string
}, logger?: { warn: (data: object, msg: string) => void }) {
  const gastoCode = (purchase.category && CATEGORY_TO_ACCOUNT_CODE[purchase.category]) || PUC.GASTOS_DIVERSOS

  const codes = [gastoCode, PUC.IVA_CREDITO, PUC.PROVEEDORES]
  const ids = await findAccountIds(purchase.companyId, codes)
  if (!ids) {
    logger?.warn(
      { purchaseId: purchase.id, missingCodes: codes },
      'Asiento automático omitido: cuentas PUC no encontradas'
    )
    return null
  }

  return prisma.journalEntry.create({
    data: {
      companyId: purchase.companyId,
      date: purchase.date,
      description: `Compra DTE ${purchase.type} folio ${purchase.folio} - ${purchase.issuerName}`,
      reference: `${purchase.type}-${purchase.folio}`,
      source: 'purchase',
      sourceId: purchase.id,
      lines: {
        create: [
          { accountId: ids[gastoCode], debit: purchase.netAmount, credit: 0 },
          { accountId: ids[PUC.IVA_CREDITO], debit: purchase.taxAmount, credit: 0 },
          { accountId: ids[PUC.PROVEEDORES], debit: 0, credit: purchase.totalAmount },
        ],
      },
    },
  })
}
```

- [ ] **Step 2:** Commit:

```bash
git add apps/api/src/lib/accounting-entries.ts
git commit -m "feat(api): add accounting entries helper for sales and purchases

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Create accounting routes

**Files:** `apps/api/src/routes/accounting/journal.ts`, `apps/api/src/routes/accounting/ledger.ts`

- [ ] **Step 1:** Crear `apps/api/src/routes/accounting/journal.ts`:

```typescript
import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import {
  CreateJournalEntrySchema,
  JournalListQuerySchema,
} from '@contachile/validators'

export default async function (fastify: FastifyInstance) {
  fastify.get('/accounting/journal', async (request, reply) => {
    const companyId = request.companyId
    const parsed = JournalListQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Parámetros inválidos', issues: parsed.error.issues })
    }
    const { from, to, source, page, limit } = parsed.data
    const pageNum = parseInt(page, 10)
    const limitNum = parseInt(limit, 10)
    const skip = (pageNum - 1) * limitNum

    const where: Record<string, unknown> = { companyId }
    if (from || to) {
      const dateFilter: Record<string, Date> = {}
      if (from) dateFilter.gte = new Date(from)
      if (to) dateFilter.lte = new Date(to + 'T23:59:59')
      where.date = dateFilter
    }
    if (source) where.source = source

    const [entries, total] = await Promise.all([
      prisma.journalEntry.findMany({
        where,
        orderBy: { date: 'desc' },
        skip,
        take: limitNum,
        include: {
          lines: {
            include: { account: { select: { code: true, name: true } } },
          },
        },
      }),
      prisma.journalEntry.count({ where }),
    ])

    return reply.send({ entries, total, page: pageNum, limit: limitNum })
  })

  fastify.get('/accounting/journal/:id', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }
    const entry = await prisma.journalEntry.findFirst({
      where: { id, companyId },
      include: {
        lines: {
          include: { account: { select: { code: true, name: true, type: true } } },
        },
      },
    })
    if (!entry) return reply.code(404).send({ error: 'Asiento no encontrado' })
    return reply.send(entry)
  })

  fastify.post('/accounting/journal', async (request, reply) => {
    const companyId = request.companyId
    const parsed = CreateJournalEntrySchema.safeParse(request.body)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Datos inválidos', issues: parsed.error.issues })
    }
    const data = parsed.data

    const accountIds = data.lines.map((l) => l.accountId)
    const accounts = await prisma.account.findMany({
      where: { id: { in: accountIds }, companyId },
      select: { id: true, isActive: true },
    })
    if (accounts.length !== new Set(accountIds).size) {
      return reply.code(400).send({ error: 'Una o más cuentas no existen' })
    }
    if (accounts.some((a) => !a.isActive)) {
      return reply.code(400).send({ error: 'Una o más cuentas están inactivas' })
    }

    const entry = await prisma.journalEntry.create({
      data: {
        companyId,
        date: new Date(data.date),
        description: data.description,
        reference: data.reference,
        source: 'manual',
        lines: {
          create: data.lines.map((l) => ({
            accountId: l.accountId,
            debit: l.debit,
            credit: l.credit,
            description: l.description,
          })),
        },
      },
      include: {
        lines: {
          include: { account: { select: { code: true, name: true } } },
        },
      },
    })

    return reply.code(201).send(entry)
  })
}
```

- [ ] **Step 2:** Crear `apps/api/src/routes/accounting/ledger.ts`:

```typescript
import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import { LedgerQuerySchema } from '@contachile/validators'

export default async function (fastify: FastifyInstance) {
  fastify.get('/accounting/ledger/:accountId', async (request, reply) => {
    const companyId = request.companyId
    const { accountId } = request.params as { accountId: string }
    const parsed = LedgerQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Parámetros inválidos', issues: parsed.error.issues })
    }
    const { from, to } = parsed.data

    const account = await prisma.account.findFirst({
      where: { id: accountId, companyId },
      select: { id: true, code: true, name: true, type: true },
    })
    if (!account) return reply.code(404).send({ error: 'Cuenta no encontrada' })

    const where: Record<string, unknown> = { accountId }
    const entryWhere: Record<string, unknown> = { companyId }
    if (from || to) {
      const dateFilter: Record<string, Date> = {}
      if (from) dateFilter.gte = new Date(from)
      if (to) dateFilter.lte = new Date(to + 'T23:59:59')
      entryWhere.date = dateFilter
    }
    where.journalEntry = entryWhere

    const lines = await prisma.journalLine.findMany({
      where,
      orderBy: { journalEntry: { date: 'asc' } },
      include: {
        journalEntry: {
          select: { id: true, date: true, description: true, reference: true, source: true },
        },
      },
    })

    let balance = 0
    const movements = lines.map((l) => {
      balance += l.debit - l.credit
      return {
        id: l.id,
        date: l.journalEntry.date,
        description: l.description || l.journalEntry.description,
        reference: l.journalEntry.reference,
        source: l.journalEntry.source,
        debit: l.debit,
        credit: l.credit,
        balance,
      }
    })

    const totals = lines.reduce(
      (acc, l) => ({ debit: acc.debit + l.debit, credit: acc.credit + l.credit }),
      { debit: 0, credit: 0 }
    )

    return reply.send({
      account,
      movements,
      totals: { ...totals, balance },
    })
  })
}
```

- [ ] **Step 3:** Registrar rutas en `apps/api/src/index.ts`:

```typescript
import journalRoute from './routes/accounting/journal'
import ledgerRoute from './routes/accounting/ledger'
```

Y después de `accountsRoute`:

```typescript
app.register(journalRoute)
app.register(ledgerRoute)
```

- [ ] **Step 4:** Build API:

```bash
pnpm --filter api build
```

- [ ] **Step 5:** Commit:

```bash
git add apps/api/src/routes/accounting apps/api/src/index.ts
git commit -m "feat(api): add journal and ledger CRUD endpoints

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Wire automatic entries into emit and purchases

**Files:** `apps/api/src/routes/dte/emit.ts`, `apps/api/src/routes/purchases.ts`

- [ ] **Step 1:** En `emit.ts`, importar:

```typescript
import { createSalesEntry } from '../../lib/accounting-entries'
```

Después de `const doc = await prisma.document.create(...)` (línea ~143) y antes de `const emailService = ...`:

```typescript
await createSalesEntry(doc, fastify.log).catch((err) => {
  fastify.log.warn({ err: err.message, docId: doc.id }, 'createSalesEntry falló — DTE emitido sin asiento')
})
```

- [ ] **Step 2:** En `purchases.ts`, importar:

```typescript
import { createPurchaseEntry } from '../lib/accounting-entries'
```

En `POST /purchases`, después de `const purchase = await prisma.purchase.create(...)` y antes del `return`:

```typescript
await createPurchaseEntry(purchase, fastify.log).catch((err) => {
  fastify.log.warn({ err: err.message, purchaseId: purchase.id }, 'createPurchaseEntry falló')
})
```

Repetir en `POST /purchases/import-xml` después de crear el `purchase`.

- [ ] **Step 3:** Build API:

```bash
pnpm --filter api build
```

- [ ] **Step 4:** Commit:

```bash
git add apps/api/src/routes/dte/emit.ts apps/api/src/routes/purchases.ts
git commit -m "feat(api): create journal entries automatically on DTE emit and purchase

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Create Next.js proxies

**Files:** `apps/web/app/api/accounting/journal/route.ts`, `apps/web/app/api/accounting/journal/[id]/route.ts`, `apps/web/app/api/accounting/ledger/[accountId]/route.ts`

- [ ] **Step 1:** Crear `apps/web/app/api/accounting/journal/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.toString()
  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = {}
  if (cookie) extraHeaders['Cookie'] = cookie
  const { status, data } = await apiFetch(`/accounting/journal${query ? `?${query}` : ''}`, {
    method: 'GET',
    headers: extraHeaders,
  })
  return NextResponse.json(data, { status })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = { 'Content-Type': 'application/json' }
  if (cookie) extraHeaders['Cookie'] = cookie
  const { status, data } = await apiFetch('/accounting/journal', {
    method: 'POST',
    headers: extraHeaders,
    body: JSON.stringify(body),
  })
  return NextResponse.json(data, { status })
}
```

- [ ] **Step 2:** Crear `apps/web/app/api/accounting/journal/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = {}
  if (cookie) extraHeaders['Cookie'] = cookie
  const { status, data } = await apiFetch(`/accounting/journal/${id}`, {
    method: 'GET',
    headers: extraHeaders,
  })
  return NextResponse.json(data, { status })
}
```

- [ ] **Step 3:** Crear `apps/web/app/api/accounting/ledger/[accountId]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function GET(req: NextRequest, { params }: { params: Promise<{ accountId: string }> }) {
  const { accountId } = await params
  const { searchParams } = new URL(req.url)
  const query = searchParams.toString()
  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = {}
  if (cookie) extraHeaders['Cookie'] = cookie
  const { status, data } = await apiFetch(`/accounting/ledger/${accountId}${query ? `?${query}` : ''}`, {
    method: 'GET',
    headers: extraHeaders,
  })
  return NextResponse.json(data, { status })
}
```

- [ ] **Step 4:** Commit:

```bash
git add apps/web/app/api/accounting
git commit -m "feat(web): add accounting API proxies (journal, ledger)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Create Libro Diario page

**Files:** `apps/web/app/contabilidad/libro-diario/page.tsx`

- [ ] **Step 1:** Crear página con tabla, filtros, modal de nuevo asiento manual:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Plus, X } from 'lucide-react'

type Line = {
  id: string
  accountId: string
  debit: number
  credit: number
  description?: string | null
  account: { code: string; name: string }
}

type Entry = {
  id: string
  date: string
  description: string
  reference?: string | null
  source: 'manual' | 'dte' | 'purchase'
  lines: Line[]
}

type Account = { id: string; code: string; name: string; isActive: boolean }

export default function LibroDiarioPage() {
  const [entries, setEntries] = useState<Entry[]>([])
  const [loading, setLoading] = useState(false)
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [source, setSource] = useState<'' | 'manual' | 'dte' | 'purchase'>('')
  const [formOpen, setFormOpen] = useState(false)
  const [detailEntry, setDetailEntry] = useState<Entry | null>(null)
  const [accounts, setAccounts] = useState<Account[]>([])

  const fetchEntries = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (from) params.set('from', from)
      if (to) params.set('to', to)
      if (source) params.set('source', source)
      const res = await fetch(`/api/accounting/journal?${params}`)
      const data = await res.json()
      setEntries(data.entries || [])
    } finally {
      setLoading(false)
    }
  }

  const fetchAccounts = async () => {
    const res = await fetch('/api/accounts?active=true')
    const data = await res.json()
    setAccounts(data.accounts || [])
  }

  useEffect(() => {
    fetchEntries()
    fetchAccounts()
  }, [])

  useEffect(() => {
    fetchEntries()
  }, [from, to, source])

  const format = (n: number) => `$${n.toLocaleString('es-CL')}`
  const sourceLabel = { manual: 'Manual', dte: 'DTE', purchase: 'Compra' }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Libro Diario</h1>
          <p className="text-sm text-muted-foreground">Asientos contables cronológicos.</p>
        </div>
        <Button onClick={() => setFormOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Nuevo asiento manual
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Filtros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <select
            value={source}
            onChange={(e) => setSource(e.target.value as '' | 'manual' | 'dte' | 'purchase')}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todas las fuentes</option>
            <option value="manual">Manual</option>
            <option value="dte">DTE</option>
            <option value="purchase">Compra</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Sin asientos en el período.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">Fecha</th>
                    <th className="text-left py-2 px-3">Descripción</th>
                    <th className="text-left py-2 px-3">Referencia</th>
                    <th className="text-left py-2 px-3">Fuente</th>
                    <th className="text-right py-2 px-3">Total</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => {
                    const total = e.lines.reduce((s, l) => s + l.debit, 0)
                    return (
                      <tr key={e.id} className="border-b last:border-0">
                        <td className="py-2 px-3">{new Date(e.date).toLocaleDateString('es-CL')}</td>
                        <td className="py-2 px-3">{e.description}</td>
                        <td className="py-2 px-3 font-mono text-xs">{e.reference || '—'}</td>
                        <td className="py-2 px-3">
                          <span className="text-xs rounded bg-muted px-2 py-0.5">{sourceLabel[e.source]}</span>
                        </td>
                        <td className="py-2 px-3 text-right font-mono">{format(total)}</td>
                        <td className="py-2 px-3 text-right">
                          <Button variant="ghost" size="sm" onClick={() => setDetailEntry(e)}>Ver</Button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {detailEntry && <EntryDetailModal entry={detailEntry} onClose={() => setDetailEntry(null)} />}
      {formOpen && (
        <ManualEntryForm
          accounts={accounts}
          onClose={() => setFormOpen(false)}
          onSaved={() => { setFormOpen(false); fetchEntries() }}
        />
      )}
    </div>
  )
}

function EntryDetailModal({ entry, onClose }: { entry: Entry; onClose: () => void }) {
  const format = (n: number) => `$${n.toLocaleString('es-CL')}`
  const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0)
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-lg max-w-3xl w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-semibold">Asiento — {new Date(entry.date).toLocaleDateString('es-CL')}</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="p-4 space-y-3">
          <div className="text-sm">
            <strong>Descripción:</strong> {entry.description}
          </div>
          {entry.reference && (
            <div className="text-sm"><strong>Referencia:</strong> {entry.reference}</div>
          )}
          <table className="w-full text-sm border rounded">
            <thead>
              <tr className="border-b bg-muted">
                <th className="text-left py-2 px-3">Código</th>
                <th className="text-left py-2 px-3">Cuenta</th>
                <th className="text-right py-2 px-3">Debe</th>
                <th className="text-right py-2 px-3">Haber</th>
              </tr>
            </thead>
            <tbody>
              {entry.lines.map((l) => (
                <tr key={l.id} className="border-b last:border-0">
                  <td className="py-2 px-3 font-mono">{l.account.code}</td>
                  <td className="py-2 px-3">{l.account.name}</td>
                  <td className="py-2 px-3 text-right font-mono">{l.debit ? format(l.debit) : '—'}</td>
                  <td className="py-2 px-3 text-right font-mono">{l.credit ? format(l.credit) : '—'}</td>
                </tr>
              ))}
              <tr className="font-semibold bg-muted/50">
                <td colSpan={2} className="py-2 px-3 text-right">Totales</td>
                <td className="py-2 px-3 text-right font-mono">{format(totalDebit)}</td>
                <td className="py-2 px-3 text-right font-mono">{format(totalCredit)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function ManualEntryForm({
  accounts,
  onClose,
  onSaved,
}: {
  accounts: Account[]
  onClose: () => void
  onSaved: () => void
}) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [description, setDescription] = useState('')
  const [reference, setReference] = useState('')
  const [lines, setLines] = useState([
    { accountId: '', debit: 0, credit: 0 },
    { accountId: '', debit: 0, credit: 0 },
  ])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const totalDebit = lines.reduce((s, l) => s + (l.debit || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (l.credit || 0), 0)
  const diff = totalDebit - totalCredit
  const balanced = totalDebit === totalCredit && totalDebit > 0

  const addLine = () => setLines([...lines, { accountId: '', debit: 0, credit: 0 }])
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i))
  const updateLine = (i: number, field: 'accountId' | 'debit' | 'credit', value: string | number) => {
    setLines(lines.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)))
  }

  const submit = async () => {
    setError(null)
    if (!balanced) { setError('El asiento no cuadra'); return }
    if (!description.trim()) { setError('Falta la descripción'); return }
    if (lines.some((l) => !l.accountId)) { setError('Selecciona cuenta en todas las líneas'); return }
    if (lines.some((l) => (l.debit > 0) === (l.credit > 0))) {
      setError('Cada línea debe tener debe o haber (uno y solo uno)')
      return
    }

    setSaving(true)
    try {
      const res = await fetch('/api/accounting/journal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          date,
          description,
          reference: reference || undefined,
          lines: lines.map((l) => ({
            accountId: l.accountId,
            debit: Number(l.debit) || 0,
            credit: Number(l.credit) || 0,
          })),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || 'Error al guardar')
        return
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  const format = (n: number) => `$${n.toLocaleString('es-CL')}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-background rounded-lg max-w-4xl w-full max-h-[90vh] overflow-auto">
        <div className="flex items-center justify-between border-b p-4">
          <h2 className="font-semibold">Nuevo asiento manual</h2>
          <Button variant="ghost" size="icon" onClick={onClose}><X className="h-4 w-4" /></Button>
        </div>
        <div className="p-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium">Fecha</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Referencia (opcional)</label>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              />
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Descripción</label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="mt-1 h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            />
          </div>

          <table className="w-full text-sm border rounded">
            <thead>
              <tr className="border-b bg-muted">
                <th className="text-left py-2 px-3">Cuenta</th>
                <th className="text-right py-2 px-3">Debe</th>
                <th className="text-right py-2 px-3">Haber</th>
                <th className="py-2 px-3"></th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <tr key={i} className="border-b">
                  <td className="py-2 px-3">
                    <select
                      value={l.accountId}
                      onChange={(e) => updateLine(i, 'accountId', e.target.value)}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">— Seleccionar —</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
                      ))}
                    </select>
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min={0}
                      value={l.debit}
                      onChange={(e) => updateLine(i, 'debit', Number(e.target.value))}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-right"
                    />
                  </td>
                  <td className="py-2 px-3">
                    <input
                      type="number"
                      min={0}
                      value={l.credit}
                      onChange={(e) => updateLine(i, 'credit', Number(e.target.value))}
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm text-right"
                    />
                  </td>
                  <td className="py-2 px-3 text-right">
                    {lines.length > 2 && (
                      <Button variant="ghost" size="sm" onClick={() => removeLine(i)}>
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </td>
                </tr>
              ))}
              <tr className={`font-semibold ${balanced ? 'bg-green-50' : 'bg-yellow-50'}`}>
                <td className="py-2 px-3">Totales {balanced ? '✓ cuadra' : `(diferencia ${format(Math.abs(diff))})`}</td>
                <td className="py-2 px-3 text-right font-mono">{format(totalDebit)}</td>
                <td className="py-2 px-3 text-right font-mono">{format(totalCredit)}</td>
                <td></td>
              </tr>
            </tbody>
          </table>

          <Button variant="outline" size="sm" onClick={addLine}>
            <Plus className="mr-1 h-3 w-3" /> Agregar línea
          </Button>

          {error && (
            <div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">{error}</div>
          )}

          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>Cancelar</Button>
            <Button onClick={submit} disabled={saving || !balanced}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar asiento'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2:** Commit:

```bash
git add apps/web/app/contabilidad/libro-diario
git commit -m "feat(web): add libro diario page with manual entry form

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Create Libro Mayor page

**Files:** `apps/web/app/contabilidad/mayor/page.tsx`

- [ ] **Step 1:** Crear página con selector de cuenta, rango de fechas y tabla de movimientos:

```typescript
'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

type Account = { id: string; code: string; name: string; type: string }

type Movement = {
  id: string
  date: string
  description: string
  reference?: string | null
  source: string
  debit: number
  credit: number
  balance: number
}

type LedgerResponse = {
  account: Account
  movements: Movement[]
  totals: { debit: number; credit: number; balance: number }
}

export default function LibroMayorPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState<LedgerResponse | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/accounts?active=true')
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts || []))
  }, [])

  useEffect(() => {
    if (!accountId) { setData(null); return }
    setLoading(true)
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    fetch(`/api/accounting/ledger/${accountId}?${params}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [accountId, from, to])

  const format = (n: number) => `$${n.toLocaleString('es-CL')}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Libro Mayor</h1>
        <p className="text-sm text-muted-foreground">Movimientos por cuenta contable.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Selección</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[280px]"
          >
            <option value="">— Selecciona una cuenta —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
            ))}
          </select>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Total Debe</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{format(data.totals.debit)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Total Haber</CardTitle></CardHeader>
              <CardContent><div className="text-2xl font-bold">{format(data.totals.credit)}</div></CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2"><CardTitle className="text-sm">Saldo</CardTitle></CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${data.totals.balance < 0 ? 'text-destructive' : ''}`}>
                  {format(data.totals.balance)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>{data.account.code} — {data.account.name}</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.movements.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">Sin movimientos en el período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3">Fecha</th>
                        <th className="text-left py-2 px-3">Descripción</th>
                        <th className="text-left py-2 px-3">Ref.</th>
                        <th className="text-right py-2 px-3">Debe</th>
                        <th className="text-right py-2 px-3">Haber</th>
                        <th className="text-right py-2 px-3">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.movements.map((m) => (
                        <tr key={m.id} className="border-b last:border-0">
                          <td className="py-2 px-3">{new Date(m.date).toLocaleDateString('es-CL')}</td>
                          <td className="py-2 px-3">{m.description}</td>
                          <td className="py-2 px-3 font-mono text-xs">{m.reference || '—'}</td>
                          <td className="py-2 px-3 text-right font-mono">{m.debit ? format(m.debit) : '—'}</td>
                          <td className="py-2 px-3 text-right font-mono">{m.credit ? format(m.credit) : '—'}</td>
                          <td className="py-2 px-3 text-right font-mono">{format(m.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Selecciona una cuenta para ver sus movimientos.</p>
      )}
    </div>
  )
}
```

- [ ] **Step 2:** Commit:

```bash
git add apps/web/app/contabilidad/mayor
git commit -m "feat(web): add libro mayor page with account ledger view

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 9: Add sidebar navigation

**Files:** `apps/web/components/layout/sidebar.tsx`

- [ ] **Step 1:** Importar el icono `BookText` (si no existe) o reutilizar `BookOpen` para los nuevos ítems. En el array `navItems`, después de `/contabilidad/puc`, agregar:

```typescript
{ href: "/contabilidad/libro-diario", label: "Libro Diario", icon: BookOpen },
{ href: "/contabilidad/mayor", label: "Libro Mayor", icon: BookOpen },
```

- [ ] **Step 2:** Build web:

```bash
pnpm --filter web build
```

- [ ] **Step 3:** Commit:

```bash
git add apps/web/components/layout/sidebar.tsx
git commit -m "feat(web): add libro diario and libro mayor to sidebar

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 10: Full build + smoke test

- [ ] **Step 1:** Build de todo el monorepo:

```bash
pnpm --filter @contachile/validators build
pnpm --filter @contachile/db db:generate
pnpm --filter api build
pnpm --filter web build
```

- [ ] **Step 2:** Smoke test manual:

1. Levantar `docker-compose up -d`, luego `pnpm dev`.
2. Ir a `/contabilidad/libro-diario`.
3. Emitir un DTE tipo 33 desde `/emit`.
4. Volver a `/contabilidad/libro-diario` → debería aparecer un asiento de fuente `dte` con 3 líneas que cuadran.
5. Crear un asiento manual desbalanceado → ver mensaje de error.
6. Crear un asiento manual cuadrado → debería aparecer en la lista.
7. Ir a `/contabilidad/mayor` → seleccionar "1103 Clientes" → ver el movimiento débito del DTE recién emitido.
8. Registrar una compra en `/purchases` → verificar asiento de fuente `purchase`.

---

## Spec Coverage Check

| Requisito del spec | Tarea |
|---------------------|-------|
| Modelos JournalEntry/JournalLine | 1 |
| Validación cuadratura SUM(debit)=SUM(credit) | 2 |
| Cada línea con debit XOR credit | 2 |
| Cuentas pertenecen al tenant y están activas | 4 |
| Endpoint GET /accounting/journal con filtros | 4 |
| Endpoint POST /accounting/journal | 4 |
| Endpoint GET /accounting/journal/:id | 4 |
| Endpoint GET /accounting/ledger/:accountId | 4 |
| Asiento automático DTE: 1103 / 4100 / 2111 | 3 + 5 |
| Asiento automático Compra: gasto / 1115 / 2101 | 3 + 5 |
| Mapeo de categoría a cuenta de gasto | 3 |
| Fallback silencioso si faltan cuentas PUC | 3 + 5 |
| UI Libro Diario con form manual + filtros | 7 |
| UI Libro Mayor con saldo acumulado | 8 |
| Navegación sidebar | 9 |
| Build verificado y smoke test | 10 |

Todos los requisitos cubiertos.

## Placeholder Scan

- Sin TBDs ni TODOs.
- Todos los bloques de código son copy-paste runnable.
- Tipos `Entry`, `Line`, `Account`, `Movement`, `LedgerResponse` consistentes entre frontend y respuestas de API.
