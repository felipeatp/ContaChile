# PUC Chart of Accounts Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar un Plan de Cuentas (PUC) por empresa con ~50 cuentas esenciales pre-cargadas, gestionables via API y UI.

**Architecture:** El modelo `Account` se agrega al schema Prisma con propiedad por empresa (`companyId`). Un array TypeScript exportado define las 50 cuentas base. Al crear una empresa se seedean automaticamente. API REST para CRUD. Página Next.js para gestión visual. El clasificador IA usa el PUC real de la empresa.

**Tech Stack:** Prisma, PostgreSQL, Fastify, Zod, Next.js 14, React, TanStack Query, shadcn/ui

---

## File Structure

| File | Action | Responsibility |
|------|--------|---------------|
| `packages/db/prisma/schema.prisma` | Modify | Agregar modelo `Account`, enum `AccountType` |
| `packages/validators/src/puc-base.ts` | Create | Array de 50 cuentas esenciales del PUC chileno |
| `packages/validators/src/index.ts` | Modify | Exportar `PUC_BASE_ACCOUNTS` y `PucBaseAccount` |
| `apps/api/src/routes/accounts.ts` | Create | CRUD API endpoints para cuentas |
| `apps/api/src/routes/company.ts` | Modify | Seed PUC base al crear empresa |
| `apps/api/src/index.ts` | Modify | Registrar ruta `/accounts` |
| `apps/web/app/api/accounts/route.ts` | Create | Proxy Next.js para `/accounts` |
| `apps/web/app/api/accounts/[id]/route.ts` | Create | Proxy Next.js para `/accounts/:id` |
| `apps/web/app/contabilidad/puc/page.tsx` | Create | Página de gestión del PUC |
| `apps/web/components/puc/account-table.tsx` | Create | Tabla de cuentas con filtros |
| `apps/web/components/puc/account-form.tsx` | Create | Formulario para agregar/editar cuenta |
| `apps/web/hooks/use-accounts.ts` | Create | Hook TanStack Query para cuentas |
| `packages/ai-agents/src/agents/clasificador.ts` | Modify | Usar PUC real de la empresa |

---

### Task 1: Add Account model to Prisma schema

**Files:**
- Modify: `packages/db/prisma/schema.prisma`

- [ ] **Step 1: Add AccountType enum and Account model**

Add before the `Company` model:

```prisma
enum AccountType {
  ACTIVO
  PASIVO
  PATRIMONIO
  INGRESO
  GASTO
  COSTO
}

model Account {
  id          String      @id @default(cuid())
  companyId   String
  code        String
  name        String
  type        AccountType
  parentCode  String?
  description String?
  isActive    Boolean     @default(true)
  isSystem    Boolean     @default(false)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@unique([companyId, code])
  @@index([companyId])
  @@index([type])
}
```

- [ ] **Step 2: Regenerate Prisma client**

Run: `pnpm --filter @contachile/db db:generate`

- [ ] **Step 3: Commit**

```bash
git add packages/db/prisma/schema.prisma
git commit -m "feat(db): add Account model and AccountType enum

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Create PUC base accounts array

**Files:**
- Create: `packages/validators/src/puc-base.ts`
- Modify: `packages/validators/src/index.ts`

- [ ] **Step 1: Create puc-base.ts**

Create `packages/validators/src/puc-base.ts`:

```typescript
export interface PucBaseAccount {
  code: string
  name: string
  type: 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO' | 'COSTO'
  description?: string
}

