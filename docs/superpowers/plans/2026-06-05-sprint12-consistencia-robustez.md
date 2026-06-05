# Sprint 12 — Consistencia y Robustez UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Corregir un bug de datos del dashboard, unificar el feedback de la app (cero `alert()`/`confirm()` nativos), hacer accesible el menú de usuario, dar estados de error a las listas, debouncear búsquedas y poner al día la documentación del repo.

**Architecture:** Monorepo Turborepo (`apps/web` Next.js 14 App Router, `apps/api` Fastify, `packages/*`). El web habla con el API vía `apiFetch` (server, reenvía cookie) y `apiClient` (client, pega a las API routes de Next). Tenancy por `request.companyId` en el API. React Query para estado de servidor en cliente; `sonner` para toasts; Radix para overlays.

**Tech Stack:** Next.js 14, React 18, TypeScript, Fastify, Prisma, ioredis, React Query (TanStack), sonner, Radix UI, Recharts, Vitest, Playwright, Tailwind.

**Spec:** `docs/superpowers/specs/2026-06-05-sprint12-consistencia-robustez-design.md`

**Orden:** F (deuda) → E (debounce) → D (QueryState) → B (toasts/confirm) → C (menú) → A (stats). Cada tarea cierra con commit.

---

## File Structure

**Crear:**
- `apps/web/hooks/use-debounce.ts` — hook genérico de debounce.
- `apps/web/components/ui/query-state.tsx` — wrapper loading/error/empty para listas.
- `apps/web/components/ui/confirm-provider.tsx` — provider + hook `useConfirm()` global.
- `apps/web/app/(app)/loading.tsx` — skeleton de navegación para Server Components.
- `apps/web/components/dashboard/__tests__/` y hooks tests (Vitest/Jest según config web).
- `apps/web/e2e/sprint12.spec.ts` — E2E menú accesible, retry, confirm.
- `apps/api/tests/dte/documents-stats.test.ts` — tests del endpoint stats.

**Modificar:**
- `CLAUDE.md` — reescribir (ya no es doc-only).
- `apps/api/src/routes/dte/documents.ts` — agregar `GET /documents/stats`.
- `apps/web/app/api/documents/stats/route.ts` — (crear) proxy Next → API.
- `apps/web/lib/api-server.ts` — ya sirve; se usa tal cual.
- `apps/web/app/(app)/dashboard/page.tsx` — usar stats directo, sin `limit=1000`.
- `apps/web/components/dashboard/stats-cards.tsx|documents-chart.tsx|status-chart.tsx` — props `DocumentStats`.
- `apps/web/components/layout/header.tsx` — `UserMenu` con Radix dropdown.
- `apps/web/app/(app)/layout.tsx` — montar `ConfirmProvider`.
- `apps/web/app/(app)/documents/page.tsx` — debounce + QueryState + toasts.
- Páginas con `alert()`/`confirm()`: `banco/conciliacion`, `documents/[id]`, `ventas/cotizaciones`, `honorarios`, `inventario/productos`, `contador/tesoreria/conciliacion`.
- `apps/web/types/index.ts` (o `@contachile/validators`) — tipo `DocumentStats`.
- `.gitignore` y raíz — mover scratch files.

**Tipo compartido (definir en `apps/web/types/index.ts`):**

```ts
export interface DocumentStats {
  total: number
  emittedToday: number
  byStatus: { pending: number; accepted: number; rejected: number; failed: number }
  monthly: Array<{ month: string; count: number; totalAmount: number }>
  yoy: { current: number; previous: number; deltaPct: number }
}
```

---

# FASE F — Deuda menor

## Task F1: Mover scratch files de la raíz

**Files:**
- Move: `check-tables.mjs`, `create-auth-tables.mjs` → `scripts/`
- Modify: `.gitignore`
- Delete from git tracking: `login-test.png`, `login-test-2.png`, `mobile-dashboard.png`, `mobile-landing.png`

- [ ] **Step 1: Mover los scripts**

```bash
git mv check-tables.mjs scripts/check-tables.mjs
git mv create-auth-tables.mjs scripts/create-auth-tables.mjs
```

- [ ] **Step 2: Dejar de versionar capturas y agregarlas a .gitignore**

Agregar al final de `.gitignore`:

```gitignore
# Capturas de prueba / scratch
/login-test*.png
/mobile-*.png
```

Quitar del índice (deja el archivo local):

```bash
git rm --cached login-test.png login-test-2.png mobile-dashboard.png mobile-landing.png
```

- [ ] **Step 3: Verificar que el build no referenciaba esas rutas**

Run: `git grep -n "check-tables.mjs\|create-auth-tables.mjs\|login-test\|mobile-dashboard\|mobile-landing"`
Expected: solo referencias dentro de `scripts/` o ninguna en código de app. Si aparece en `package.json`, actualizar la ruta a `scripts/`.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore(sprint12): mover scripts a scripts/ e ignorar capturas de prueba"
```

## Task F2: Reescribir CLAUDE.md

**Files:**
- Modify: `CLAUDE.md` (reemplazo completo)

- [ ] **Step 1: Reescribir el archivo**

Reemplazar TODO el contenido de `CLAUDE.md` por:

```markdown
# CLAUDE.md

Guía para Claude Code al trabajar en este repositorio.

## Qué es

**ContAI / ContaChile** — SaaS chileno de contabilidad y tributación (DTE, F29/F22,
remuneraciones, inventario, conciliación bancaria, agentes IA). Monorepo Turborepo en
producción, NO es documentación-only.

## Estructura

