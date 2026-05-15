# Dashboard + Emission Flow Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Conectar el dashboard de Next.js con datos reales del API y completar el formulario de emisión DTE con modo direct/bridge funcional y cálculo de totales en tiempo real.

**Architecture:** El frontend usa Next.js 14 App Router con rutas proxy `/api/*` que reenvían requests al backend Fastify (`localhost:3001`). El auth usa Clerk: el navegador maneja cookies de sesión, el proxy reenvía headers `authorization` + `cookie`, y el backend verifica el token con `@clerk/backend`. El formulario de emisión usa `react-hook-form` + `zodResolver` con `@contachile/validators`.

**Tech Stack:** Next.js 14, Fastify, Clerk, TanStack Query, react-hook-form, Zod, @contachile/validators

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `apps/web/lib/api-server.ts` | Modify | Reenviar headers `authorization`, `cookie`, `x-company-id` al backend |
| `apps/web/app/page.tsx` | Modify | Dashboard: usar proxy `/api/documents` en lugar de `apiFetch` directo |
| `apps/web/app/api/documents/route.ts` | Modify | Proxy: reenviar headers necesarios incluyendo `cookie` |
| `apps/web/components/emit/emit-form.tsx` | Modify | Formulario completo: modo direct/bridge, totales en tiempo real |
| `apps/web/hooks/use-emit-document.ts` | Modify | Agregar función `emitBridgeDocument` para modo bridge |
| `apps/web/app/documents/page.tsx` | Modify | Agregar navegación desde lista a dashboard |

---

### Task 1: Fix api-server.ts to forward cookie header

**Files:**
- Modify: `apps/web/lib/api-server.ts`

- [ ] **Step 1: Add cookie to forwarded headers**

```typescript
function getForwardedHeaders(): Record<string, string> {
  const h = headers()
  const forwarded: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const auth = h.get('authorization')
  if (auth) forwarded['Authorization'] = auth

  const companyId = h.get('x-company-id')
  if (companyId) forwarded['x-company-id'] = companyId

  const idempotencyKey = h.get('idempotency-key')
  if (idempotencyKey) forwarded['idempotency-key'] = idempotencyKey

  // Forward cookie so Clerk session works through the proxy
  const cookie = h.get('cookie')
  if (cookie) forwarded['Cookie'] = cookie

  return forwarded
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/lib/api-server.ts
git commit -m "fix(web): forward cookie header in api-server proxy"
```

---

### Task 2: Fix documents API proxy to forward auth cookie

**Files:**
- Modify: `apps/web/app/api/documents/route.ts`

- [ ] **Step 1: Forward cookie header from Next.js request to backend**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.toString()

  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = {}
  if (cookie) extraHeaders['Cookie'] = cookie

  const { status, data } = await apiFetch(`/documents${query ? `?${query}` : ''}`, {
    method: 'GET',
    headers: extraHeaders,
  })

  return NextResponse.json(data, { status })
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/api/documents/route.ts
git commit -m "fix(web): forward cookie in documents proxy route"
```

---

### Task 3: Update dashboard to use proxy route

**Files:**
- Modify: `apps/web/app/page.tsx`

- [ ] **Step 1: Replace apiFetch with direct fetch to proxy**

```typescript
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DocumentTable } from "@/components/documents/document-table"
import { DocumentsResponse } from "@/types"
import Link from "next/link"
import { Button } from "@/components/ui/button"

async function getStats() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/documents?limit=1000`, {
      cache: 'no-store',
    })
    const json = (await res.json()) as DocumentsResponse
    const docs = json?.documents || []

    const todayDocs = docs.filter((d) => new Date(d.emittedAt) >= today)
    const pending = docs.filter((d) => d.status === "PENDING").length
    const accepted = docs.filter((d) => d.status === "ACCEPTED").length

    return {
      emittedToday: todayDocs.length,
      pending,
      accepted,
      recent: docs.slice(0, 5),
    }
  } catch (e) {
    console.warn('[dashboard] getStats failed:', e)
    return {
      emittedToday: 0,
      pending: 0,
      accepted: 0,
      recent: [],
    }
  }
}

export default async function HomePage() {
  const stats = await getStats()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Link href="/emit">
          <Button>Emitir DTE</Button>
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emitidos hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.emittedToday}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aceptados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.accepted}</div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold">Documentos recientes</h2>
        <DocumentTable documents={stats.recent} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/app/page.tsx
git commit -m "feat(web): dashboard uses proxy route and adds emit button"
```

---

### Task 4: Update emit-form to support direct/bridge mode

**Files:**
- Modify: `apps/web/components/emit/emit-form.tsx`