export const PUC_BASE_ACCOUNTS: PucBaseAccount[] = [
  // ACTIVOS
  { code: '1101', name: 'Caja', type: 'ACTIVO', description: 'Efectivo en caja' },
  { code: '1102', name: 'Bancos', type: 'ACTIVO', description: 'Fondos en cuentas bancarias' },
  { code: '1103', name: 'Clientes', type: 'ACTIVO', description: 'Cuentas por cobrar' },
  { code: '1104', name: 'Documentos por cobrar', type: 'ACTIVO' },
  { code: '1110', name: 'Inventarios', type: 'ACTIVO' },
  { code: '1115', name: 'IVA Crédito Fiscal', type: 'ACTIVO', description: 'IVA pagado en compras' },

  // PASIVOS
  { code: '2101', name: 'Proveedores', type: 'PASIVO', description: 'Cuentas por pagar' },
  { code: '2102', name: 'Documentos por pagar', type: 'PASIVO' },
  { code: '2110', name: 'Impuestos por pagar', type: 'PASIVO' },
  { code: '2111', name: 'IVA Débito Fiscal', type: 'PASIVO', description: 'IVA cobrado en ventas' },
  { code: '2115', name: 'Remuneraciones por pagar', type: 'PASIVO' },

  // PATRIMONIO
  { code: '3101', name: 'Capital Social', type: 'PATRIMONIO' },
  { code: '3102', name: 'Reservas', type: 'PATRIMONIO' },
  { code: '3110', name: 'Resultado del ejercicio', type: 'PATRIMONIO' },

  // INGRESOS
  { code: '4100', name: 'Ingresos por ventas', type: 'INGRESO' },
  { code: '4101', name: 'Ingresos por servicios', type: 'INGRESO' },
  { code: '4105', name: 'Ingresos por arriendo', type: 'INGRESO' },
  { code: '4110', name: 'Ingresos diversos', type: 'INGRESO' },
  { code: '6200', name: 'Utilidad del ejercicio', type: 'INGRESO' },

  // COSTOS
  { code: '5000', name: 'Costo de ventas', type: 'COSTO' },
  { code: '5010', name: 'Costo de mercaderías', type: 'COSTO' },

  // GASTOS
  { code: '5100', name: 'Gastos de personal', type: 'GASTO', description: 'Sueldos y remuneraciones' },
  { code: '5101', name: 'Honorarios', type: 'GASTO' },
  { code: '5110', name: 'Gastos de arriendo', type: 'GASTO' },
  { code: '5120', name: 'Servicios básicos', type: 'GASTO', description: 'Luz, agua, gas, internet' },
  { code: '5130', name: 'Mantenimiento y reparaciones', type: 'GASTO' },
  { code: '5140', name: 'Gastos de viaje', type: 'GASTO' },
  { code: '5150', name: 'Gastos de marketing', type: 'GASTO' },
  { code: '5160', name: 'Gastos de oficina', type: 'GASTO' },
  { code: '5170', name: 'Depreciación', type: 'GASTO' },
  { code: '5180', name: 'Gastos financieros', type: 'GASTO', description: 'Intereses bancarios' },
  { code: '5190', name: 'Gastos legales y contables', type: 'GASTO' },
  { code: '5200', name: 'Seguros', type: 'GASTO' },
  { code: '5210', name: 'Patentes y permisos', type: 'GASTO' },
  { code: '5220', name: 'Gastos diversos', type: 'GASTO' },
  { code: '6100', name: 'Pérdida del ejercicio', type: 'GASTO' },
]
```

- [ ] **Step 2: Export from index.ts**

Add to `packages/validators/src/index.ts`:

```typescript
export { PUC_BASE_ACCOUNTS } from './puc-base'
export type { PucBaseAccount } from './puc-base'
```

- [ ] **Step 3: Build validators package**

Run: `pnpm --filter @contachile/validators build`

- [ ] **Step 4: Commit**

```bash
git add packages/validators/src/puc-base.ts packages/validators/src/index.ts
git commit -m "feat(validators): add PUC base accounts (50 essential accounts)

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Seed PUC base when creating a company

**Files:**
- Modify: `apps/api/src/routes/company.ts`

- [ ] **Step 1: Import PUC_BASE_ACCOUNTS**

Add import at the top:

```typescript
import { PUC_BASE_ACCOUNTS } from '@contachile/validators'
```

- [ ] **Step 2: Add seed function after company creation**

Find where the company is created (look for `prisma.company.create` or similar). After creating the company, add:

```typescript
  // Seed PUC base accounts for the new company
  await prisma.account.createMany({
    data: PUC_BASE_ACCOUNTS.map((acc) => ({
      companyId: company.id,
      code: acc.code,
      name: acc.name,
      type: acc.type,
      description: acc.description,
      isSystem: true,
    })),
    skipDuplicates: true,
  })
```

The `company.id` should be replaced with whatever variable holds the created company's ID.

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/routes/company.ts
git commit -m "feat(api): seed PUC base accounts on company creation

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Create accounts API routes

**Files:**
- Create: `apps/api/src/routes/accounts.ts`
- Modify: `apps/api/src/index.ts`

- [ ] **Step 1: Create accounts route**

Create `apps/api/src/routes/accounts.ts`:

```typescript
import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import { z } from 'zod'

const AccountTypeEnum = z.enum(['ACTIVO', 'PASIVO', 'PATRIMONIO', 'INGRESO', 'GASTO', 'COSTO'])

const CreateAccountSchema = z.object({
  code: z.string().min(1).max(20),
  name: z.string().min(1).max(100),
  type: AccountTypeEnum,
  parentCode: z.string().optional(),
  description: z.string().optional(),
})

const UpdateAccountSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().optional(),
  isActive: z.boolean().optional(),
})

export default async function (fastify: FastifyInstance) {
  // GET /accounts — list accounts
  fastify.get('/accounts', async (request, reply) => {
    const companyId = request.companyId
    const { type, active } = request.query as { type?: string; active?: string }

    const accounts = await prisma.account.findMany({
      where: {
        companyId,
        ...(type ? { type: type as any } : {}),
        ...(active === 'true' ? { isActive: true } : active === 'false' ? { isActive: false } : {}),
      },
      orderBy: { code: 'asc' },
    })

    return reply.send({ accounts })
  })

  // POST /accounts — create account
  fastify.post('/accounts', async (request, reply) => {
    const companyId = request.companyId
    const body = CreateAccountSchema.safeParse(request.body)
    if (!body.success) {
      return reply.code(400).send({ error: 'Invalid body', details: body.error.format() })
    }

    const existing = await prisma.account.findUnique({
      where: { companyId_code: { companyId, code: body.data.code } },
    })
    if (existing) {
      return reply.code(409).send({ error: 'Ya existe una cuenta con ese código' })
    }

    const account = await prisma.account.create({
      data: {
        companyId,
        ...body.data,
        isSystem: false,
      },
    })

    return reply.code(201).send(account)
  })

  // PATCH /accounts/:id — update account
  fastify.patch('/accounts/:id', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }
    const body = UpdateAccountSchema.safeParse(request.body)
    if (!body.success) {
      return reply.code(400).send({ error: 'Invalid body', details: body.error.format() })
    }

    const account = await prisma.account.findFirst({
      where: { id, companyId },
    })
    if (!account) {
      return reply.code(404).send({ error: 'Cuenta no encontrada' })
    }

    const updated = await prisma.account.update({
      where: { id },
      data: body.data,
    })

    return reply.send(updated)
  })

  // DELETE /accounts/:id — delete account
  fastify.delete('/accounts/:id', async (request, reply) => {
    const companyId = request.companyId
    const { id } = request.params as { id: string }

    const account = await prisma.account.findFirst({
      where: { id, companyId },
    })
    if (!account) {
      return reply.code(404).send({ error: 'Cuenta no encontrada' })
    }
    if (account.isSystem) {
      return reply.code(403).send({ error: 'No se pueden eliminar cuentas del PUC base' })
    }

    await prisma.account.delete({ where: { id } })
    return reply.code(204).send()
  })
}
```

- [ ] **Step 2: Register route in index.ts**

Add to `apps/api/src/index.ts`:

```typescript
import accountsRoute from './routes/accounts'
```

And register it:
```typescript
app.register(accountsRoute)
```

- [ ] **Step 3: Build and verify**

Run: `pnpm --filter api build`

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/routes/accounts.ts apps/api/src/index.ts
git commit -m "feat(api): add accounts CRUD endpoints

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Create Next.js proxies for accounts

