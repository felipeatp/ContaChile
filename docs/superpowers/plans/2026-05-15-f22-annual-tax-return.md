# F22 Declaracion Anual de Renta Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar el preview de la Declaracion Anual de Renta (F22) que se calcula automaticamente desde Document, Purchase y F29 acumulados del ano.

**Architecture:** El endpoint GET /f22 calcula en tiempo real: ingresos desde Document, costos/gastos desde Purchase, PPM desde F29 mensuales, renta liquida e impuesto determinado con tabla progresiva. La pagina /f22 reutiliza el patron de /f29 con selector de ano, cards resumen, tabla detallada y exportacion PDF.

**Tech Stack:** Fastify, Next.js 14, Prisma, Zod, shadcn/ui

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/validators/src/tax.ts` | Modify | Agregar `calcularImpuestoRenta` con tabla progresiva |
| `packages/validators/src/index.ts` | Modify | Exportar `calcularImpuestoRenta` |
| `apps/api/src/routes/f22.ts` | Create | API route GET /f22 con calculo automatico |
| `apps/api/src/index.ts` | Modify | Registrar ruta `/f22` |
| `apps/web/app/api/f22/route.ts` | Create | Proxy Next.js para `/f22` |
| `apps/web/app/f22/page.tsx` | Create | Pagina de F22 con selector, cards, tabla, print |
| `apps/web/components/layout/sidebar.tsx` | Modify | Agregar navegacion a `/f22` |

---

### Task 1: Add rent tax calculation function

**Files:**
- Modify: `packages/validators/src/tax.ts`
- Modify: `packages/validators/src/index.ts`

- [ ] **Step 1: Add calcularImpuestoRenta to tax.ts**

Open `packages/validators/src/tax.ts`. Add after the existing functions:

```typescript
/**
 * Calcula el impuesto a la renta segun tabla progresiva chilena.
 * UTA = Unidad Tributaria Anual (default: 720_000 CLP)
 * 
 * Renta Liquida Bracket | Tasa
 * Hasta 15 UTA          | 0%
 * 15 UTA - 30 UTA       | 4%
 * 30 UTA - 50 UTA       | 8%
 * 50 UTA - 120 UTA      | 13.5%
 * Mas de 120 UTA        | 27%
 */
export function calcularImpuestoRenta(rentaLiquida: number): number {
  if (rentaLiquida <= 0) return 0

  const UTA = 720_000
  const brackets = [
    { limit: 15 * UTA, rate: 0 },
    { limit: 30 * UTA, rate: 0.04 },
    { limit: 50 * UTA, rate: 0.08 },
    { limit: 120 * UTA, rate: 0.135 },
    { limit: Infinity, rate: 0.27 },
  ]

  let tax = 0
  let remaining = rentaLiquida
  let previousLimit = 0

  for (const bracket of brackets) {
    if (remaining <= 0) break
    const bracketAmount = Math.min(remaining, bracket.limit - previousLimit)
    tax += Math.floor(bracketAmount * bracket.rate)
    remaining -= bracketAmount
    previousLimit = bracket.limit
  }

  return tax
}
```

- [ ] **Step 2: Export from index.ts**

Open `packages/validators/src/index.ts`. Add to the existing exports:

```typescript
export { calcularImpuestoRenta } from './tax'
```

- [ ] **Step 3: Build validators**

Run: `pnpm --filter @contachile/validators build`

- [ ] **Step 4: Commit**

```bash
git add packages/validators/src/tax.ts packages/validators/src/index.ts
git commit -m "feat(validators): add progressive income tax calculator

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Create F22 API route

**Files:**
- Create: `apps/api/src/routes/f22.ts`

- [ ] **Step 1: Create the route**

Create `apps/api/src/routes/f22.ts`:

```typescript
import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import { calcularImpuestoRenta } from '@contachile/validators'

interface F22Line {
  code: string
  label: string
  value: number
  auto: boolean
}

interface F22Response {
  year: number
  lines: F22Line[]
  summary: {
    ingresos: number
    costos: number
    gastos: number
    rentaLiquida: number
    ppmPagado: number
    impuesto: number
    saldoPagar: number
    saldoDevolver: number
  }
}

function getYearRange(year: number): { start: Date; end: Date } {
  return {
    start: new Date(year, 0, 1),
    end: new Date(year + 1, 0, 1),
  }
}

export default async function (fastify: FastifyInstance) {
  fastify.get('/f22', async (request, reply) => {
    const companyId = request.companyId
    const yearStr = (request.query as Record<string, string>).year
    const year = yearStr ? parseInt(yearStr, 10) : new Date().getFullYear()

    if (isNaN(year) || year < 2020 || year > new Date().getFullYear() + 1) {
      return reply.code(400).send({ error: 'Ano invalido' })
    }

    const { start, end } = getYearRange(year)

    // Ingresos: Document tipo 33 (facturas emitidas)
    const ingresos = await prisma.document.aggregate({
      where: {
        companyId,
        type: 33,
        emittedAt: { gte: start, lt: end },
      },
      _sum: { totalAmount: true },
    })

    // Costos: Purchase tipo 33 (facturas recibidas de proveedores)
    const costos = await prisma.purchase.aggregate({
      where: {
        companyId,
        type: 33,
        date: { gte: start, lt: end },
      },
      _sum: { totalAmount: true },
    })

    // Gastos: Purchase tipo 46 o con categoria de gasto
    const gastos = await prisma.purchase.aggregate({
      where: {
        companyId,
        type: { not: 33 },
        date: { gte: start, lt: end },
      },
      _sum: { totalAmount: true },
    })

    const totalIngresos = ingresos._sum.totalAmount || 0
    const totalCostos = costos._sum.totalAmount || 0
    const totalGastos = gastos._sum.totalAmount || 0
    const rentaLiquida = Math.max(0, totalIngresos - totalCostos - totalGastos)

    // PPM pagado: sumar codigo 91 de cada F29 del ano
    // Como no tenemos F29 persistido, calculamos aproximadamente desde los F29 de cada mes
    const f29s = await Promise.all(
      Array.from({ length: 12 }, async (_, i) => {
        const monthStart = new Date(year, i, 1)
        const monthEnd = new Date(year, i + 1, 1)

        const docs = await prisma.document.findMany({
          where: {
            companyId,
            type: 33,
            emittedAt: { gte: monthStart, lt: monthEnd },
          },
          select: { totalTax: true },
        })

        const ventasTax = docs.reduce((s, d) => s + d.totalTax, 0)

        const compras = await prisma.purchase.findMany({
          where: {
            companyId,
            date: { gte: monthStart, lt: monthEnd },
          },
          select: { taxAmount: true },
        })

        const comprasTax = compras.reduce((s, c) => s + c.taxAmount, 0)
        const iva = Math.max(0, ventasTax - comprasTax)

        // PPM aproximado: 0.5% de ingresos brutos del mes
        const ingresosMes = docs.reduce((s, d) => s + d.totalAmount, 0)
        const ppm = Math.floor(ingresosMes * 0.005)

        return { iva, ppm }
      })
    )

    const ppmTotal = f29s.reduce((s, f) => s + f.ppm, 0)

    const impuesto = calcularImpuestoRenta(rentaLiquida)
    const saldo = impuesto - ppmTotal
    const saldoPagar = saldo > 0 ? saldo : 0
    const saldoDevolver = saldo < 0 ? Math.abs(saldo) : 0

    const response: F22Response = {
      year,
      lines: [
        { code: '525', label: 'Ingresos brutos', value: totalIngresos, auto: true },
        { code: '526', label: 'Costos', value: totalCostos, auto: true },
        { code: '527', label: 'Gastos operacionales', value: totalGastos, auto: true },
        { code: '528', label: 'Renta liquida', value: rentaLiquida, auto: true },
        { code: '585', label: 'PPM pagado en el ano', value: ppmTotal, auto: true },
        { code: '594', label: 'Impuesto determinado', value: impuesto, auto: true },
        { code: '595', label: 'Saldo a pagar', value: saldoPagar, auto: true },
        { code: '596', label: 'Saldo a devolver', value: saldoDevolver, auto: true },
      ],
      summary: {
        ingresos: totalIngresos,
        costos: totalCostos,
        gastos: totalGastos,
        rentaLiquida,
        ppmPagado: ppmTotal,
        impuesto,
        saldoPagar,
        saldoDevolver,
      },
    }

    return reply.send(response)
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/routes/f22.ts
git commit -m "feat(api): add F22 annual tax return endpoint

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Register F22 route in API

**Files:**
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Import and register**

Add import:
```typescript
import f22Route from './routes/f22'
```

Register:
```typescript
app.register(f22Route)
```

- [ ] **Step 2: Build**

Run: `pnpm --filter api build`

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/index.ts
git commit -m "feat(api): register F22 route

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Create Next.js proxy for F22

**Files:**
- Create: `apps/web/app/api/f22/route.ts`

- [ ] **Step 1: Create proxy**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.toString()

  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = {}
  if (cookie) extraHeaders['Cookie'] = cookie

  const { status, data } = await apiFetch(`/f22${query ? `?${query}` : ''}`, {
    method: 'GET',
    headers: extraHeaders,
  })

  return NextResponse.json(data, { status })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/api/f22/route.ts
git commit -m "feat(web): add F22 API proxy

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Create F22 page

**Files:**
- Create: `apps/web/app/f22/page.tsx`

- [ ] **Step 1: Create page**

Create `apps/web/app/f22/page.tsx`:

```typescript
'use client'