- [ ] **Step 1: Import useEmitBridgeDocument and add mode switching**

```typescript
"use client"

import { useState, useMemo } from "react"
import { useForm, useFieldArray } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { EmitDocumentSchema, calcularIVA, calcularTotal } from "@contachile/validators"
import { useEmitDocument, useEmitBridgeDocument } from "@/hooks/use-emit-document"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { useRouter } from "next/navigation"

export function EmitForm() {
  const [mode, setMode] = useState<"direct" | "bridge">("direct")
  const emitDirect = useEmitDocument()
  const emitBridge = useEmitBridgeDocument()
  const router = useRouter()

  const form = useForm({
    resolver: zodResolver(EmitDocumentSchema),
    defaultValues: {
      type: 33,
      receiver: { rut: "", name: "", address: "" },
      items: [{ description: "", quantity: 1, unitPrice: 0 }],
      paymentMethod: "CONTADO",
    },
  })

  const { fields, append, remove } = useFieldArray({
    control: form.control,
    name: "items",
  })

  const items = form.watch("items")

  const totals = useMemo(() => {
    const neto = items.reduce((sum, item) => {
      const qty = Number(item.quantity) || 0
      const price = Number(item.unitPrice) || 0
      return sum + qty * price
    }, 0)
    const tax = calcularIVA(neto)
    const total = calcularTotal(neto)
    return { neto, tax, total }
  }, [items])

  const onSubmit = form.handleSubmit(async (data) => {
    const idempotencyKey = crypto.randomUUID()
    const emit = mode === "direct" ? emitDirect : emitBridge
    await emit.mutateAsync({ body: data, idempotencyKey })
    form.reset()
    setTimeout(() => router.push("/documents"), 1500)
  })

  const isPending = emitDirect.isPending || emitBridge.isPending
  const isSuccess = emitDirect.isSuccess || emitBridge.isSuccess
  const isError = emitDirect.isError || emitBridge.isError
  const error = emitDirect.error || emitBridge.error
  const successData = emitDirect.data || emitBridge.data

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="flex items-center space-x-4">
        <Button
          type="button"
          variant={mode === "direct" ? "default" : "outline"}
          onClick={() => setMode("direct")}
        >
          Emisión Directa
        </Button>
        <Button
          type="button"
          variant={mode === "bridge" ? "default" : "outline"}
          onClick={() => setMode("bridge")}
        >
          Bridge (Acepta)
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Receptor</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div>
              <label className="text-sm font-medium">RUT</label>
              <Input
                {...form.register("receiver.rut")}
                placeholder="76.123.456-7"
              />
              {form.formState.errors.receiver?.rut && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.receiver.rut.message}
                </p>
              )}
            </div>
            <div>
              <label className="text-sm font-medium">Nombre</label>
              <Input {...form.register("receiver.name")} placeholder="Razón social" />
              {form.formState.errors.receiver?.name && (
                <p className="text-sm text-destructive">
                  {form.formState.errors.receiver.name.message}
                </p>
              )}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium">Dirección</label>
            <Input {...form.register("receiver.address")} placeholder="Dirección completa" />
          </div>
          <div>
            <label className="text-sm font-medium">Email (opcional)</label>
            <Input {...form.register("receiver.email")} placeholder="receptor@empresa.cl" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {fields.map((field, index) => (
            <div key={field.id} className="grid grid-cols-12 gap-4 items-end">
              <div className="col-span-6">
                <label className="text-sm font-medium">Descripción</label>
                <Input
                  {...form.register(`items.${index}.description`)}
                  placeholder="Producto o servicio"
                />
              </div>
              <div className="col-span-2">
                <label className="text-sm font-medium">Cantidad</label>
                <Input
                  type="number"
                  {...form.register(`items.${index}.quantity`, { valueAsNumber: true })}
                />
              </div>
              <div className="col-span-3">
                <label className="text-sm font-medium">Precio unitario</label>
                <Input
                  type="number"
                  {...form.register(`items.${index}.unitPrice`, { valueAsNumber: true })}
                />
              </div>
              <div className="col-span-1">
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={() => remove(index)}
                  disabled={fields.length === 1}
                >
                  X
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={() => append({ description: "", quantity: 1, unitPrice: 0 })}
          >
            + Agregar item
          </Button>
        </CardContent>
      </Card>

      <div className="flex items-center space-x-4">
        <div>
          <label className="text-sm font-medium">Método de pago</label>
          <select
            {...form.register("paymentMethod")}
            className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            <option value="CONTADO">Contado</option>
            <option value="CREDITO">Crédito</option>
          </select>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Totales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Neto</span>
            <span>${totals.neto.toLocaleString("es-CL")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">IVA (19%)</span>
            <span>${totals.tax.toLocaleString("es-CL")}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>${totals.total.toLocaleString("es-CL")}</span>
          </div>
        </CardContent>
      </Card>

      <Button type="submit" disabled={isPending}>
        {isPending ? "Emitiendo..." : mode === "direct" ? "Emitir DTE" : "Emitir vía Acepta"}
      </Button>

      {isSuccess && (
        <p className="text-sm text-green-600">
          Documento emitido correctamente. Folio: {successData?.folio ?? "N/A"}
        </p>
      )}
      {isError && (
        <p className="text-sm text-destructive">
          Error al emitir: {error?.message}
        </p>
      )}
    </form>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/components/emit/emit-form.tsx
git commit -m "feat(web): emit form with direct/bridge mode and live totals"
```