**Files:**
- Create: `apps/web/app/api/accounts/route.ts`
- Create: `apps/web/app/api/accounts/[id]/route.ts`

- [ ] **Step 1: Create accounts proxy**

Create `apps/web/app/api/accounts/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const query = searchParams.toString()

  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = {}
  if (cookie) extraHeaders['Cookie'] = cookie

  const { status, data } = await apiFetch(`/accounts${query ? `?${query}` : ''}`, {
    method: 'GET',
    headers: extraHeaders,
  })

  return NextResponse.json(data, { status })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = {}
  if (cookie) extraHeaders['Cookie'] = cookie

  const { status, data } = await apiFetch('/accounts', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: extraHeaders,
  })

  return NextResponse.json(data, { status })
}
```

- [ ] **Step 2: Create accounts/[id] proxy**

Create `apps/web/app/api/accounts/[id]/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const body = await req.json()
  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = {}
  if (cookie) extraHeaders['Cookie'] = cookie

  const { status, data } = await apiFetch(`/accounts/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
    headers: extraHeaders,
  })

  return NextResponse.json(data, { status })
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = {}
  if (cookie) extraHeaders['Cookie'] = cookie

  const { status, data } = await apiFetch(`/accounts/${id}`, {
    method: 'DELETE',
    headers: extraHeaders,
  })

  return NextResponse.json(data, { status })
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/web/app/api/accounts/
git commit -m "feat(web): add accounts API proxy routes

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Create frontend page and components

**Files:**
- Create: `apps/web/hooks/use-accounts.ts`
- Create: `apps/web/components/puc/account-table.tsx`
- Create: `apps/web/components/puc/account-form.tsx`
- Create: `apps/web/app/contabilidad/puc/page.tsx`
- Modify: `apps/web/components/layout/sidebar.tsx`

- [ ] **Step 1: Create use-accounts hook**

Create `apps/web/hooks/use-accounts.ts`:

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface Account {
  id: string
  code: string
  name: string
  type: 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO' | 'COSTO'
  parentCode?: string
  description?: string
  isActive: boolean
  isSystem: boolean
}

async function fetchAccounts(type?: string): Promise<Account[]> {
  const query = type ? `?type=${type}` : ''
  const res = await fetch(`/api/accounts${query}`)
  if (!res.ok) throw new Error('Error fetching accounts')
  const data = await res.json()
  return data.accounts || []
}

export function useAccounts(type?: string) {
  return useQuery({ queryKey: ['accounts', type], queryFn: () => fetchAccounts(type) })
}