import { useState, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Loader2, Printer } from 'lucide-react'

interface F22Line {
  code: string
  label: string
  value: number
  auto: boolean
}

interface F22Response {
  year: number
  lines: F22Line[]
  summary: {
    ingresos: number
    costos: number
    gastos: number
    rentaLiquida: number
    ppmPagado: number
    impuesto: number
    saldoPagar: number
    saldoDevolver: number
  }
}

export default function F22Page() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState<F22Response | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchF22 = async (y: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/f22?year=${y}`)
      if (!res.ok) throw new Error('Error al calcular F22')
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchF22(year)
  }, [year])

  const format = (n: number) => `$${n.toLocaleString('es-CL')}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">F22 - Declaracion Anual de Renta</h1>
          <p className="text-muted-foreground">Calculo automatico desde documentos del ano</p>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {Array.from({ length: 6 }, (_, i) => new Date().getFullYear() - i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <Button variant="outline" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-destructive/10 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Renta Liquida</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{format(data.summary.rentaLiquida)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Impuesto Determinado</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{format(data.summary.impuesto)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">
                  {data.summary.saldoPagar > 0 ? 'Saldo a Pagar' : 'Saldo a Devolver'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${data.summary.saldoDevolver > 0 ? 'text-green-600' : ''}`}>
                  {format(data.summary.saldoPagar > 0 ? data.summary.saldoPagar : data.summary.saldoDevolver)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Detalle F22 - {data.year}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2 px-3">Codigo</th>
                      <th className="text-left py-2 px-3">Descripcion</th>
                      <th className="text-right py-2 px-3">Monto</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.lines.map((line) => (
                      <tr key={line.code} className="border-b last:border-0">
                        <td className="py-2 px-3 font-mono">{line.code}</td>
                        <td className="py-2 px-3">
                          <div className="flex items-center gap-2">
                            {line.label}
                            {line.auto && (
                              <span className="text-xs text-muted-foreground">(auto)</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2 px-3 text-right font-mono">{format(line.value)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      ) : null}
    </div>
  )
}
```

- [ ] **Step 2: Build**

Run: `pnpm --filter web build`

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/f22/page.tsx
git commit -m "feat(web): add F22 annual tax return page

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Add sidebar navigation

**Files:**
- Modify: `apps/web/components/layout/sidebar.tsx`

- [ ] **Step 1: Add nav item**

In the `navItems` array, add before Settings:

```typescript
{ href: '/f22', label: 'F22 Anual', icon: FileBarChart },
```

- [ ] **Step 2: Build**

Run: `pnpm --filter web build`

- [ ] **Step 3: Commit**

```bash
git add apps/web/components/layout/sidebar.tsx
git commit -m "feat(web): add F22 to sidebar navigation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Verify full build

**Files:**
- None (testing only)

- [ ] **Step 1: Build all**

```bash
pnpm --filter @contachile/validators build
pnpm --filter api build
pnpm --filter web build
```

- [ ] **Step 2: Test**

1. Start API and web
2. Navigate to `/f22`
3. Select a year with documents
4. Verify cards show values
5. Verify table shows all lines

---

## Spec Coverage Check

| Spec Requirement | Task |
|-----------------|------|
| calcularImpuestoRenta con tabla progresiva | Task 1 |
| GET /f22 endpoint | Task 2 |
| Registro de ruta en API | Task 3 |
| Proxy Next.js | Task 4 |
| Pagina /f22 con cards y tabla | Task 5 |
| Navegacion sidebar | Task 6 |
| Build verificado | Task 7 |

All requirements covered.

## Placeholder Scan

- No TBDs, TODOs, or incomplete sections.
- All code blocks contain complete, copy-pasteable code.
- Type consistency: `F22Line`, `F22Response`, `calcularImpuestoRenta` used consistently.