\`\`\`
apps/web        — Next.js 14 (App Router) — dashboard + API routes (proxy)
apps/api        — Fastify REST API
apps/mobile     — app móvil
packages/dte    — generación XML DTE, firma, envoltorio SII
packages/db     — Prisma schema + cliente
packages/auth   — Better Auth
packages/validators — esquemas Zod + helpers (RUT, IVA, formato CLP)
packages/ai-agents  — agentes Claude (tool use)
packages/transport-sii / transport-acepta / fintoc-client — clientes externos
docs/superpowers/specs  — diseños (brainstorming)
docs/superpowers/plans  — planes de implementación
\`\`\`

## Comandos

\`\`\`bash
pnpm dev                         # turbo: todos los servicios
pnpm build                       # turbo build
pnpm test                        # turbo test
pnpm lint                        # turbo lint
pnpm --filter web dev            # solo web
pnpm --filter api dev            # solo api
pnpm --filter @contachile/dte test
\`\`\`

## Patrones clave

- **Tenancy:** el API resuelve la empresa en `apps/api/src/plugins/tenant.ts` →
  `request.companyId`. TODA query de datos filtra por `companyId`.
- **Web → API:** Server Components usan `apps/web/lib/api-server.ts` (`apiFetch`) que
  reenvía cookie/headers vía `headers()`. Componentes cliente usan
  `apps/web/lib/api-client.ts` (`apiClient`) que pega a las API routes de Next en
  `apps/web/app/api/*`, las cuales reenvían al Fastify. NO hacer `fetch` directo a la
  API propia sin reenviar cookie desde un Server Component.
- **Feedback UI:** toasts con `sonner` (`toast.success/error/info`); confirmaciones con
  `useConfirm()` (`components/ui/confirm-provider.tsx`). Nunca `alert()`/`confirm()`.
- **Estado servidor:** React Query. Listas envuelven con `<QueryState>`.
- **Design system:** tokens en `apps/web/app/globals.css` (paleta editorial
  oxblood/ochre/sage/rust), serif display, `tabular-nums` en números. Ver reglas en
  `~/.claude/rules/ecc/web`.

## Restricciones de dominio

- **RUT:** validación módulo 11 (`@contachile/validators`).
- **IVA:** 19% del neto, truncado a entero.
- **DTE:** XML en ISO-8859-1 (no UTF-8).
- **Certificación SII:** maullin.sii.cl (test) / api.sii.cl (prod). Bridge Acepta para MVP.

## Testing

- API: Vitest en `apps/api/tests/`. Web unit: en `apps/web/__tests__`. E2E: Playwright
  en `apps/web/e2e/`. Gate de cobertura 80% en CI.
\`\`\`
```

> Nota: en el bloque anterior los \` triples van sin escapar en el archivo real; aquí
> se muestran escapados solo para el plan.

- [ ] **Step 2: Verificar que no quedó la frase obsoleta**

Run: `git grep -n "documentation-only\|no active codebase" CLAUDE.md`
Expected: sin resultados.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(sprint12): reescribir CLAUDE.md al estado real del monorepo"
```

## Task F3: loading.tsx para el grupo (app)

**Files:**
- Create: `apps/web/app/(app)/loading.tsx`

- [ ] **Step 1: Crear el skeleton de navegación**

```tsx
export default function AppLoading() {
  return (
    <div className="space-y-8 animate-pulse" aria-busy="true" aria-live="polite">
      <div className="space-y-3">
        <div className="h-3 w-40 rounded-sm bg-secondary" />
        <div className="h-9 w-72 rounded-sm bg-secondary" />
        <div className="h-4 w-96 rounded-sm bg-secondary/60" />
      </div>
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-sm border border-border bg-card" />
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="h-64 rounded-sm border border-border bg-card" />
        <div className="h-64 rounded-sm border border-border bg-card" />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verificar build**

Run: `pnpm --filter web build`
Expected: compila sin errores (o `pnpm --filter web lint` si build es lento).

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(app)/loading.tsx"
git commit -m "feat(sprint12): loading.tsx skeleton para navegación de (app)"
```

---

# FASE E — Debounce en búsquedas

## Task E1: Hook useDebounce (TDD)

**Files:**
- Create: `apps/web/hooks/use-debounce.ts`
- Test: `apps/web/__tests__/use-debounce.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

```tsx
import { renderHook, act } from "@testing-library/react"
import { useDebounce } from "@/hooks/use-debounce"

jest.useFakeTimers()

describe("useDebounce", () => {
  it("devuelve el valor inicial de inmediato", () => {
    const { result } = renderHook(() => useDebounce("a", 300))
    expect(result.current).toBe("a")
  })

  it("retrasa la actualización hasta que pasa el delay", () => {
    const { result, rerender } = renderHook(
      ({ v }) => useDebounce(v, 300),
      { initialProps: { v: "a" } }
    )
    rerender({ v: "ab" })
    expect(result.current).toBe("a")
    act(() => { jest.advanceTimersByTime(300) })
    expect(result.current).toBe("ab")
  })

  it("cancela el valor intermedio en cambios rápidos", () => {
    const { result, rerender } = renderHook(
      ({ v }) => useDebounce(v, 300),
      { initialProps: { v: "a" } }
    )
    rerender({ v: "ab" })
    act(() => { jest.advanceTimersByTime(150) })
    rerender({ v: "abc" })
    act(() => { jest.advanceTimersByTime(150) })
    expect(result.current).toBe("a")
    act(() => { jest.advanceTimersByTime(150) })
    expect(result.current).toBe("abc")
  })
})
```

> Nota: el web usa Jest (`apps/web/jest.config.js`). Si el runner fuera Vitest, cambiar
> `jest.useFakeTimers()` → `vi.useFakeTimers()` y `jest.advanceTimersByTime` →
> `vi.advanceTimersByTime`. Verificar antes con `cat apps/web/jest.config.js`.

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `pnpm --filter web test -- use-debounce`
Expected: FAIL — "Cannot find module '@/hooks/use-debounce'".

- [ ] **Step 3: Implementar el hook**

```ts
import { useEffect, useState } from "react"

export function useDebounce<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState<T>(value)

  useEffect(() => {
    const handler = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(handler)
  }, [value, delay])

  return debounced
}
```

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `pnpm --filter web test -- use-debounce`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/hooks/use-debounce.ts apps/web/__tests__/use-debounce.test.tsx
git commit -m "feat(sprint12): hook useDebounce con tests"
```

## Task E2: Aplicar useDebounce a la búsqueda de documentos

**Files:**
- Modify: `apps/web/app/(app)/documents/page.tsx`

- [ ] **Step 1: Importar el hook**

En `documents/page.tsx`, agregar bajo los imports existentes:

```tsx
import { useDebounce } from "@/hooks/use-debounce"
```

- [ ] **Step 2: Debouncear el valor de búsqueda antes del query**

Tras la línea `const [search, setSearch] = useState<string>("")` agregar:

```tsx
const debouncedSearch = useDebounce(search, 300)
```

Y en la llamada a `useDocuments({ ... })` cambiar:

```tsx
    search: search || undefined,
```
por:
```tsx
    search: debouncedSearch || undefined,
```

(El input sigue usando `value={search}` y `onChange={setSearch}` — sin lag visual.)

- [ ] **Step 3: Verificar typecheck/lint**

Run: `pnpm --filter web lint`
Expected: sin errores nuevos.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(app)/documents/page.tsx"
git commit -m "perf(sprint12): debounce 300ms en búsqueda de documentos"
```

---

# FASE D — Estados de error en listas

## Task D1: Componente QueryState (TDD)

**Files:**
- Create: `apps/web/components/ui/query-state.tsx`
- Test: `apps/web/__tests__/query-state.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

```tsx
import { render, screen, fireEvent } from "@testing-library/react"
import { QueryState } from "@/components/ui/query-state"

describe("QueryState", () => {
  it("muestra el contenido cuando no hay loading/error/empty", () => {
    render(
      <QueryState isLoading={false} isError={false} isEmpty={false}>
        <div>contenido</div>
      </QueryState>
    )
    expect(screen.getByText("contenido")).toBeInTheDocument()
  })

  it("muestra estado de carga", () => {
    render(
      <QueryState isLoading isError={false} isEmpty={false}>
        <div>contenido</div>
      </QueryState>
    )
    expect(screen.getByRole("status")).toBeInTheDocument()
    expect(screen.queryByText("contenido")).not.toBeInTheDocument()
  })

  it("muestra error con botón Reintentar que llama onRetry", () => {
    const onRetry = jest.fn()
    render(
      <QueryState isLoading={false} isError isEmpty={false} onRetry={onRetry}>
        <div>contenido</div>
      </QueryState>
    )
    fireEvent.click(screen.getByRole("button", { name: /reintentar/i }))
    expect(onRetry).toHaveBeenCalledTimes(1)
  })

  it("muestra mensaje vacío", () => {
    render(
      <QueryState isLoading={false} isError={false} isEmpty emptyMessage="Nada aquí">
        <div>contenido</div>
      </QueryState>
    )
    expect(screen.getByText("Nada aquí")).toBeInTheDocument()
  })
})
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `pnpm --filter web test -- query-state`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementar el componente**

```tsx
"use client"

import { Loader2, AlertTriangle, Inbox } from "lucide-react"
import { Button } from "@/components/ui/button"

interface QueryStateProps {
  isLoading: boolean
  isError: boolean
  isEmpty?: boolean
  onRetry?: () => void
  emptyMessage?: string
  errorMessage?: string
  children: React.ReactNode
}

export function QueryState({
  isLoading,
  isError,
  isEmpty = false,
  onRetry,
  emptyMessage = "Sin datos para mostrar",
  errorMessage = "No pudimos cargar la información.",
  children,
}: QueryStateProps) {
  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="flex items-center justify-center h-48"
      >
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        <span className="sr-only">Cargando…</span>
      </div>
    )
  }

  if (isError) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 h-48 text-center">
        <AlertTriangle className="h-8 w-8 text-destructive/70" />
        <p className="text-sm text-muted-foreground max-w-sm">{errorMessage}</p>
        {onRetry && (
          <Button variant="outline" size="sm" onClick={onRetry}>
            Reintentar
          </Button>
        )}
      </div>
    )
  }

  if (isEmpty) {
    return (
      <div className="flex flex-col items-center justify-center gap-2 h-48 text-center">
        <Inbox className="h-8 w-8 text-muted-foreground/50" />
        <p className="font-display text-lg text-muted-foreground">{emptyMessage}</p>
      </div>
    )
  }

  return <>{children}</>
}
```

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `pnpm --filter web test -- query-state`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/ui/query-state.tsx apps/web/__tests__/query-state.test.tsx
git commit -m "feat(sprint12): componente QueryState (loading/error+retry/empty)"
```

## Task D2: Integrar QueryState en la página de documentos

**Files:**
- Modify: `apps/web/app/(app)/documents/page.tsx`

- [ ] **Step 1: Importar y exponer isError/refetch del hook**

Agregar import:

```tsx
import { QueryState } from "@/components/ui/query-state"
```

Cambiar la desestructuración del query:

```tsx
  const { data, isLoading, isError, refetch } = useDocuments({
```

- [ ] **Step 2: Envolver la tabla con QueryState**

Reemplazar el bloque actual:

```tsx
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <>
          <DocumentTable
            documents={data?.documents || []}
            sort={sort}
            order={order}
            onSort={handleSort}
          />
          ...paginación...
        </>
      )}
```

por:

```tsx
      <QueryState
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        errorMessage="No pudimos cargar los documentos."
      >
        <DocumentTable
          documents={data?.documents || []}
          sort={sort}
          order={order}
          onSort={handleSort}
        />

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-2">
            {/* ...mantener el contenido de paginación existente tal cual... */}
          </div>
        )}
      </QueryState>