---

### Task 5: Update emit proxy to forward cookie header

**Files:**
- Modify: `apps/web/app/api/dte/emit/route.ts`
- Modify: `apps/web/app/api/dte/emit-bridge/route.ts`

- [ ] **Step 1: Forward cookie in emit proxy**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const idempotencyKey = req.headers.get('idempotency-key')
  const cookie = req.headers.get('cookie')

  const extraHeaders: Record<string, string> = {}
  if (idempotencyKey) extraHeaders['idempotency-key'] = idempotencyKey
  if (cookie) extraHeaders['Cookie'] = cookie

  const { status, data } = await apiFetch('/dte/emit', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: extraHeaders,
  })

  return NextResponse.json(data, { status })
}
```

- [ ] **Step 2: Forward cookie in emit-bridge proxy**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const idempotencyKey = req.headers.get('idempotency-key')
  const cookie = req.headers.get('cookie')

  const extraHeaders: Record<string, string> = {}
  if (idempotencyKey) extraHeaders['idempotency-key'] = idempotencyKey
  if (cookie) extraHeaders['Cookie'] = cookie

  const { status, data } = await apiFetch('/dte/emit-bridge', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: extraHeaders,
  })

  return NextResponse.json(data, { status })
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/dte/emit/route.ts apps/web/app/api/dte/emit-bridge/route.ts
git commit -m "fix(web): forward cookie in emit and emit-bridge proxies"
```

---

### Task 6: Test end-to-end

**Files:**
- None (testing only)

- [ ] **Step 1: Start the API server**

Run: `pnpm --filter api dev`
Expected: API starts on `http://localhost:3001`, health check responds

- [ ] **Step 2: Start the web dev server**

Run: `pnpm --filter web dev`
Expected: Next.js starts on `http://localhost:3000`

- [ ] **Step 3: Verify dashboard loads real data**

1. Open `http://localhost:3000` in browser
2. Log in with Clerk
3. Verify stats cards show numbers (not all 0)
4. Verify "Documentos recientes" table shows data or "No hay documentos"

- [ ] **Step 4: Verify document list page**

1. Navigate to `/documents`
2. Verify filter buttons work (Todos, Pendientes, Aceptados, etc.)
3. Verify table shows documents

- [ ] **Step 5: Verify emit flow (direct mode)**

1. Click "Emitir DTE" from dashboard
2. Fill receptor: RUT `76.123.456-7`, name `Test Company`, address `Santiago`
3. Add item: description `Test`, quantity `2`, unit price `10000`
4. Verify totals update: Neto $20.000, IVA $3.800, Total $23.800
5. Click "Emitir DTE"
6. Verify success message with folio number
7. Verify redirect to `/documents` after 1.5s

- [ ] **Step 6: Verify emit flow (bridge mode)**

1. Click "Bridge (Acepta)" button
2. Fill same data as Step 5
3. Click "Emitir vía Acepta"
4. Verify success message (folio will be 0 or N/A for bridge)
5. Verify document appears in list with status PENDING

---

## Spec Coverage Check

| Spec Requirement | Task |
|-----------------|------|
| Dashboard usa proxy `/api/*` en lugar de `apiFetch` directo | Task 3 |
| `api-server.ts` reenvía `cookie` | Task 1 |
| Modo direct/bridge funcional en formulario | Task 4 |
| Cálculo de totales en tiempo real (neto, IVA, total) | Task 4 |
| Resumen visual de totales | Task 4 |
| Proxy emit/emit-bridge reenvía cookie | Task 5 |

All requirements covered.

## Placeholder Scan

- No TBDs, TODOs, or incomplete sections.
- All code blocks contain complete, copy-pasteable code.
- All commands have expected output.