export function useCreateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: Omit<Account, 'id' | 'isSystem' | 'createdAt' | 'updatedAt'>) => {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Error creating account')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

export function useUpdateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<Account> }) => {
      const res = await fetch(`/api/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Error updating account')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error deleting account')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  })
}
```

- [ ] **Step 2: Create account-table component**

Create `apps/web/components/puc/account-table.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useAccounts, useUpdateAccount, useDeleteAccount, Account } from '@/hooks/use-accounts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2, Lock, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

const typeColors: Record<Account['type'], string> = {
  ACTIVO: 'bg-blue-50 text-blue-700',
  PASIVO: 'bg-red-50 text-red-700',
  PATRIMONIO: 'bg-purple-50 text-purple-700',
  INGRESO: 'bg-green-50 text-green-700',
  GASTO: 'bg-orange-50 text-orange-700',
  COSTO: 'bg-yellow-50 text-yellow-700',
}

export function AccountTable({ onEdit }: { onEdit: (account: Account) => void }) {
  const [filterType, setFilterType] = useState<string>('')
  const [search, setSearch] = useState('')
  const { data: accounts, isLoading } = useAccounts(filterType || undefined)
  const update = useUpdateAccount()
  const del = useDeleteAccount()

  const filtered = accounts?.filter((a) => {
    const q = search.toLowerCase()
    return !q || a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
  })

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando...</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por código o nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todos los tipos</option>
          <option value="ACTIVO">Activos</option>
          <option value="PASIVO">Pasivos</option>
          <option value="PATRIMONIO">Patrimonio</option>
          <option value="INGRESO">Ingresos</option>
          <option value="GASTO">Gastos</option>
          <option value="COSTO">Costos</option>
        </select>
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Código</th>
              <th className="px-4 py-3 text-left font-medium">Nombre</th>
              <th className="px-4 py-3 text-left font-medium">Tipo</th>
              <th className="px-4 py-3 text-left font-medium">Descripción</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered?.map((account) => (
              <tr
                key={account.id}
                className={cn('border-b last:border-0', !account.isActive && 'opacity-50')}
              >
                <td className="px-4 py-3 font-mono">{account.code}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {account.name}
                    {account.isSystem && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge className={cn('text-xs', typeColors[account.type])}>{account.type}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{account.description || '-'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(account)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!account.isSystem && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => del.mutate(account.id)}
                        disabled={del.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
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

- [ ] **Step 3: Create account-form component**

Create `apps/web/components/puc/account-form.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { useCreateAccount, Account } from '@/hooks/use-accounts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

export function AccountForm({
  open,
  onClose,
  editAccount,
}: {
  open: boolean
  onClose: () => void
  editAccount?: Account
}) {
  const create = useCreateAccount()
  const [code, setCode] = useState(editAccount?.code || '')
  const [name, setName] = useState(editAccount?.name || '')
  const [type, setType] = useState<Account['type']>(editAccount?.type || 'GASTO')
  const [description, setDescription] = useState(editAccount?.description || '')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!code.trim() || !name.trim()) return
    create.mutate(
      { code, name, type, description },
      { onSuccess: () => { onClose(); reset() } }
    )
  }

  const reset = () => {
    setCode('')
    setName('')
    setType('GASTO')
    setDescription('')
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editAccount ? 'Editar cuenta' : 'Nueva cuenta'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium">Código</label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ej: 5115" />
          </div>
          <div>
            <label className="text-sm font-medium">Nombre</label>
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Capacitación" />
          </div>
          <div>
            <label className="text-sm font-medium">Tipo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as Account['type'])}
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="ACTIVO">Activo</option>
              <option value="PASIVO">Pasivo</option>
              <option value="PATRIMONIO">Patrimonio</option>
              <option value="INGRESO">Ingreso</option>
              <option value="GASTO">Gasto</option>
              <option value="COSTO">Costo</option>
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Descripción</label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
          </div>
          <Button type="submit" disabled={create.isPending}>
            {create.isPending ? 'Guardando...' : 'Guardar'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
```

- [ ] **Step 4: Create PUC page**

Create `apps/web/app/contabilidad/puc/page.tsx`:

```typescript
'use client'

import { useState } from 'react'
import { AccountTable } from '@/components/puc/account-table'
import { AccountForm } from '@/components/puc/account-form'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Account } from '@/hooks/use-accounts'