```

(El empty-state propio de `DocumentTable` se conserva — no se pasa `isEmpty`.)

- [ ] **Step 3: Verificar lint/typecheck**

Run: `pnpm --filter web lint`
Expected: sin errores. Si `Loader2` queda sin uso, quitarlo del import.

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(app)/documents/page.tsx"
git commit -m "feat(sprint12): estado de error con reintento en lista de documentos"
```

## Task D3: Integrar QueryState en las demás listas con React Query

**Files:**
- Modify (cada una, mismo patrón que D2):
  - `apps/web/app/(app)/purchases/page.tsx`
  - `apps/web/app/(app)/honorarios/page.tsx`
  - `apps/web/app/(app)/inventario/productos/page.tsx`
  - `apps/web/app/(app)/inventario/movimientos/page.tsx`
  - `apps/web/app/(app)/ventas/cotizaciones/page.tsx`
  - `apps/web/app/(app)/remuneraciones/liquidaciones/page.tsx`
  - `apps/web/app/(app)/remuneraciones/trabajadores/page.tsx`

- [ ] **Step 1: Para cada archivo, verificar que el hook expone isError/refetch**

Run (por archivo): `git grep -n "useQuery\|isLoading\|isError" <ruta>`
Si el hook se consume con `const { data, isLoading } = useX()`, agregar `isError, refetch`.
Si la página NO usa React Query (carga con `fetch`/Server Component), **omitir** ese
archivo y anotarlo; no aplica QueryState.

