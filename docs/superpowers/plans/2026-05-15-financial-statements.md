# Estados Financieros — Implementation Plan (Módulo 1B)

> **For agentic workers:** ejecutar tarea por tarea, un commit por tarea, marcar `[x]` al avanzar.

**Goal:** Tres endpoints + tres páginas: Balance de Comprobación, Estado de Resultados, Balance General. Cálculo en tiempo real desde `JournalLine` agrupado por `Account`.

**Tech Stack:** Fastify, Next.js 14, Prisma, Zod.

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/validators/src/reports.ts` | Create | Zod schemas para query strings de reportes |
| `packages/validators/src/index.ts` | Modify | Exportar schemas |
| `apps/api/src/lib/financial-statements.ts` | Create | Funciones puras `computeTrialBalance`, `computeIncomeStatement`, `computeBalanceSheet` |
| `apps/api/src/routes/accounting/reports.ts` | Create | 3 endpoints `/accounting/reports/*` |
| `apps/api/src/index.ts` | Modify | Registrar `reportsRoute` |
| `apps/web/app/api/accounting/reports/trial-balance/route.ts` | Create | Proxy |
| `apps/web/app/api/accounting/reports/income-statement/route.ts` | Create | Proxy |
| `apps/web/app/api/accounting/reports/balance-sheet/route.ts` | Create | Proxy |
| `apps/web/app/contabilidad/reportes/balance-comprobacion/page.tsx` | Create | UI |
| `apps/web/app/contabilidad/reportes/estado-resultados/page.tsx` | Create | UI |
| `apps/web/app/contabilidad/reportes/balance-general/page.tsx` | Create | UI |
| `apps/web/components/layout/sidebar.tsx` | Modify | Tres entradas de reportes |
| `apps/api/scripts/smoke-reports.ts` | Create | Smoke test contra DB local |

---

### Task 1: Add report query validators

- [ ] **Step 1:** Crear `packages/validators/src/reports.ts`:

```typescript
import { z } from 'zod'

const dateRegex = /^\d{4}-\d{2}-\d{2}$/

export const TrialBalanceQuerySchema = z.object({
  asOf: z.string().regex(dateRegex).optional(),
})

export const IncomeStatementQuerySchema = z.object({
  from: z.string().regex(dateRegex),
  to: z.string().regex(dateRegex),
}).refine((d) => d.from <= d.to, { message: 'from debe ser <= to' })

export const BalanceSheetQuerySchema = z.object({
  asOf: z.string().regex(dateRegex).optional(),
})
```

- [ ] **Step 2:** Exportar desde `packages/validators/src/index.ts`:

```typescript
export {
  TrialBalanceQuerySchema,
  IncomeStatementQuerySchema,
  BalanceSheetQuerySchema,
} from './reports'
```

- [ ] **Step 3:** Build: `pnpm --filter @contachile/validators build`

- [ ] **Step 4:** Commit:

```bash
git add packages/validators/src/reports.ts packages/validators/src/index.ts
git commit -m "feat(validators): add financial report query schemas"
```

---

### Task 2: Create financial-statements helper

- [ ] **Step 1:** Crear `apps/api/src/lib/financial-statements.ts` con funciones puras que reciben Prisma y devuelven el shape del response.

```typescript
import { prisma } from '@contachile/db'

type AccountType = 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO' | 'COSTO'

interface AccountInfo {
  id: string
  code: string
  name: string
  type: AccountType
}

interface AccountSum {
  accountId: string
  debit: number
  credit: number
}

async function getCompanyAccounts(companyId: string): Promise<AccountInfo[]> {
  return prisma.account.findMany({
    where: { companyId },
    select: { id: true, code: true, name: true, type: true },
    orderBy: { code: 'asc' },
  })
}

async function sumLinesUntil(
  companyId: string,
  asOf: Date,
  accountIds: string[]
): Promise<AccountSum[]> {
  if (accountIds.length === 0) return []
  const groups = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where: {
      accountId: { in: accountIds },
      journalEntry: { companyId, date: { lte: asOf } },
    },
    _sum: { debit: true, credit: true },
  })
  return groups.map((g) => ({
    accountId: g.accountId,
    debit: g._sum.debit ?? 0,
    credit: g._sum.credit ?? 0,
  }))
}

async function sumLinesInRange(
  companyId: string,
  from: Date,
  to: Date,
  accountIds: string[]
): Promise<AccountSum[]> {
  if (accountIds.length === 0) return []
  const groups = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where: {
      accountId: { in: accountIds },
      journalEntry: { companyId, date: { gte: from, lte: to } },
    },
    _sum: { debit: true, credit: true },
  })
  return groups.map((g) => ({
    accountId: g.accountId,
    debit: g._sum.debit ?? 0,
    credit: g._sum.credit ?? 0,
  }))
}

export async function computeTrialBalance(companyId: string, asOf: Date) {
  const accounts = await getCompanyAccounts(companyId)
  const sums = await sumLinesUntil(companyId, asOf, accounts.map((a) => a.id))
  const sumByAccount = new Map(sums.map((s) => [s.accountId, s]))

  const rows = accounts
    .map((a) => {
      const s = sumByAccount.get(a.id) ?? { debit: 0, credit: 0 }
      const saldoDeudor = Math.max(0, s.debit - s.credit)
      const saldoAcreedor = Math.max(0, s.credit - s.debit)
      return {
        accountId: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        totalDebit: s.debit,
        totalCredit: s.credit,
        saldoDeudor,
        saldoAcreedor,
      }
    })
    .filter((r) => r.totalDebit > 0 || r.totalCredit > 0)

  const totalDebit = rows.reduce((s, r) => s + r.totalDebit, 0)
  const totalCredit = rows.reduce((s, r) => s + r.totalCredit, 0)
  const saldoDeudor = rows.reduce((s, r) => s + r.saldoDeudor, 0)
  const saldoAcreedor = rows.reduce((s, r) => s + r.saldoAcreedor, 0)

  return {
    asOf: asOf.toISOString().slice(0, 10),
    rows,
    totals: {
      totalDebit,
      totalCredit,
      saldoDeudor,
      saldoAcreedor,
      balanced: saldoDeudor === saldoAcreedor,
    },
  }
}

function groupRows(
  accounts: AccountInfo[],
  sums: AccountSum[],
  filterType: AccountType,
  naturalSide: 'debit' | 'credit'
) {
  const sumByAccount = new Map(sums.map((s) => [s.accountId, s]))
  const rows = accounts
    .filter((a) => a.type === filterType)
    .map((a) => {
      const s = sumByAccount.get(a.id) ?? { debit: 0, credit: 0 }
      const value = naturalSide === 'debit' ? s.debit - s.credit : s.credit - s.debit
      return { accountId: a.id, code: a.code, name: a.name, value }
    })
    .filter((r) => r.value !== 0)
  const total = rows.reduce((s, r) => s + r.value, 0)
  return { total, rows }
}

export async function computeIncomeStatement(companyId: string, from: Date, to: Date) {
  const accounts = await getCompanyAccounts(companyId)
  const sums = await sumLinesInRange(companyId, from, to, accounts.map((a) => a.id))

  const ingresos = groupRows(accounts, sums, 'INGRESO', 'credit')
  const costos = groupRows(accounts, sums, 'COSTO', 'debit')
  const gastos = groupRows(accounts, sums, 'GASTO', 'debit')

  const utilidadBruta = ingresos.total - costos.total
  const utilidadEjercicio = ingresos.total - costos.total - gastos.total

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    ingresos,
    costos,
    gastos,
    utilidadBruta,
    utilidadEjercicio,
  }
}

export async function computeBalanceSheet(companyId: string, asOf: Date) {
  const accounts = await getCompanyAccounts(companyId)
  const sumsAcum = await sumLinesUntil(companyId, asOf, accounts.map((a) => a.id))

  const activo = groupRows(accounts, sumsAcum, 'ACTIVO', 'debit')
  const pasivo = groupRows(accounts, sumsAcum, 'PASIVO', 'credit')
  const patrimonio = groupRows(accounts, sumsAcum, 'PATRIMONIO', 'credit')

  // Utilidad acumulada del año hasta asOf
  const yearStart = new Date(asOf.getFullYear(), 0, 1)
  const sumsYear = await sumLinesInRange(companyId, yearStart, asOf, accounts.map((a) => a.id))
  const ingresos = groupRows(accounts, sumsYear, 'INGRESO', 'credit')
  const costos = groupRows(accounts, sumsYear, 'COSTO', 'debit')
  const gastos = groupRows(accounts, sumsYear, 'GASTO', 'debit')
  const utilidadEjercicio = ingresos.total - costos.total - gastos.total

  const totalPasivoPatrimonio = pasivo.total + patrimonio.total + utilidadEjercicio

  return {
    asOf: asOf.toISOString().slice(0, 10),
    activo,
    pasivo,
    patrimonio,
    utilidadEjercicio,
    totalPasivoPatrimonio,
    balanced: activo.total === totalPasivoPatrimonio,
  }
}
```

- [ ] **Step 2:** Build: `pnpm --filter api build`

- [ ] **Step 3:** Commit:

```bash
git add apps/api/src/lib/financial-statements.ts
git commit -m "feat(api): add financial statements computation helpers"
```

---

### Task 3: Create reports route

- [ ] **Step 1:** Crear `apps/api/src/routes/accounting/reports.ts`:

```typescript
import { FastifyInstance } from 'fastify'
import {
  TrialBalanceQuerySchema,
  IncomeStatementQuerySchema,
  BalanceSheetQuerySchema,
} from '@contachile/validators'
import {
  computeTrialBalance,
  computeIncomeStatement,
  computeBalanceSheet,
} from '../../lib/financial-statements'

function parseDate(s: string): Date {
  return new Date(s + 'T23:59:59')
}

export default async function (fastify: FastifyInstance) {
  fastify.get('/accounting/reports/trial-balance', async (request, reply) => {
    const companyId = request.companyId
    const parsed = TrialBalanceQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Parámetros inválidos', issues: parsed.error.issues })
    }
    const asOfStr = parsed.data.asOf || new Date().toISOString().slice(0, 10)
    const asOf = parseDate(asOfStr)
    const result = await computeTrialBalance(companyId, asOf)
    return reply.send(result)
  })

  fastify.get('/accounting/reports/income-statement', async (request, reply) => {
    const companyId = request.companyId
    const parsed = IncomeStatementQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Parámetros inválidos', issues: parsed.error.issues })
    }
    const from = new Date(parsed.data.from + 'T00:00:00')
    const to = parseDate(parsed.data.to)
    const result = await computeIncomeStatement(companyId, from, to)
    return reply.send(result)
  })

  fastify.get('/accounting/reports/balance-sheet', async (request, reply) => {
    const companyId = request.companyId
    const parsed = BalanceSheetQuerySchema.safeParse(request.query)
    if (!parsed.success) {
      return reply.code(400).send({ error: 'Parámetros inválidos', issues: parsed.error.issues })
    }
    const asOfStr = parsed.data.asOf || new Date().toISOString().slice(0, 10)
    const asOf = parseDate(asOfStr)
    const result = await computeBalanceSheet(companyId, asOf)
    return reply.send(result)
  })
}
```

- [ ] **Step 2:** Registrar en `apps/api/src/index.ts`:

```typescript
import reportsRoute from './routes/accounting/reports'
// ...
app.register(reportsRoute)
```

- [ ] **Step 3:** Build: `pnpm --filter api build`

- [ ] **Step 4:** Commit:

```bash
git add apps/api/src/routes/accounting/reports.ts apps/api/src/index.ts
git commit -m "feat(api): add financial reports endpoints"
```

---

### Task 4: Create Next.js proxies

- [ ] Crear proxies para los tres endpoints siguiendo el patrón de `/api/f22/route.ts`:
  - `apps/web/app/api/accounting/reports/trial-balance/route.ts`
  - `apps/web/app/api/accounting/reports/income-statement/route.ts`
  - `apps/web/app/api/accounting/reports/balance-sheet/route.ts`

Cada uno: GET que reenvía query string al endpoint correspondiente.

- [ ] Commit: `feat(web): add financial reports proxies`

---

### Task 5: Create Trial Balance page

- [ ] Crear `apps/web/app/contabilidad/reportes/balance-comprobacion/page.tsx`:
  - Input `asOf` (default: hoy)
  - Cards: total debe, total haber, saldo deudor, saldo acreedor
  - Banner rojo si `!balanced`
  - Tabla: código, cuenta, tipo, debe, haber, saldo deudor, saldo acreedor
  - Botón "Imprimir / PDF"

- [ ] Commit: `feat(web): add trial balance report page`

---

### Task 6: Create Income Statement page

- [ ] Crear `apps/web/app/contabilidad/reportes/estado-resultados/page.tsx`:
  - Inputs `from`/`to` (default: primer y último día del mes actual)
  - Cards: ingresos, costos, gastos, utilidad del ejercicio
  - Tablas agrupadas por sección (Ingresos / Costos / Gastos) con totales
  - Botón imprimir

- [ ] Commit: `feat(web): add income statement report page`

---

### Task 7: Create Balance Sheet page

- [ ] Crear `apps/web/app/contabilidad/reportes/balance-general/page.tsx`:
  - Input `asOf` (default: hoy)
  - Cards: total activo, total pasivo+patrimonio, utilidad del ejercicio
  - Banner rojo si `!balanced`
  - Dos columnas: izquierda = Activo, derecha = Pasivo + Patrimonio + Utilidad
  - Botón imprimir

- [ ] Commit: `feat(web): add balance sheet report page`

---

### Task 8: Sidebar nav

- [ ] Modificar `apps/web/components/layout/sidebar.tsx` agregando 3 entradas después de "Libro Mayor":

```typescript
{ href: "/contabilidad/reportes/balance-comprobacion", label: "Balance Comprobación", icon: FileBarChart },
{ href: "/contabilidad/reportes/estado-resultados", label: "Estado Resultados", icon: FileBarChart },
{ href: "/contabilidad/reportes/balance-general", label: "Balance General", icon: FileBarChart },
```

- [ ] Build web y commit.

---

### Task 9: Smoke test

- [ ] Crear `apps/api/scripts/smoke-reports.ts`:

```typescript
import { PrismaClient } from '../../../packages/db/generated/client'
import {
  computeTrialBalance,
  computeIncomeStatement,
  computeBalanceSheet,
} from '../src/lib/financial-statements'

const prisma = new PrismaClient()
const COMPANY_ID = 'dev-test-company'

async function main() {
  const today = new Date()
  const yearStart = new Date(today.getFullYear(), 0, 1)
  const yearEnd = new Date(today.getFullYear(), 11, 31, 23, 59, 59)

  console.log('=== Trial Balance ===')
  const tb = await computeTrialBalance(COMPANY_ID, today)
  console.log(`Filas: ${tb.rows.length}`)
  for (const r of tb.rows) {
    console.log(`  ${r.code} ${r.name.padEnd(30)} D=${r.saldoDeudor} A=${r.saldoAcreedor}`)
  }
  console.log(`Totals: deudor=${tb.totals.saldoDeudor} acreedor=${tb.totals.saldoAcreedor} balanced=${tb.totals.balanced}`)

  console.log('\n=== Income Statement ===')
  const is = await computeIncomeStatement(COMPANY_ID, yearStart, yearEnd)
  console.log(`Ingresos: ${is.ingresos.total}`)
  console.log(`Costos:   ${is.costos.total}`)
  console.log(`Gastos:   ${is.gastos.total}`)
  console.log(`Utilidad: ${is.utilidadEjercicio}`)

  console.log('\n=== Balance Sheet ===')
  const bs = await computeBalanceSheet(COMPANY_ID, today)
  console.log(`Activo:        ${bs.activo.total}`)
  console.log(`Pasivo:        ${bs.pasivo.total}`)
  console.log(`Patrimonio:    ${bs.patrimonio.total}`)
  console.log(`Utilidad:      ${bs.utilidadEjercicio}`)
  console.log(`Total P+P+U:   ${bs.totalPasivoPatrimonio}`)
  console.log(`Balanced: ${bs.balanced}`)

  process.exit(tb.totals.balanced && bs.balanced ? 0 : 1)
}

main().finally(() => prisma.$disconnect())
```

- [ ] Correr con `DATABASE_URL` set y verificar balanced=true en ambos.

- [ ] Commit.

---

## Spec Coverage Check

| Requisito | Tarea |
|---|---|
| TrialBalance computa saldos por cuenta | 2, 3 |
| IncomeStatement por rango | 2, 3 |
| BalanceSheet con utilidad del ejercicio | 2, 3 |
| Validación de cuadratura (`balanced`) | 2 |
| Endpoint REST con companyId del tenant | 3 |
| Validación de query params con Zod | 1, 3 |
| Proxies Next.js | 4 |
| UI con cards + tablas + imprimir | 5, 6, 7 |
| Banner rojo si no cuadra | 5, 7 |
| Sidebar nav | 8 |
| Smoke test contra DB local | 9 |