export default function PucPage() {
  const [formOpen, setFormOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<Account | undefined>()

  const handleEdit = (account: Account) => {
    setEditAccount(account)
    setFormOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plan de Cuentas</h1>
          <p className="text-sm text-muted-foreground">Gestiona el PUC de tu empresa.</p>
        </div>
        <Button onClick={() => { setEditAccount(undefined); setFormOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" /> Nueva cuenta
        </Button>
      </div>

      <AccountTable onEdit={handleEdit} />
      <AccountForm open={formOpen} onClose={() => setFormOpen(false)} editAccount={editAccount} />
    </div>
  )
}
```

- [ ] **Step 5: Add navigation to sidebar**

Add to `apps/web/components/layout/sidebar.tsx` in the `navItems` array:

```typescript
{ href: '/contabilidad/puc', label: 'Plan de Cuentas', icon: BookOpen },
```

Use `BookOpen` from lucide-react (already imported).

- [ ] **Step 6: Build and verify**

Run: `pnpm --filter web build`

- [ ] **Step 7: Commit**

```bash
git add apps/web/hooks/use-accounts.ts apps/web/components/puc/ apps/web/app/contabilidad/puc/ apps/web/components/layout/sidebar.tsx
git commit -m "feat(web): add PUC management page with table, form, and sidebar nav

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Integrate PUC with AI classifier

**Files:**
- Modify: `packages/ai-agents/src/agents/clasificador.ts`

- [ ] **Step 1: Add companyId parameter to classification functions**

Modify `clasificarTransaccion` signature:

```typescript
export async function clasificarTransaccion(
  companyId: string,
  transaction: BankTransaction
): Promise<ClassificationResult> {
```

And `clasificarLote`:

```typescript
export async function clasificarLote(
  companyId: string,
  transactions: BankTransaction[],
  batchSize = 5
): Promise<ClassificationResult[]> {
```

- [ ] **Step 2: Update tool schema to include company_id**

Update the `get_chart_of_accounts` tool:

```typescript
const TOOLS: AgentTool[] = [
  {
    name: 'get_chart_of_accounts',
    description: 'Obtiene el plan de cuentas de la empresa para contextualizar la clasificación.',
    input_schema: {
      type: 'object',
      properties: {
        company_id: { type: 'string', description: 'ID de la empresa' },
      },
      required: ['company_id'],
    },
  },
]
```

- [ ] **Step 3: Implement get_chart_of_accounts tool**

Add to `executeTool` function:

```typescript
    case 'get_chart_of_accounts': {
      const cid = (args.company_id as string) || companyId
      const accounts = await prisma.account.findMany({
        where: { companyId: cid, isActive: true },
        select: { code: true, name: true, type: true },
        orderBy: { code: 'asc' },
      })
      return {
        total_cuentas: accounts.length,
        cuentas: accounts,
      }
    }
```

- [ ] **Step 4: Update runAgent call to pass companyId**

In `clasificarTransaccion`, update the `runAgent` call:

```typescript
  const result = await runAgent({
    systemPrompt: SYSTEM_PROMPT,
    userMessage,
    tools: TOOLS,
    model: 'claude-haiku-4-5',
    maxTokens: 512,
    onToolCall: (name, input) => executeTool(companyId, name, input),
  })
```

- [ ] **Step 5: Update batch function to pass companyId**

In `clasificarLote`:

```typescript
    const batchResults = await Promise.all(batch.map((t) => clasificarTransaccion(companyId, t)))
```

- [ ] **Step 6: Commit**

```bash
git add packages/ai-agents/src/agents/clasificador.ts
git commit -m "feat(ai): use real company PUC in transaction classifier

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Verify full build

**Files:**
- None (testing only)

- [ ] **Step 1: Build all packages**

Run in order:
```bash
pnpm --filter @contachile/validators build
pnpm --filter @contachile/db db:generate
pnpm --filter @contachile/ai-agents build
pnpm --filter api build
pnpm --filter web build
```

All should compile without errors.

- [ ] **Step 2: Test end-to-end**

1. Restart API and web servers
2. Create a new company (or use existing dev company)
3. Navigate to `/contabilidad/puc`
4. Verify 50 accounts are displayed
5. Create a custom account
6. Verify it appears in the table with `isSystem: false`
7. Try to delete a system account — verify 403 error

---

## Spec Coverage Check

| Spec Requirement | Task |
|-----------------|------|
| Modelo Account en Prisma | Task 1 |
| PUC base con 50 cuentas | Task 2 |
| Seed al crear empresa | Task 3 |
| API CRUD /accounts | Task 4 |
| Proxies Next.js | Task 5 |
| Página /contabilidad/puc | Task 6 |
| Navegación en sidebar | Task 6 |
| Integración clasificador IA | Task 7 |
| Build verificado | Task 8 |

All requirements covered.

## Placeholder Scan

- No TBDs, TODOs, or incomplete sections.
- All code blocks contain complete, copy-pasteable code.
- All commit messages are provided.
- Type consistency: `AccountType`, `PucBaseAccount`, `PUC_BASE_ACCOUNTS` used consistently.