- [ ] **Step 2: Envolver el render de la lista con QueryState**

Patrón idéntico al de D2:

```tsx
import { QueryState } from "@/components/ui/query-state"
// ...
<QueryState
  isLoading={isLoading}
  isError={isError}
  onRetry={() => refetch()}
  errorMessage="No pudimos cargar la información."
>
  {/* render de la lista existente */}
</QueryState>
```

- [ ] **Step 3: Lint de cada archivo modificado**

Run: `pnpm --filter web lint`
Expected: sin errores. Eliminar imports de spinner que queden sin uso.

- [ ] **Step 4: Commit**

```bash
git add apps/web/app/\(app\)/
git commit -m "feat(sprint12): QueryState con reintento en listas restantes"
```

---

# FASE B — Toasts y useConfirm global

## Task B1: ConfirmProvider + useConfirm (TDD)

**Files:**
- Create: `apps/web/components/ui/confirm-provider.tsx`
- Test: `apps/web/__tests__/confirm-provider.test.tsx`

- [ ] **Step 1: Escribir el test que falla**

```tsx
import { render, screen, fireEvent, waitFor } from "@testing-library/react"
import { ConfirmProvider, useConfirm } from "@/components/ui/confirm-provider"

function Harness({ onResult }: { onResult: (v: boolean) => void }) {
  const confirm = useConfirm()
  return (
    <button
      onClick={async () => onResult(await confirm({ title: "¿Seguro?" }))}
    >
      abrir
    </button>
  )
}

describe("useConfirm", () => {
  it("resuelve true al confirmar", async () => {
    const onResult = jest.fn()
    render(
      <ConfirmProvider>
        <Harness onResult={onResult} />
      </ConfirmProvider>
    )
    fireEvent.click(screen.getByText("abrir"))
    expect(await screen.findByText("¿Seguro?")).toBeInTheDocument()
    fireEvent.click(screen.getByRole("button", { name: /confirmar/i }))
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(true))
  })

  it("resuelve false al cancelar", async () => {
    const onResult = jest.fn()
    render(
      <ConfirmProvider>
        <Harness onResult={onResult} />
      </ConfirmProvider>
    )
    fireEvent.click(screen.getByText("abrir"))
    await screen.findByText("¿Seguro?")
    fireEvent.click(screen.getByRole("button", { name: /cancelar/i }))
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(false))
  })
})
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `pnpm --filter web test -- confirm-provider`
Expected: FAIL — módulo no encontrado.

- [ ] **Step 3: Implementar el provider**

```tsx
"use client"

import { createContext, useCallback, useContext, useRef, useState } from "react"
import { ConfirmModal } from "@/components/ui/confirm-modal"

interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  destructive?: boolean
}

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn | null>(null)

export function ConfirmProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = useState(false)
  const [opts, setOpts] = useState<ConfirmOptions>({ title: "" })
  const resolverRef = useRef<((v: boolean) => void) | null>(null)

  const confirm = useCallback<ConfirmFn>((options) => {
    setOpts(options)
    setOpen(true)
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
    })
  }, [])

  const settle = (value: boolean) => {
    setOpen(false)
    resolverRef.current?.(value)
    resolverRef.current = null
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmModal
        open={open}
        title={opts.title}
        description={opts.description}
        confirmLabel={opts.confirmLabel}
        destructive={opts.destructive}
        onConfirm={() => settle(true)}
        onCancel={() => settle(false)}
      />
    </ConfirmContext.Provider>
  )
}

export function useConfirm(): ConfirmFn {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error("useConfirm debe usarse dentro de <ConfirmProvider>")
  return ctx
}
```

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `pnpm --filter web test -- confirm-provider`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/ui/confirm-provider.tsx apps/web/__tests__/confirm-provider.test.tsx
git commit -m "feat(sprint12): ConfirmProvider + useConfirm global con tests"
```

## Task B2: Montar ConfirmProvider en el layout de (app)

**Files:**
- Modify: `apps/web/app/(app)/layout.tsx`

- [ ] **Step 1: Importar y envolver**

Agregar import:

```tsx
import { ConfirmProvider } from "@/components/ui/confirm-provider"
```

Envolver el contenido del return. Cambiar:

```tsx
  return (
    <>
      <Sidebar />
      <div ...>
        ...
      </div>
      <ChatWidget />
      <Toaster ... />
    </>
  )
```

por (envolviendo todo en `<ConfirmProvider>`):

```tsx
  return (
    <ConfirmProvider>
      <Sidebar />
      <div
        className={cn(
          "transition-[padding] duration-300",
          collapsed ? "lg:pl-16" : "lg:pl-64"
        )}
      >
        <Header />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-3 focus:py-2 focus:bg-paper focus:border focus:border-foreground focus:rounded-sm"
        >
          Saltar al contenido
        </a>
        <main id="main-content" className="container py-6">
          {children}
        </main>
      </div>
      <ChatWidget />
      <Toaster position="bottom-right" richColors theme={resolvedTheme === "dark" ? "dark" : "light"} />
    </ConfirmProvider>
  )
```

- [ ] **Step 2: Verificar build**

Run: `pnpm --filter web lint`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/(app)/layout.tsx"
git commit -m "feat(sprint12): montar ConfirmProvider en layout de (app)"
```

## Task B3: Reemplazar alert() por toast en documents/page.tsx

**Files:**
- Modify: `apps/web/app/(app)/documents/page.tsx`

- [ ] **Step 1: Importar toast**

```tsx
import { toast } from "sonner"
```

- [ ] **Step 2: Reemplazar los 3 alert() de handleGenerateEnvio**

- `alert("No hay documentos pendientes con XML firmado para enviar")`
  → `toast.info("No hay documentos pendientes con XML firmado para enviar")`
- `alert(err.error || "Error al generar EnvioDTE")`
  → `toast.error(err.error || "Error al generar EnvioDTE")`
- `alert("Error al generar EnvioDTE")`
  → `toast.error("Error al generar EnvioDTE")`

- [ ] **Step 3: Verificar que no quedan alert() en el archivo**

Run: `git grep -n "alert(" "apps/web/app/(app)/documents/page.tsx"`
Expected: sin resultados (salvo `AlertTriangle`/imports, que no hacen match con `alert(`).

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(app)/documents/page.tsx"
git commit -m "feat(sprint12): toasts en lugar de alert() en lista de documentos"
```

## Task B4: Reemplazar alert() restantes por toast

**Files:**
- Modify:
  - `apps/web/app/(app)/banco/conciliacion/page.tsx`
  - `apps/web/app/(app)/documents/[id]/page.tsx`
  - `apps/web/app/(app)/ventas/cotizaciones/page.tsx`
  - `apps/web/app/contador/tesoreria/conciliacion/page.tsx`

- [ ] **Step 1: Listar todos los call sites**

Run: `git grep -n "[^.]alert(" "apps/web/app/(app)/banco/conciliacion/page.tsx" "apps/web/app/(app)/documents/[id]/page.tsx" "apps/web/app/(app)/ventas/cotizaciones/page.tsx" "apps/web/app/contador/tesoreria/conciliacion/page.tsx"`
Expected: una lista de líneas con `alert("...")`.

- [ ] **Step 2: En cada archivo, agregar import de toast (si no existe)**

```tsx
import { toast } from "sonner"
```

- [ ] **Step 3: Reemplazar cada alert() según su intención**

- Mensajes de error (contienen "Error", "No se pudo", "inválido") → `toast.error(...)`
- Mensajes informativos / validaciones ("No hay…", "Selecciona…") → `toast.info(...)`
- Mensajes de éxito ("guardado", "creado") → `toast.success(...)`

Mantener el texto exacto del mensaje original.

- [ ] **Step 4: Verificar que no quedan alert() nativos**

Run: `git grep -n "[^.]alert(" "apps/web/app/(app)/banco/conciliacion/page.tsx" "apps/web/app/(app)/documents/[id]/page.tsx" "apps/web/app/(app)/ventas/cotizaciones/page.tsx" "apps/web/app/contador/tesoreria/conciliacion/page.tsx"`
Expected: sin resultados.

- [ ] **Step 5: Lint**

Run: `pnpm --filter web lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/
git commit -m "feat(sprint12): toasts en lugar de alert() en conciliación, detalle DTE y cotizaciones"
```

## Task B5: Reemplazar confirm() por useConfirm

**Files:**
- Modify:
  - `apps/web/app/(app)/honorarios/page.tsx`
  - `apps/web/app/(app)/inventario/productos/page.tsx`
  - `apps/web/app/(app)/ventas/cotizaciones/page.tsx`

- [ ] **Step 1: Localizar cada confirm()**

Run: `git grep -n "confirm(" "apps/web/app/(app)/honorarios/page.tsx" "apps/web/app/(app)/inventario/productos/page.tsx" "apps/web/app/(app)/ventas/cotizaciones/page.tsx"`
Expected: líneas tipo `if (!confirm("¿Eliminar …?")) return`.

- [ ] **Step 2: En cada archivo, importar y obtener el hook**

```tsx
import { useConfirm } from "@/components/ui/confirm-provider"
// dentro del componente:
const confirm = useConfirm()
```

- [ ] **Step 3: Reemplazar el patrón síncrono por await**

Asegurar que la función contenedora sea `async`. Cambiar:

```tsx
if (!confirm("¿Eliminar este honorario?")) return
```

por:

```tsx
const ok = await confirm({
  title: "Eliminar honorario",
  description: "Esta acción no se puede deshacer.",
  confirmLabel: "Eliminar",
  destructive: true,
})
if (!ok) return
```

(Ajustar título/descripción al contexto real de cada sitio: producto, cotización, etc.)

- [ ] **Step 4: Verificar que no quedan confirm() nativos**

Run: `git grep -n "[^.]confirm(" "apps/web/app/(app)/honorarios/page.tsx" "apps/web/app/(app)/inventario/productos/page.tsx" "apps/web/app/(app)/ventas/cotizaciones/page.tsx"`
Expected: sin resultados (las llamadas ahora son `confirm({...})` del hook, que sí
matchean — confirmar manualmente que provienen de `useConfirm`, no de `window.confirm`).

- [ ] **Step 5: Lint**

Run: `pnpm --filter web lint`
Expected: sin errores.

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/
git commit -m "feat(sprint12): useConfirm en lugar de confirm() nativo"
```

---

# FASE C — Menú de usuario accesible (Radix)

## Task C1: Instalar dependencia Radix dropdown-menu

**Files:**
- Modify: `apps/web/package.json`, `pnpm-lock.yaml`

- [ ] **Step 1: Instalar**

Run: `pnpm --filter web add @radix-ui/react-dropdown-menu`
Expected: agrega la dependencia y actualiza el lock.

- [ ] **Step 2: Commit**

```bash
git add apps/web/package.json pnpm-lock.yaml
git commit -m "chore(sprint12): agregar @radix-ui/react-dropdown-menu"
```

## Task C2: Reescribir UserMenu con Radix

**Files:**
- Modify: `apps/web/components/layout/header.tsx`

- [ ] **Step 1: Importar Radix**

Agregar arriba:

```tsx
import * as DropdownMenu from "@radix-ui/react-dropdown-menu"
```

- [ ] **Step 2: Reemplazar la función UserMenu completa**

Sustituir la implementación actual (el bloque `div.relative.group` con hover) por:

```tsx
function UserMenu() {
  const { data: session } = useSession()
  const user = session?.user

  if (!user) {
    return (
      <Link
        href="/login"
        className="h-8 flex items-center gap-1.5 rounded-full ring-1 ring-border bg-secondary px-3 text-xs font-medium hover:bg-secondary/80 transition-colors"
      >
        <LogIn className="h-3.5 w-3.5" />
        Ingresar
      </Link>
    )
  }

  const initials = user.name
    ? user.name.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)
    : user.email?.slice(0, 2).toUpperCase() || "??"

  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger asChild>
        <button
          className="h-8 w-8 rounded-full ring-1 ring-border bg-secondary flex items-center justify-center text-xs font-semibold hover:bg-secondary/80 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label="Menú de usuario"
        >
          {initials}
        </button>
      </DropdownMenu.Trigger>
      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-48 rounded-md border border-border bg-paper shadow-lg p-0 overflow-hidden"
        >
          <div className="px-3 py-2 border-b border-border">
            <p className="text-sm font-medium truncate">{user.name || user.email}</p>
            <p className="text-xs text-muted-foreground truncate">{user.email}</p>
          </div>
          <DropdownMenu.Item asChild>
            <Link
              href="/selector"
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:bg-secondary/50 focus:bg-secondary/50 outline-none cursor-pointer transition-colors"
            >
              <Briefcase className="h-4 w-4" />
              Cambiar perfil
            </Link>
          </DropdownMenu.Item>
          <DropdownMenu.Item
            onSelect={() => signOut()}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-destructive hover:bg-secondary/50 focus:bg-secondary/50 outline-none cursor-pointer transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Cerrar sesión
          </DropdownMenu.Item>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  )
}
```

- [ ] **Step 3: Verificar build/lint**

Run: `pnpm --filter web lint`
Expected: sin errores.

- [ ] **Step 4: Commit**

```bash
git add apps/web/components/layout/header.tsx
git commit -m "feat(sprint12): menú de usuario accesible con Radix DropdownMenu"
```

## Task C3: E2E — menú accesible por teclado, retry y confirm

**Files:**
- Create: `apps/web/e2e/sprint12.spec.ts`

- [ ] **Step 1: Inspeccionar un spec existente para reusar el setup de auth**

Run: `sed -n '1,40p' apps/web/e2e/dashboard.spec.ts`
Expected: ver cómo se autentica/navega (storageState, beforeEach, etc.) para replicarlo.

- [ ] **Step 2: Escribir el spec**

```ts
import { test, expect } from "@playwright/test"

// Reusar el mismo setup de auth que dashboard.spec.ts (storageState/login helper).

test.describe("Sprint 12 — accesibilidad y robustez", () => {
  test("menú de usuario se abre y opera con teclado", async ({ page }) => {
    await page.goto("/dashboard")
    const trigger = page.getByRole("button", { name: "Menú de usuario" })
    await trigger.focus()
    await page.keyboard.press("Enter")
    await expect(page.getByRole("menuitem", { name: /cambiar perfil/i })).toBeVisible()
    await page.keyboard.press("Escape")
    await expect(page.getByRole("menuitem", { name: /cambiar perfil/i })).toBeHidden()
  })

  test("menú de usuario es operable por touch (sin hover)", async ({ page }) => {
    await page.goto("/dashboard")
    await page.getByRole("button", { name: "Menú de usuario" }).click()
    await expect(page.getByRole("menuitem", { name: /cerrar sesión/i })).toBeVisible()
  })
})
```

> Si el proyecto no tiene helper de auth para E2E, anotar y usar el patrón de
> `dashboard.spec.ts`. No inventar credenciales.

- [ ] **Step 3: Ejecutar el spec**

Run: `pnpm --filter web exec playwright test sprint12`
Expected: PASS (o, si depende de servidor levantado, seguir el patrón de los specs
existentes; documentar el comando real usado en CI).

- [ ] **Step 4: Commit**

```bash
git add apps/web/e2e/sprint12.spec.ts
git commit -m "test(sprint12): E2E menú de usuario accesible por teclado y touch"
```

---

# FASE A — Endpoint de stats + dashboard eficiente

## Task A1: Tipo DocumentStats compartido

**Files:**
- Modify: `apps/web/types/index.ts`

- [ ] **Step 1: Agregar el tipo**

Al final de `apps/web/types/index.ts`:

```ts
export interface DocumentStats {
  total: number
  emittedToday: number
  byStatus: { pending: number; accepted: number; rejected: number; failed: number }
  monthly: Array<{ month: string; count: number; totalAmount: number }>
  yoy: { current: number; previous: number; deltaPct: number }
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/web/types/index.ts
git commit -m "feat(sprint12): tipo DocumentStats compartido"
```

## Task A2: Endpoint GET /documents/stats (TDD)

**Files:**
- Modify: `apps/api/src/routes/dte/documents.ts`
- Test: `apps/api/tests/dte/documents-stats.test.ts`

- [ ] **Step 1: Escribir el test que falla**

```ts
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
// Cache deshabilitada en test: el cliente Redis no devuelve hit.
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
    ;(prisma.document.findMany as any).mockResolvedValue([]) // serie mensual
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
    // groupBy debe haberse llamado con where.companyId = co-1
    expect((prisma.document.groupBy as any).mock.calls[0][0].where.companyId).toBe("co-1")
    await app.close()
  })
})
```

- [ ] **Step 2: Ejecutar el test para verificar que falla**

Run: `pnpm --filter @contachile/api test -- documents-stats`
(Si el filtro del paquete API difiere, usar `pnpm --filter ./apps/api test -- documents-stats`.)
Expected: FAIL — la ruta `/documents/stats` no existe (404) o el handler no está.

- [ ] **Step 3: Implementar el handler en documents.ts**

Agregar dentro de `export default async function (fastify)`, después del handler
`GET /documents` y antes de `GET /documents/:id`:

```ts
  fastify.get('/documents/stats', async (request, reply) => {
    const companyId = request.companyId

    const redis = createRedisClient()
    const cacheKey = `stats:documents:${companyId}`
    try {
      const cached = await redis.get(cacheKey)
      if (cached) {
        await redis.quit()
        return reply.send(JSON.parse(cached))
      }
    } catch {
      // Redis no disponible → seguir sin cache
    }

    const startOfToday = new Date()
    startOfToday.setHours(0, 0, 0, 0)

    const now = new Date()
    const startOfYear = new Date(now.getFullYear(), 0, 1)
    const startOfPrevYear = new Date(now.getFullYear() - 1, 0, 1)
    const startOfWindow = new Date(now.getFullYear() - 1, now.getMonth() - 11, 1)

    const [total, emittedToday, grouped, windowRows, curAgg, prevAgg] =
      await Promise.all([
        prisma.document.count({ where: { companyId } }),
        prisma.document.count({
          where: { companyId, emittedAt: { gte: startOfToday } },
        }),
        prisma.document.groupBy({
          by: ['status'],
          where: { companyId },
          _count: { _all: true },
        }),
        prisma.document.findMany({
          where: { companyId, emittedAt: { gte: startOfWindow } },
          select: { emittedAt: true, totalAmount: true },
        }),
        prisma.document.aggregate({
          where: { companyId, emittedAt: { gte: startOfYear } },
          _sum: { totalAmount: true },
        }),
        prisma.document.aggregate({
          where: {
            companyId,
            emittedAt: { gte: startOfPrevYear, lt: startOfYear },
          },
          _sum: { totalAmount: true },
        }),
      ])

    const countOf = (s: string) =>
      grouped.find((g: any) => g.status === s)?._count?._all ?? 0

    const byStatus = {
      pending: countOf('PENDING'),
      accepted: countOf('ACCEPTED'),
      rejected: countOf('REJECTED'),
      failed: countOf('FAILED'),
    }

    // Serie mensual (12 meses) a partir de windowRows
    const monthlyMap = new Map<string, { count: number; totalAmount: number }>()
    for (let i = 11; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      monthlyMap.set(key, { count: 0, totalAmount: 0 })
    }
    for (const row of windowRows) {
      const d = new Date(row.emittedAt)
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
      const cur = monthlyMap.get(key)
      if (cur) {
        cur.count += 1
        cur.totalAmount += row.totalAmount ?? 0
      }
    }
    const monthly = Array.from(monthlyMap.entries()).map(([month, v]) => ({
      month,
      count: v.count,
      totalAmount: v.totalAmount,
    }))

    const current = curAgg._sum.totalAmount ?? 0
    const previous = prevAgg._sum.totalAmount ?? 0
    const deltaPct =
      previous > 0 ? Math.round(((current - previous) / previous) * 100) : 0

    const stats = {
      total,
      emittedToday,
      byStatus,
      monthly,
      yoy: { current, previous, deltaPct },
    }

    try {
      await redis.setex(cacheKey, 300, JSON.stringify(stats))
      await redis.quit()
    } catch {
      // ignore
    }

    return reply.send(stats)
  })
```

Agregar el import de redis arriba del archivo (junto a los otros imports):

```ts
import { createRedisClient } from '../../lib/redis'
```

- [ ] **Step 4: Ejecutar el test para verificar que pasa**

Run: `pnpm --filter @contachile/api test -- documents-stats`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/dte/documents.ts apps/api/tests/dte/documents-stats.test.ts
git commit -m "feat(sprint12): endpoint GET /documents/stats con cache Redis + tests"
```

## Task A3: API route proxy en Next

**Files:**
- Create: `apps/web/app/api/documents/stats/route.ts`

- [ ] **Step 1: Crear el proxy (patrón idéntico a /api/documents)**

```ts
import { NextRequest, NextResponse } from 'next/server'
import { apiFetch } from '@/lib/api-server'

export async function GET(req: NextRequest) {
  const cookie = req.headers.get('cookie')
  const extraHeaders: Record<string, string> = {}
  if (cookie) extraHeaders['Cookie'] = cookie

  const { status, data } = await apiFetch('/documents/stats', {
    method: 'GET',
    headers: extraHeaders,
  })

  if (status >= 400 || !data) {
    return NextResponse.json(
      {
        total: 0,
        emittedToday: 0,
        byStatus: { pending: 0, accepted: 0, rejected: 0, failed: 0 },
        monthly: [],
        yoy: { current: 0, previous: 0, deltaPct: 0 },
      },
      { status: 200 }
    )
  }
  return NextResponse.json(data, { status })
}
```

- [ ] **Step 2: Lint**

Run: `pnpm --filter web lint`
Expected: sin errores.

- [ ] **Step 3: Commit**

```bash
git add "apps/web/app/api/documents/stats/route.ts"
git commit -m "feat(sprint12): API route proxy /api/documents/stats"
```

## Task A4: Refactor de los componentes de dashboard a DocumentStats

**Files:**
- Modify: `apps/web/components/dashboard/stats-cards.tsx`
- Modify: `apps/web/components/dashboard/documents-chart.tsx`
- Modify: `apps/web/components/dashboard/status-chart.tsx`

- [ ] **Step 1: StatsCards recibe stats pre-agregados**

Reemplazar la firma y el `useMemo` de `stats-cards.tsx`:

```tsx
"use client"

import { Stat } from "@/components/ui/stat"
import { AnimatedFigure } from "@/components/ui/animated-figure"
import { FileCheck, FileClock, FileX, FileText } from "lucide-react"
import { DocumentStats } from "@/types"

interface StatsCardsProps {
  stats: DocumentStats
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    { label: "Emitidos hoy", value: stats.emittedToday, icon: <FileText className="h-4 w-4" />, tone: "default" as const },
    { label: "Pendientes SII", value: stats.byStatus.pending, icon: <FileClock className="h-4 w-4" />, tone: "warning" as const },
    { label: "Aceptados", value: stats.byStatus.accepted, icon: <FileCheck className="h-4 w-4" />, tone: "positive" as const },
    { label: "Rechazados", value: stats.byStatus.rejected + stats.byStatus.failed, icon: <FileX className="h-4 w-4" />, tone: "negative" as const },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((stat) => (
        <Stat
          key={stat.label}
          label={stat.label}
          value={<AnimatedFigure value={stat.value} format={(n) => String(Math.round(n)).padStart(2, "0")} />}
          tone={stat.tone}
          icon={stat.icon}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: DocumentsChart usa stats.monthly**

Reemplazar la firma y el `useMemo` de `documents-chart.tsx` (mantener el JSX del gráfico y `ChartShell` intactos). Cambiar el bloque superior:

```tsx
import { DocumentStats } from "@/types"

interface DocumentsChartProps {
  stats: DocumentStats
}

const MONTHS_SHORT = ["ene","feb","mar","abr","may","jun","jul","ago","sep","oct","nov","dic"]

export function DocumentsChart({ stats }: DocumentsChartProps) {
  const { data, max, total, avg, peakIdx } = useMemo(() => {
    const data = stats.monthly.slice(-6).map((m) => {
      const [year, month] = m.month.split("-")
      const name = `${MONTHS_SHORT[parseInt(month, 10) - 1]} ${year.slice(2)}`
      return { name, value: m.count }
    })
    const max = data.reduce((mx, d) => Math.max(mx, d.value), 0)
    const total = data.reduce((s, d) => s + d.value, 0)
    const avg = data.length ? total / data.length : 0
    const peakIdx = data.findIndex((d) => d.value === max)
    return { data, max, total, avg, peakIdx }
  }, [stats])
  // ...resto del componente sin cambios (el `if (data.length === 0)` y el JSX)
```

- [ ] **Step 3: StatusChart usa stats.byStatus**

Reemplazar la firma y el `useMemo` de `status-chart.tsx` (mantener el JSX intacto):

```tsx
import { DocumentStats } from "@/types"

interface StatusChartProps {
  stats: DocumentStats
}

export function StatusChart({ stats }: StatusChartProps) {
  const { data, total, accepted, acceptedPct } = useMemo(() => {
    const byStatus: Record<string, number> = {
      PENDING: stats.byStatus.pending,
      ACCEPTED: stats.byStatus.accepted,
      REJECTED: stats.byStatus.rejected,
      FAILED: stats.byStatus.failed,
    }
    const data = Object.entries(byStatus)
      .filter(([, value]) => value > 0)
      .map(([status, value]) => ({
        name: LABELS[status] || status,
        value,
        color: COLORS[status] || CHART_PALETTE.muted,
      }))
    const total = data.reduce((s, d) => s + d.value, 0)
    const accepted = byStatus["ACCEPTED"] || 0
    const acceptedPct = total > 0 ? Math.round((accepted / total) * 100) : 0
    return { data, total, accepted, acceptedPct }
  }, [stats])
  // ...resto del componente sin cambios
```

- [ ] **Step 4: Lint**

Run: `pnpm --filter web lint`
Expected: sin errores (los componentes ya no importan `Document`).

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/dashboard/
git commit -m "refactor(sprint12): componentes de dashboard consumen DocumentStats pre-agregado"
```

## Task A5: Dashboard consume stats directo vía apiFetch

**Files:**
- Modify: `apps/web/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Reemplazar getStats por dos fetch correctos**

Cambiar el bloque `getStats` y el cuerpo del componente. Nuevo encabezado del archivo:

```tsx
import { DocumentTable } from "@/components/documents/document-table"
import { DocumentsResponse, DocumentStats } from "@/types"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { DocumentsChart } from "@/components/dashboard/documents-chart"
import { StatusChart } from "@/components/dashboard/status-chart"
import { UpcomingAlertsBanner } from "@/components/dashboard/upcoming-alerts-banner"
import { AIInsights } from "@/components/dashboard/ai-insights"
import { RuleOrnament } from "@/components/ui/rule-ornament"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PlusCircle, ArrowUpRight } from "lucide-react"
import { apiFetch } from "@/lib/api-server"

const EMPTY_STATS: DocumentStats = {
  total: 0,
  emittedToday: 0,
  byStatus: { pending: 0, accepted: 0, rejected: 0, failed: 0 },
  monthly: [],
  yoy: { current: 0, previous: 0, deltaPct: 0 },
}

async function getDashboardData(): Promise<{ stats: DocumentStats; recent: DocumentsResponse["documents"] }> {
  const [statsRes, recentRes] = await Promise.all([
    apiFetch("/documents/stats", { method: "GET" }),
    apiFetch("/documents?limit=5", { method: "GET" }),
  ])
  const stats = (statsRes.status < 400 && statsRes.data ? statsRes.data : EMPTY_STATS) as DocumentStats
  const recent = (recentRes.status < 400 && recentRes.data?.documents ? recentRes.data.documents : []) as DocumentsResponse["documents"]
  return { stats, recent }
}
```

- [ ] **Step 2: Actualizar el cuerpo del componente**

Cambiar:

```tsx
export default async function DashboardPage() {
  const { documents, recent } = await getStats()
```
por:
```tsx
export default async function DashboardPage() {
  const { stats, recent } = await getDashboardData()
```

Actualizar las referencias en el JSX:
- `{documents.length} documentos en archivo` → `{stats.total} documentos en archivo`
- `<StatsCards documents={documents} />` → `<StatsCards stats={stats} />`
- `<DocumentsChart documents={documents} />` → `<DocumentsChart stats={stats} />`
- `<StatusChart documents={documents} />` → `<StatusChart stats={stats} />`
- `<DocumentTable documents={recent} />` → sin cambio (sigue recibiendo `recent`)

- [ ] **Step 3: Verificar build completo**

Run: `pnpm --filter web build`
Expected: compila sin errores de tipo (props de dashboard ahora son `stats`).

- [ ] **Step 4: Commit**

```bash
git add "apps/web/app/(app)/dashboard/page.tsx"
git commit -m "fix(sprint12): dashboard usa apiFetch directo con cookie y endpoint stats (no más datos vacíos ni limit=1000)"
```

---

# Cierre del Sprint

## Task Z1: Verificación global

- [ ] **Step 1: Lint de todo**

Run: `pnpm lint`
Expected: sin errores.

- [ ] **Step 2: Tests de todo**

Run: `pnpm test`
Expected: todas las suites pasan; coverage del API ≥ 80% (gate de CI).

- [ ] **Step 3: Build de producción**

Run: `pnpm build`
Expected: build verde en web y api.

- [ ] **Step 4: Auditoría de alert()/confirm() nativos restantes**

Run: `git grep -n "window.alert\|window.confirm" apps/web ; git grep -nE "[^.a-zA-Z](alert|confirm)\(" apps/web/app apps/web/components`
Expected: cero `alert()`/`confirm()` nativos. (`confirm({...})` del hook es esperado.)

- [ ] **Step 5: Verificación manual del dashboard**

Levantar `pnpm dev`, iniciar sesión, abrir `/dashboard`. Confirmar que stats/charts
muestran datos reales (no ceros) con un usuario que tiene documentos.

- [ ] **Step 6: Commit final si quedaron ajustes**

```bash
git add -A
git commit -m "chore(sprint12): cierre — lint/test/build verdes"
```

---

## Notas de ejecución

- **Runner de tests web:** verificar `apps/web/jest.config.js` vs Vitest antes de E1/D1/B1
  y ajustar `jest.*` ↔ `vi.*` en los tests.
- **Auth en E2E:** reutilizar el setup de `apps/web/e2e/dashboard.spec.ts`. No inventar
  credenciales ni flujos de login nuevos.
- **Redis en dev/test:** el endpoint stats degrada con gracia si Redis no está; los
  tests mockean `../../src/lib/redis`.
- **Filtro de paquete API:** confirmar el nombre real con `cat apps/api/package.json`
  (campo `name`) para el `pnpm --filter`.
