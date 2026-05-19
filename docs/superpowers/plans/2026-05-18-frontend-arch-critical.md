# Frontend Arquitectura Crítica — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Resolver los siete bugs arquitectónicos detectados en la auditoría frontend (2026-05-18): landing pública renderizando dentro del shell autenticado, sidebar desincronizado con el padding del layout, helpers de formato y validación duplicados o inexistentes, e hidratación insegura por uso de `Date` en client components.

**Architecture:** Separar `app/` en tres route groups (`(marketing)`, `(auth)`, `(app)`) para que cada uno tenga su propio chrome. Centralizar formato CLP y parsing en `@contachile/validators` (ya wireado al monorepo y con vitest configurado). Sidebar collapsed-state via Context client-side persistido en `localStorage`. Helpers de RUT consumen el `validateRUT/formatRUT` que ya existe en validators.

**Tech Stack:** Next.js 14 App Router, React 18, TypeScript, Tailwind 3.4, Radix UI, Clerk 5, `@contachile/validators` (workspace package, vitest), `lucide-react`, `motion`.

**TDD policy (pragmática):** Tests obligatorios para helpers en `packages/validators` (vitest ya configurado). Para componentes UI/cambios de estructura de carpetas, validación manual vía smoke test en navegador (no hay setup de Testing Library en `apps/web`).

---

## File Structure

### Archivos nuevos

- `packages/validators/src/format.ts` — `formatCLP`, `parseCLP`, `formatPercent`. Helpers de formato chileno.
- `packages/validators/tests/format.test.ts` — vitest tests.
- `apps/web/lib/rut-input.ts` — hook `useRutInput` para mascarear inputs de RUT en tiempo real, consumiendo `validateRUT/formatRUT`.
- `apps/web/components/forms/rut-field.tsx` — componente `RutField` reusable con a11y wirering.
- `apps/web/components/layout/sidebar-state-provider.tsx` — Context client-side con persistencia `localStorage`.
- `apps/web/app/(marketing)/layout.tsx` — layout minimal sin shell autenticado.
- `apps/web/app/(marketing)/page.tsx` — landing actual (movida).
- `apps/web/app/(auth)/layout.tsx` — layout sin shell para login/sign-up.
- `apps/web/app/(auth)/login/[[...rest]]/page.tsx` — (movida).
- `apps/web/app/(auth)/sign-up/[[...rest]]/page.tsx` — (movida).
- `apps/web/app/(app)/layout.tsx` — shell con Sidebar/Header/ChatWidget, padding dinámico.
- `apps/web/app/(app)/<ruta>/page.tsx` — todas las páginas autenticadas movidas.

### Archivos modificados

- `packages/validators/src/index.ts` — re-exportar `formatCLP`, `parseCLP`, `formatPercent`.
- `apps/web/app/layout.tsx` — eliminar Sidebar/Header/ChatWidget/`<main>` wrapper. Solo provee `ClerkProvider` + `<Providers>` + `<html>`/`<body>`.
- `apps/web/app/providers.tsx` — añadir `<SidebarStateProvider>` dentro de QueryClientProvider.
- `apps/web/components/layout/sidebar.tsx` — leer state desde Context, eliminar div fantasma (líneas 249-254).
- `apps/web/components/layout/header.tsx` — fix hidratación de `formatNow()` con `mounted` flag, añadir aria-label a breadcrumb.
- `apps/web/app/(marketing)/page.tsx` — cambiar `Script strategy="beforeInteractive"` a `afterInteractive`.
- Páginas con `fmt` local de CLP → usar `formatCLP` importado.
- Páginas con inputs de RUT → consumir `<RutField>`.
- Páginas con inputs de monto → consumir `parseCLP`.

---

## Task 1: Helper `formatCLP` en validators (TDD)

**Files:**
- Create: `packages/validators/src/format.ts`
- Create: `packages/validators/tests/format.test.ts`

- [ ] **Step 1.1: Escribir el test que falla**

Crear `packages/validators/tests/format.test.ts`:

```typescript
import { describe, it, expect } from 'vitest'
import { formatCLP, parseCLP, formatPercent } from '../src/format'

describe('formatCLP', () => {
  it('formatea entero positivo con punto miles y prefijo $', () => {
    expect(formatCLP(1847293)).toBe('$ 1.847.293')
  })

  it('formatea cero', () => {
    expect(formatCLP(0)).toBe('$ 0')
  })

  it('formatea negativo con guion antes del prefijo', () => {
    expect(formatCLP(-119000)).toBe('-$ 119.000')
  })

  it('redondea decimales (CLP no usa centavos)', () => {
    expect(formatCLP(1234.7)).toBe('$ 1.235')
  })

  it('null/undefined -> "$ 0"', () => {
    expect(formatCLP(null)).toBe('$ 0')
    expect(formatCLP(undefined)).toBe('$ 0')
  })

  it('soporta NaN -> "$ 0"', () => {
    expect(formatCLP(NaN)).toBe('$ 0')
  })
})

describe('parseCLP', () => {
  it('parsea "$ 1.847.293" -> 1847293', () => {
    expect(parseCLP('$ 1.847.293')).toBe(1847293)
  })

  it('parsea "$1.000.000" sin espacio', () => {
    expect(parseCLP('$1.000.000')).toBe(1000000)
  })

  it('parsea solo dígitos', () => {
    expect(parseCLP('100000')).toBe(100000)
  })

  it('parsea con espacios sobrantes', () => {
    expect(parseCLP('  $ 119.000  ')).toBe(119000)
  })

  it('parsea negativo "-$ 50.000"', () => {
    expect(parseCLP('-$ 50.000')).toBe(-50000)
  })

  it('string vacío -> 0', () => {
    expect(parseCLP('')).toBe(0)
    expect(parseCLP('   ')).toBe(0)
  })

  it('texto no numérico -> 0', () => {
    expect(parseCLP('abc')).toBe(0)
  })
})

describe('formatPercent', () => {
  it('formatea 0.123 -> "12,3 %" (es-CL coma decimal)', () => {
    expect(formatPercent(0.123)).toBe('12,3 %')
  })

  it('formatea entero 1 -> "100,0 %"', () => {
    expect(formatPercent(1)).toBe('100,0 %')
  })

  it('soporta dígitos custom', () => {
    expect(formatPercent(0.12345, 2)).toBe('12,35 %')
  })

  it('null -> "0,0 %"', () => {
    expect(formatPercent(null)).toBe('0,0 %')
  })
})
```

- [ ] **Step 1.2: Verificar que falla**

Run desde `packages/validators/`:
```bash
pnpm test -- format
```
Expected: FAIL — "Cannot find module '../src/format'"

- [ ] **Step 1.3: Implementar `format.ts`**

Crear `packages/validators/src/format.ts`:

```typescript
/**
 * Formato monetario chileno (CLP). No usa decimales, separador de miles es punto.
 * Ej: 1847293 -> "$ 1.847.293". Negativos: "-$ 119.000".
 */
export function formatCLP(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '$ 0'
  }
  const rounded = Math.round(value)
  const abs = Math.abs(rounded)
  const formatted = abs.toLocaleString('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
  return rounded < 0 ? `-$ ${formatted}` : `$ ${formatted}`
}

/**
 * Parsea un string monetario chileno a número entero.
 * Acepta "$ 1.847.293", "$1.000.000", "1000000", "  -$ 50.000  ".
 * Devuelve 0 para strings vacíos o no parseables.
 */
export function parseCLP(value: string | null | undefined): number {
  if (!value) return 0
  const trimmed = value.trim()
  if (!trimmed) return 0
  const isNegative = trimmed.startsWith('-')
  const digits = trimmed.replace(/[^0-9]/g, '')
  if (!digits) return 0
  const n = parseInt(digits, 10)
  return isNegative ? -n : n
}

/**
 * Formatea un ratio (0..1) como porcentaje chileno con coma decimal.
 * Ej: 0.123 -> "12,3 %".
 */
export function formatPercent(
  ratio: number | null | undefined,
  digits = 1
): string {
  if (ratio === null || ratio === undefined || Number.isNaN(ratio)) {
    return '0,0 %'
  }
  const formatted = (ratio * 100).toLocaleString('es-CL', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  return `${formatted} %`
}
```

- [ ] **Step 1.4: Verificar que pasa**

Run:
```bash
pnpm test -- format
```
Expected: PASS — todos los tests verdes.

- [ ] **Step 1.5: Exportar desde el index**

Edit `packages/validators/src/index.ts` — añadir como primer re-export (después de la línea 1, antes de los demás):

```typescript
export { formatCLP, parseCLP, formatPercent } from './format'
```

- [ ] **Step 1.6: Rebuild del paquete**

```bash
pnpm --filter @contachile/validators build
```
Expected: build exitoso sin errores TypeScript.

- [ ] **Step 1.7: Commit**

```bash
git add packages/validators/src/format.ts packages/validators/tests/format.test.ts packages/validators/src/index.ts
git commit -m "feat(validators): add formatCLP, parseCLP, formatPercent helpers"
```

---

## Task 2: Migrar `fmt` locales a `formatCLP`

**Files:**
- Modify: `apps/web/app/dashboard/page.tsx`
- Modify: `apps/web/app/purchases/page.tsx`
- Modify: `apps/web/app/f29/page.tsx`
- Modify: `apps/web/app/f22/page.tsx`
- Modify: `apps/web/app/honorarios/page.tsx`
- Modify: `apps/web/app/ventas/cotizaciones/page.tsx`
- Modify: `apps/web/app/documents/page.tsx`
- Modify: `apps/web/components/dashboard/stats-cards.tsx`
- Modify: `apps/web/components/dashboard/documents-chart.tsx`

> Nota: las páginas todavía están en `app/<ruta>/`. La mudanza a `app/(app)/` la hace la Task 8. Esta tarea trabaja sobre las rutas actuales para no acumular cambios.

- [ ] **Step 2.1: Encontrar todos los `fmt` locales de CLP**

Run:
```bash
grep -rn "toLocaleString.\"es-CL\"\|toLocaleString.'es-CL'" apps/web/app/ apps/web/components/ --include="*.tsx" --include="*.ts"
```
Esperado: una lista de archivos. Anotar.

- [ ] **Step 2.2: Editar `apps/web/app/purchases/page.tsx`**

Buscar (alrededor línea 22):
```typescript
const fmt = (n: number) => `$ ${n.toLocaleString("es-CL")}`
```
Eliminar esa línea y añadir al bloque de imports al inicio del archivo:
```typescript
import { formatCLP } from "@contachile/validators"
```

Luego en el archivo, reemplazar cada llamada `fmt(x)` por `formatCLP(x)`. Verificar:
```bash
grep -n "fmt(" apps/web/app/purchases/page.tsx
```
Expected: 0 resultados.

- [ ] **Step 2.3: Editar `apps/web/app/f29/page.tsx`**

Línea ~22:
```typescript
const fmt = (n: number | undefined) => `$ ${(n ?? 0).toLocaleString("es-CL")}`
```
Eliminar, añadir import de `formatCLP`, reemplazar usos. `formatCLP` ya maneja `undefined`.

- [ ] **Step 2.4: Editar `apps/web/app/f22/page.tsx`**

Buscar el helper local de moneda (típicamente en la zona superior). Eliminar y reemplazar como en los anteriores.

- [ ] **Step 2.5: Editar `apps/web/app/honorarios/page.tsx`**

Línea ~74:
```typescript
const fmt = (n: number) => `$${n.toLocaleString('es-CL')}`
```
(Nota: este usa `$` sin espacio — formato no chileno. El helper unifica con espacio.)

Eliminar, importar `formatCLP`, reemplazar todos los `fmt(...)`.

- [ ] **Step 2.6: Editar `apps/web/app/ventas/cotizaciones/page.tsx`**

Línea ~117 (mismo patrón sin espacio). Eliminar, importar, reemplazar.

- [ ] **Step 2.7: Editar `apps/web/app/documents/page.tsx`**

Buscar `toLocaleString("es-CL")` o helpers locales. Reemplazar por `formatCLP`.

- [ ] **Step 2.8: Editar `apps/web/app/dashboard/page.tsx` + componentes**

```bash
grep -n "toLocaleString" apps/web/components/dashboard/*.tsx
```
En `stats-cards.tsx`, `documents-chart.tsx` y otros con money formatting — reemplazar por `formatCLP`. **Mantener** `toLocaleDateString` para fechas (no es la migración objetivo).

- [ ] **Step 2.9: Verificar TypeScript**

```bash
pnpm --filter @contachile/web build
```
Si hay errores tipo "Cannot find name 'fmt'" → quedaron usos sueltos. Corregir uno por uno.
Expected: build pasa.

- [ ] **Step 2.10: Smoke test manual**

```bash
pnpm --filter @contachile/web dev
```
Abrir `/dashboard`, `/purchases`, `/f29`, `/f22`, `/honorarios`, `/ventas/cotizaciones`, `/documents`. Verificar:
- Todos los montos muestran `$ 1.847.293` (con espacio, punto miles).
- No hay `NaN` ni `undefined` visibles.
- Consola sin errores.

Detener dev server al terminar.

- [ ] **Step 2.11: Commit**

```bash
git add apps/web/app apps/web/components
git commit -m "refactor(web): unify CLP formatting via formatCLP from validators"
```

---

## Task 3: Componente `<RutField>` reusable

**Files:**
- Create: `apps/web/lib/rut-input.ts`
- Create: `apps/web/components/forms/rut-field.tsx`
- Modify: `apps/web/app/purchases/page.tsx` (input RUT)
- Modify: `apps/web/app/honorarios/page.tsx` (input RUT)
- Modify: `apps/web/app/ventas/cotizaciones/page.tsx` (input RUT)

- [ ] **Step 3.1: Crear el hook `useRutInput`**

Crear `apps/web/lib/rut-input.ts`:

```typescript
"use client"

import { useCallback, useMemo } from "react"
import { validateRUT, formatRUT } from "@contachile/validators"

export type RutInputResult = {
  /** value formateado para mostrar en el input (ej "12.345.678-5") */
  display: string
  /** value crudo solo dígitos+DV mayúscula (para enviar al backend) */
  raw: string
  /** true si validateRUT pasa */
  isValid: boolean
  /** mensaje de error legible, o null */
  error: string | null
  /** handler para onChange del <input>: extrae caracteres válidos */
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

/**
 * Hook para inputs de RUT chileno.
 * - El componente consumidor debe llamar onChange con el valor crudo.
 * - Mascarea con dots y dash al mostrar (display).
 * - isValid usa módulo 11 (validateRUT del package validators).
 */
export function useRutInput(
  value: string,
  setValue: (raw: string) => void
): RutInputResult {
  const raw = useMemo(
    () => (value || "").replace(/[^0-9kK]/g, "").toUpperCase(),
    [value]
  )

  const display = useMemo(() => {
    if (raw.length < 2) return raw
    return formatRUT(raw)
  }, [raw])

  const isValid = useMemo(() => {
    if (!raw) return false
    return validateRUT(raw)
  }, [raw])

  const error = useMemo(() => {
    if (!raw) return null
    if (raw.length < 8) return "RUT incompleto"
    if (!isValid) return "Dígito verificador inválido"
    return null
  }, [raw, isValid])

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const clean = e.target.value.replace(/[^0-9kK]/g, "").toUpperCase()
      setValue(clean)
    },
    [setValue]
  )

  return { display, raw, isValid, error, onChange }
}
```

- [ ] **Step 3.2: Crear `<RutField>` componente**

Crear `apps/web/components/forms/rut-field.tsx`:

```tsx
"use client"

import { useRutInput } from "@/lib/rut-input"
import { Input } from "@/components/ui/input"

type Props = {
  id: string
  label: string
  value: string
  onChange: (raw: string) => void
  required?: boolean
  placeholder?: string
}

export function RutField({
  id,
  label,
  value,
  onChange,
  required,
  placeholder = "12.345.678-9",
}: Props) {
  const rut = useRutInput(value, onChange)
  const showError = !!value && !rut.isValid

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="eyebrow !text-[0.65rem] text-foreground/70">
        {label}
        {required && <span className="text-primary ml-0.5">*</span>}
      </label>
      <Input
        id={id}
        value={rut.display}
        onChange={rut.onChange}
        placeholder={placeholder}
        aria-invalid={showError}
        aria-describedby={rut.error ? `${id}-error` : undefined}
        inputMode="text"
        autoComplete="off"
      />
      {rut.error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-xs text-rust font-mono"
        >
          {rut.error}
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 3.3: Verificar que las páginas de form son client components**

```bash
grep -l "^\"use client\"" apps/web/app/purchases/page.tsx apps/web/app/honorarios/page.tsx apps/web/app/ventas/cotizaciones/page.tsx
```
Las 3 deben aparecer. Si alguna NO es client, no se puede usar `<RutField>` directamente — habría que extraer un sub-componente `PurchaseForm.tsx` client. Asumiendo que sí son client (las hooks `useState` de los forms lo confirman).

- [ ] **Step 3.4: Reemplazar input RUT en `purchases/page.tsx`**

Localizar el input de RUT del proveedor (líneas ~367-371). Reemplazar todo el bloque label+input+helper por:

```tsx
<RutField
  id="supplier-rut"
  label="RUT del proveedor"
  value={form.supplierRut}
  onChange={(v) => setForm({ ...form, supplierRut: v })}
  required
/>
```

Añadir el import:
```typescript
import { RutField } from "@/components/forms/rut-field"
```

- [ ] **Step 3.5: Reemplazar input RUT en `honorarios/page.tsx`**

Líneas ~347-355. Reemplazar por:

```tsx
<RutField
  id="provider-rut"
  label="RUT del prestador"
  value={form.providerRut}
  onChange={(v) => setForm({ ...form, providerRut: v })}
  required
/>
```

(Si el campo en el form se llama distinto, ajustar `value`/`onChange`. Verificar en el código actual.)

- [ ] **Step 3.6: Reemplazar input RUT en `ventas/cotizaciones/page.tsx`**

Líneas ~358-360. Reemplazar por:

```tsx
<RutField
  id="receiver-rut"
  label="RUT del receptor"
  value={form.receiverRut}
  onChange={(v) => setForm({ ...form, receiverRut: v })}
  required
/>
```

(Ajustar nombre del campo en el form si difiere.)

- [ ] **Step 3.7: Smoke test manual**

```bash
pnpm --filter @contachile/web dev
```
Probar en `/purchases`, `/honorarios`, `/ventas/cotizaciones`:
- Tipear `123456785` → muestra "12.345.678-5" formateado al vuelo, sin error.
- Tipear `123456786` → "Dígito verificador inválido" en color rust.
- Tipear `12` → "RUT incompleto".
- Tipear `12345678k` → muestra K mayúscula formateada.
- Letras distintas a K no entran al campo.
- Al submitear, el payload al backend lleva el raw (sin puntos). Verificar con DevTools → Network → Request payload.

- [ ] **Step 3.8: Commit**

```bash
git add apps/web/lib/rut-input.ts apps/web/components/forms/rut-field.tsx apps/web/app
git commit -m "feat(web): RutField component + useRutInput hook with live masking and a11y"
```

---

## Task 4: Migrar inputs de moneda a `parseCLP`

**Files:**
- Modify: `apps/web/app/purchases/page.tsx:84-86`
- Modify: `apps/web/app/honorarios/page.tsx:380`
- Modify: `apps/web/app/ventas/cotizaciones/page.tsx:307-308`

- [ ] **Step 4.1: Encontrar coerciones `Number()` sobre montos**

```bash
grep -rn "Number(" apps/web/app/ --include="*.tsx" | grep -iE "amount|net|gross|price|monto|valor|total|bruto|neto"
```
Anotar archivos y líneas.

- [ ] **Step 4.2: Editar `apps/web/app/purchases/page.tsx`**

Línea ~84-86, patrón típico:
```typescript
const payload = {
  netAmount: Number(form.netAmount),
  ivaAmount: Number(form.ivaAmount),
  totalAmount: Number(form.totalAmount),
}
```

Reemplazar `Number(...)` por `parseCLP(...)`:
```typescript
const payload = {
  netAmount: parseCLP(form.netAmount),
  ivaAmount: parseCLP(form.ivaAmount),
  totalAmount: parseCLP(form.totalAmount),
}
```

Si ya tienes `import { formatCLP } from "@contachile/validators"` arriba (Task 2), extender:
```typescript
import { formatCLP, parseCLP } from "@contachile/validators"
```

- [ ] **Step 4.3: Editar `apps/web/app/honorarios/page.tsx`**

Línea ~380. Mismo patrón.

- [ ] **Step 4.4: Editar `apps/web/app/ventas/cotizaciones/page.tsx`**

Línea ~307-308. Mismo patrón.

- [ ] **Step 4.5: Smoke test**

`pnpm --filter @contachile/web dev`. Probar:
- Crear una compra con monto neto `100000` → IVA calculado 19000, total 119000. OK.
- Crear una compra con monto neto `1.000.000` (formato con puntos) → debería parsearse como 1000000 y procesarse normalmente (antes fallaba con NaN).
- Honorarios con bruto `$ 500.000` (con prefijo) → calcula retención sin errores.

- [ ] **Step 4.6: Commit**

```bash
git add apps/web/app
git commit -m "fix(web): parse CLP currency inputs with parseCLP (handles formatted strings)"
```

---

## Task 5: SidebarStateProvider (Context + localStorage)

**Files:**
- Create: `apps/web/components/layout/sidebar-state-provider.tsx`
- Modify: `apps/web/app/providers.tsx`
- Modify: `apps/web/components/layout/sidebar.tsx`

- [ ] **Step 5.1: Crear el provider**

Crear `apps/web/components/layout/sidebar-state-provider.tsx`:

```tsx
"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
} from "react"

type SidebarState = {
  collapsed: boolean
  mobileOpen: boolean
  toggleCollapsed: () => void
  setCollapsed: (v: boolean) => void
  setMobileOpen: (v: boolean) => void
}

const SidebarContext = createContext<SidebarState | null>(null)

const STORAGE_KEY = "cc:sidebar:collapsed"

export function SidebarStateProvider({ children }: { children: React.ReactNode }) {
  // Default false durante SSR para evitar mismatch. localStorage se lee en effect.
  const [collapsed, setCollapsedState] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [hydrated, setHydrated] = useState(false)

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored === "true") setCollapsedState(true)
    } catch {
      // localStorage no disponible (private mode, etc) — ignorar
    }
    setHydrated(true)
  }, [])

  const setCollapsed = useCallback((v: boolean) => {
    setCollapsedState(v)
    try {
      window.localStorage.setItem(STORAGE_KEY, v ? "true" : "false")
    } catch {
      // ignore
    }
  }, [])

  const toggleCollapsed = useCallback(() => {
    setCollapsed(!collapsed)
  }, [collapsed, setCollapsed])

  return (
    <SidebarContext.Provider
      value={{
        // antes de hidratar: collapsed=false para coincidir con SSR
        collapsed: hydrated ? collapsed : false,
        mobileOpen,
        toggleCollapsed,
        setCollapsed,
        setMobileOpen,
      }}
    >
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebarState(): SidebarState {
  const ctx = useContext(SidebarContext)
  if (!ctx) {
    throw new Error("useSidebarState must be used inside <SidebarStateProvider>")
  }
  return ctx
}
```

- [ ] **Step 5.2: Wirear el provider en `providers.tsx`**

Edit `apps/web/app/providers.tsx`. Reemplazar el contenido completo por:

```tsx
"use client"

import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { ThemeProvider } from "next-themes"
import { useState } from "react"
import { SidebarStateProvider } from "@/components/layout/sidebar-state-provider"

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient())

  return (
    <ThemeProvider
      attribute="class"
      defaultTheme="light"
      enableSystem
      disableTransitionOnChange
    >
      <QueryClientProvider client={queryClient}>
        <SidebarStateProvider>{children}</SidebarStateProvider>
      </QueryClientProvider>
    </ThemeProvider>
  )
}
```

- [ ] **Step 5.3: Modificar `sidebar.tsx` para consumir el Context**

Edit `apps/web/components/layout/sidebar.tsx`. Reemplazar el componente `Sidebar()` (líneas 206-257) completo por:

```tsx
export function Sidebar() {
  const { collapsed, mobileOpen, setMobileOpen, toggleCollapsed } =
    useSidebarState()

  return (
    <>
      <div className="lg:hidden fixed top-4 left-4 z-50">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button
              variant="outline"
              size="icon"
              aria-label="Abrir menú de navegación"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-paper">
            <SidebarContent collapsed={false} />
          </SheetContent>
        </Sheet>
      </div>

      <aside
        className={cn(
          "hidden lg:flex fixed left-0 top-0 h-screen flex-col border-r border-border bg-paper transition-all duration-300 z-40",
          collapsed ? "w-16" : "w-64"
        )}
        aria-label="Navegación principal"
      >
        <SidebarContent collapsed={collapsed} />

        <div className="border-t border-border p-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleCollapsed}
            className="w-full"
            aria-label={collapsed ? "Expandir sidebar" : "Colapsar sidebar"}
            aria-expanded={!collapsed}
          >
            {collapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </Button>
        </div>
      </aside>
    </>
  )
}
```

Añadir al inicio de imports:
```typescript
import { useSidebarState } from "@/components/layout/sidebar-state-provider"
```

Eliminar:
```typescript
import { useState } from "react"
```
(ya no se usa: `collapsed` y `mobileOpen` ahora vienen del Context.)

- [ ] **Step 5.4: Verificar que el div fantasma desapareció**

```bash
grep -n "lg:ml-16\|lg:ml-64" apps/web/components/layout/sidebar.tsx
```
Expected: 0 resultados.

- [ ] **Step 5.5: Smoke test**

`pnpm --filter @contachile/web dev`. Verificar:
- Click en ChevronLeft colapsa el sidebar (w-64 → w-16).
- Refrescar la página → mantiene colapsado.
- En mobile (<1024 px), hamburger abre el sheet.
- Botón de colapsar es alcanzable por Tab y tiene `aria-expanded`.

> El padding del contenido aún NO se ajusta — eso lo arregla la Task 8 (`(app)/layout.tsx` con padding dinámico).

- [ ] **Step 5.6: Commit**

```bash
git add apps/web/components/layout/sidebar-state-provider.tsx apps/web/app/providers.tsx apps/web/components/layout/sidebar.tsx
git commit -m "feat(web): SidebarStateProvider with localStorage persistence + a11y labels"
```

---

## Task 6: Route group `(marketing)` — separar landing pública

**Files:**
- Create: `apps/web/app/(marketing)/layout.tsx`
- Move: `apps/web/app/page.tsx` → `apps/web/app/(marketing)/page.tsx`
- Modify: `apps/web/app/(marketing)/page.tsx` — fix Script strategy

- [ ] **Step 6.1: Crear el directorio y layout minimal**

Bash:
```bash
mkdir -p "apps/web/app/(marketing)"
```
PowerShell:
```powershell
New-Item -ItemType Directory -Path "apps\web\app\(marketing)" -Force
```

Crear `apps/web/app/(marketing)/layout.tsx`:

```tsx
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: {
    default: "ContaChile - Facturación Electrónica para Chile",
    template: "%s | ContaChile",
  },
}

// Layout minimal para páginas públicas (landing, contacto, blog futuro).
// No incluye sidebar ni shell autenticado.
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
```

- [ ] **Step 6.2: Mover `page.tsx` a `(marketing)/`**

Bash:
```bash
git mv "apps/web/app/page.tsx" "apps/web/app/(marketing)/page.tsx"
```
PowerShell:
```powershell
git mv "apps\web\app\page.tsx" "apps\web\app\(marketing)\page.tsx"
```

- [ ] **Step 6.3: Fix Script strategy (line ~127)**

Edit `apps/web/app/(marketing)/page.tsx`. Localizar el bloque del `<Script>` (líneas ~123-129) y cambiar **únicamente** la prop `strategy`:

De:
```tsx
<Script
  id="structured-data"
  type="application/ld+json"
  strategy="beforeInteractive"
>
  {JSON.stringify(structuredData)}
</Script>
```

A:
```tsx
<Script
  id="structured-data"
  type="application/ld+json"
  strategy="afterInteractive"
>
  {JSON.stringify(structuredData)}
</Script>
```

> El cambio resuelve el warning de Next: `beforeInteractive` sólo es válido en el root layout (App Router). El JSON-LD se sigue inyectando, ahora correctamente.

- [ ] **Step 6.4: Smoke test marketing aislado**

`pnpm --filter @contachile/web dev`. Visitar `http://localhost:3000/`.

> **Esperado pero NO arreglado todavía:** la landing seguirá mostrando el sidebar/header de la app encima, porque `app/layout.tsx` aún los renderiza. Lo que sí debe pasar:
> - La URL `/` responde 200 (no 404).
> - Consola sin warnings sobre `Script strategy`.
> - JSON-LD presente en el DOM (DevTools → Elements → buscar `application/ld+json`).

- [ ] **Step 6.5: Commit**

```bash
git add "apps/web/app/(marketing)"
git commit -m "refactor(web): move landing to (marketing) route group, fix Script strategy"
```

---

## Task 7: Route group `(auth)` — separar login/sign-up

**Files:**
- Create: `apps/web/app/(auth)/layout.tsx`
- Move: `apps/web/app/login/` → `apps/web/app/(auth)/login/`
- Move: `apps/web/app/sign-up/` → `apps/web/app/(auth)/sign-up/`

- [ ] **Step 7.1: Crear directorio y layout**

Bash:
```bash
mkdir -p "apps/web/app/(auth)"
```
PowerShell:
```powershell
New-Item -ItemType Directory -Path "apps\web\app\(auth)" -Force
```

Crear `apps/web/app/(auth)/layout.tsx`:

```tsx
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Autenticación",
  robots: { index: false, follow: false },
}

// Layout minimal centrado para login / sign-up. Sin sidebar.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
```

- [ ] **Step 7.2: Mover `login` y `sign-up`**

Bash:
```bash
git mv "apps/web/app/login" "apps/web/app/(auth)/login"
git mv "apps/web/app/sign-up" "apps/web/app/(auth)/sign-up"
```
PowerShell:
```powershell
git mv "apps\web\app\login" "apps\web\app\(auth)\login"
git mv "apps\web\app\sign-up" "apps\web\app\(auth)\sign-up"
```

- [ ] **Step 7.3: Smoke test**

`pnpm --filter @contachile/web dev`. Visitar `/login` y `/sign-up`. Esperado:
- Páginas cargan (no 404).
- Aún se renderizan con el shell de la app — esto se arregla en la Task 8.
- Clerk widget aparece centrado dentro del layout `(auth)`.

- [ ] **Step 7.4: Commit**

```bash
git add "apps/web/app/(auth)" apps/web/app/login apps/web/app/sign-up
git commit -m "refactor(web): move auth pages to (auth) route group with minimal layout"
```

---

## Task 8: Route group `(app)` — extraer shell autenticado

**Files:**
- Create: `apps/web/app/(app)/layout.tsx`
- Modify: `apps/web/app/layout.tsx` — quitar shell
- Move: cada subdirectorio autenticado a `(app)/`

> Tarea de mayor blast radius. Cada `git mv` es atómico por commit. Si algo se rompe, `git revert` deshace.

- [ ] **Step 8.1: Crear `(app)/layout.tsx`**

Bash:
```bash
mkdir -p "apps/web/app/(app)"
```
PowerShell:
```powershell
New-Item -ItemType Directory -Path "apps\web\app\(app)" -Force
```

Crear `apps/web/app/(app)/layout.tsx`:

```tsx
"use client"

import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { ChatWidget } from "@/components/ai/chat-widget"
import { useSidebarState } from "@/components/layout/sidebar-state-provider"
import { cn } from "@/lib/utils"

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebarState()

  return (
    <>
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
    </>
  )
}
```

- [ ] **Step 8.2: Limpiar `app/layout.tsx` root**

Edit `apps/web/app/layout.tsx`. Reemplazar la función `RootLayout` (líneas 72-97) por:

```tsx
export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html
        lang="es"
        suppressHydrationWarning
        className={`${fraunces.variable} ${dmSans.variable} ${jetBrainsMono.variable}`}
      >
        <body className="font-sans antialiased">
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
```

Eliminar los imports ya no usados al inicio del archivo:
- `import { Sidebar } from "@/components/layout/sidebar"`
- `import { Header } from "@/components/layout/header"`
- `import { ChatWidget } from "@/components/ai/chat-widget"`

Verificar:
```bash
grep -n "Sidebar\|Header\|ChatWidget" apps/web/app/layout.tsx
```
Expected: 0 resultados.

- [ ] **Step 8.3: Mover subdirectorios autenticados a `(app)/`**

Lista a mover (todos los actuales en `apps/web/app/` excepto `api`, `(marketing)`, `(auth)`, archivos sueltos):

```
ai, banco, contabilidad, dashboard, documents, emit, f22, f29,
honorarios, inventario, libro-compras, libro-ventas, purchases,
remuneraciones, settings, ventas
```

Bash:
```bash
for d in ai banco contabilidad dashboard documents emit f22 f29 honorarios inventario libro-compras libro-ventas purchases remuneraciones settings ventas; do
  git mv "apps/web/app/$d" "apps/web/app/(app)/$d"
done
```

PowerShell:
```powershell
$dirs = @('ai','banco','contabilidad','dashboard','documents','emit','f22','f29','honorarios','inventario','libro-compras','libro-ventas','purchases','remuneraciones','settings','ventas')
foreach ($d in $dirs) {
  git mv "apps\web\app\$d" "apps\web\app\(app)\$d"
}
```

- [ ] **Step 8.4: Verificar el contenido residual de `app/`**

```bash
ls apps/web/app/
```

Expected (sólo estos):
- Directorios: `(app)/`, `(auth)/`, `(marketing)/`, `api/`
- Archivos: `globals.css`, `layout.tsx`, `providers.tsx`, `error.tsx`, `loading.tsx`, `robots.ts`, `sitemap.ts`

Nada más debe quedar suelto.

- [ ] **Step 8.5: Verificar imports `@/` siguen resolviendo**

```bash
pnpm --filter @contachile/web build
```
Expected: build pasa. Los alias `@/` apuntan a `apps/web/` (no a una subcarpeta), así que la mudanza no los rompe. Si algún archivo usa imports relativos `../../`, fallarán: corregir a `@/`.

- [ ] **Step 8.6: Smoke test completo**

`pnpm --filter @contachile/web dev`. Verificar las 4 rutas críticas:

1. **GET /** → Landing pública SIN sidebar/header/chatwidget. Solo contenido marketing.
2. **GET /login** → Form Clerk centrado, SIN sidebar/header.
3. **GET /dashboard** → Dashboard CON sidebar, header, chatwidget, padding correcto.
4. **Colapsar sidebar en /dashboard** → contenido se ajusta de `lg:pl-64` a `lg:pl-16` con animación. Refrescar → persiste.
5. **Tab desde body** → primer focus debe ser "Saltar al contenido" link (visible al recibir focus).

> Si en `/` aparece doble header o sidebar, repasar `apps/web/app/layout.tsx` — sobró un import o el JSX.

- [ ] **Step 8.7: Commit**

```bash
git add apps/web/app
git commit -m "refactor(web): route groups (marketing|auth|app), shell only on (app) layout"
```

---

## Task 9: Fix hidratación de `formatNow()` en Header

**Files:**
- Modify: `apps/web/components/layout/header.tsx`

- [ ] **Step 9.1: Editar el Header**

Edit `apps/web/components/layout/header.tsx`. Reemplazar el contenido completo del archivo por:

```tsx
"use client"

import { UserButton } from "@clerk/nextjs"
import { usePathname } from "next/navigation"
import Link from "next/link"
import { useEffect, useState } from "react"
import { ThemeToggle } from "@/components/layout/theme-toggle"

const sectionTitles: Record<string, string> = {
  dashboard: "Resumen",
  documents: "Documentos",
  emit: "Emisión de DTE",
  settings: "Configuración",
  purchases: "Compras",
  honorarios: "Honorarios",
  f29: "F29 Mensual",
  f22: "F22 Anual",
  "libro-ventas": "Libro de Ventas",
  "libro-compras": "Libro de Compras",
  contabilidad: "Contabilidad",
  puc: "Plan de Cuentas",
  "libro-diario": "Libro Diario",
  mayor: "Libro Mayor",
  reportes: "Reportes",
  "balance-comprobacion": "Balance de Comprobación",
  "estado-resultados": "Estado de Resultados",
  "balance-general": "Balance General",
  banco: "Tesorería",
  conciliacion: "Conciliación Bancaria",
  inventario: "Inventario",
  productos: "Productos",
  movimientos: "Kardex",
  remuneraciones: "Remuneraciones",
  trabajadores: "Trabajadores",
  liquidaciones: "Liquidaciones",
  exportaciones: "PreviRed / DDJJ",
  ai: "Agentes IA",
  ventas: "Ventas",
  cotizaciones: "Cotizaciones",
}

function buildCrumbs(pathname: string): Array<{ label: string; href: string }> {
  const segments = pathname.split("/").filter(Boolean)
  return segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/")
    const label =
      sectionTitles[seg] ??
      seg.charAt(0).toUpperCase() + seg.slice(1).replace(/-/g, " ")
    return { label, href }
  })
}

function formatDateEs(d: Date): string {
  return d.toLocaleDateString("es-CL", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  })
}

export function Header() {
  const pathname = usePathname()
  const crumbs = buildCrumbs(pathname)
  const title = crumbs[crumbs.length - 1]?.label ?? "ContaChile"

  // Hidratación segura: formatear la fecha sólo después del mount para
  // evitar mismatch SSR/CSR (servidor y cliente pueden tener relojes distintos).
  const [dateLabels, setDateLabels] = useState<{
    pretty: string
    year: string
  } | null>(null)

  useEffect(() => {
    const now = new Date()
    setDateLabels({
      pretty: formatDateEs(now),
      year: String(now.getFullYear()),
    })
  }, [])

  return (
    <header className="sticky top-0 z-30 w-full border-b border-border bg-paper/95 backdrop-blur-sm supports-[backdrop-filter]:bg-paper/70">
      <div className="container py-4">
        <div className="flex items-end justify-between gap-4">
          <div className="min-w-0 flex-1">
            {crumbs.length > 1 && (
              <nav
                aria-label="Migas de pan"
                className="mb-1.5 flex items-center gap-1.5 text-xs text-muted-foreground/80"
              >
                {crumbs.slice(0, -1).map((c, i) => (
                  <span key={c.href} className="flex items-center gap-1.5">
                    <Link
                      href={c.href}
                      className="hover:text-foreground transition-colors"
                    >
                      {c.label}
                    </Link>
                    {i === crumbs.length - 2 ? (
                      <span aria-hidden="true" className="text-muted-foreground/50">
                        ›
                      </span>
                    ) : (
                      <span aria-hidden="true" className="text-muted-foreground/50">
                        /
                      </span>
                    )}
                  </span>
                ))}
              </nav>
            )}
            <h1 className="font-display text-2xl md:text-3xl font-semibold leading-none tracking-tightest text-foreground truncate">
              {title}
            </h1>
          </div>

          <div className="flex items-center gap-5">
            <div className="hidden md:flex flex-col items-end leading-tight min-w-[12rem]">
              <span className="eyebrow !text-[0.6rem]">
                {dateLabels?.pretty ?? " "}
              </span>
              <span className="font-mono text-[0.65rem] text-muted-foreground/70 mt-0.5">
                {dateLabels?.year ? `ed. nº ${dateLabels.year}` : " "}
              </span>
            </div>
            <div className="h-8 w-px bg-border hidden md:block" />
            <ThemeToggle />
            <UserButton
              appearance={{
                elements: {
                  avatarBox: "h-8 w-8 ring-1 ring-border",
                },
              }}
            />
          </div>
        </div>
      </div>
    </header>
  )
}
```

> Cambios incluidos:
> - `useEffect` + `useState` para formatear fecha sólo después de mount → cero hydration mismatch.
> - ` ` (NBSP) como placeholder reserva el espacio del layout antes de hidratar (evita CLS).
> - `min-w-[12rem]` fija el ancho del bloque fecha/edición.
> - `<nav aria-label="Migas de pan">` cumple a11y.
> - Bug del separador duplicado en breadcrumbs (`/` + `›` cuando crumbs.length===2) corregido al pasar de doble `if` a `if/else`.

- [ ] **Step 9.2: Smoke test**

`pnpm --filter @contachile/web dev`. Abrir DevTools console y refrescar `/dashboard` (con throttling "Slow 3G" para amplificar el delay). Verificar:
- No hay warning `Hydration failed because the initial UI does not match...`.
- La fecha aparece tras el primer paint (placeholder NBSP previo).
- Año y fecha provienen del cliente.

- [ ] **Step 9.3: Commit**

```bash
git add apps/web/components/layout/header.tsx
git commit -m "fix(web): hydrate date strings on client to avoid SSR/CSR mismatch"
```

---

## Task 10: Smoke test integral y cleanup

**Files:** sólo verificación.

- [ ] **Step 10.1: Type check completo**

```bash
pnpm --filter @contachile/web build
pnpm --filter @contachile/validators build
```
Expected: ambos pasan sin errores.

- [ ] **Step 10.2: Lint**

```bash
pnpm --filter @contachile/web lint
```
Expected: 0 errores nuevos (warnings preexistentes aceptables).

- [ ] **Step 10.3: Tests de validators**

```bash
pnpm --filter @contachile/validators test
```
Expected: PASS — todos los tests (RUT + nuevos de format).

- [ ] **Step 10.4: Manual smoke matrix**

`pnpm --filter @contachile/web dev` y verificar uno por uno:

| Ruta | Debe tener | NO debe tener |
|---|---|---|
| `/` | Hero, features, pricing, footer marketing | Sidebar, Header app, ChatWidget |
| `/login` | Clerk SignIn centrado | Sidebar, Header app |
| `/sign-up` | Clerk SignUp centrado | Sidebar, Header app |
| `/dashboard` | Sidebar, Header, ChatWidget, masthead, stats | doble header, hydration warnings |
| `/dashboard` (colapsar) | sidebar `w-16`, padding `lg:pl-16` | gap entre sidebar y contenido |
| `/dashboard` (refresh tras colapsar) | sidebar mantiene `w-16` | reset a `w-64` |
| `/purchases` (form RUT) | máscara en vivo, error si DV inválido | input que acepta caracteres no numéricos |
| `/purchases` (monto `1.000.000`) | guarda 1000000 | NaN, error de save |
| `/honorarios` (montos visibles) | `$ 500.000` con espacio | `$500.000` o `500000` |
| Tab desde body en `/dashboard` | "Saltar al contenido" visible al focus | invisible |

- [ ] **Step 10.5: Buscar imports muertos**

```bash
grep -rn "from \"next/script\"" apps/web/app/
```
Si queda un import sin uso en alguna page, eliminar.

```bash
grep -rn "const fmt = " apps/web/app/ apps/web/components/
```
Expected: 0 resultados (o sólo helpers no-CLP).

- [ ] **Step 10.6: Cleanup de archivos temporales**

Verificar que no quedaron archivos `_tmp_*` adentro de `apps/web/`:
```bash
find apps/web -name "_tmp_*"
```
Si los hay, eliminarlos.

> Nota: los dos `_tmp_20_*` del root del repo NO se tocan, están fuera del scope.

- [ ] **Step 10.7: Commit final si quedó algo**

```bash
git status
```
Si hay cambios sin commit:
```bash
git add -p
git commit -m "chore(web): cleanup after architecture refactor"
```

Si está limpio: nada que commitear.

- [ ] **Step 10.8: Revisión de historia**

```bash
git log --oneline -12
```
Confirmar que los 9-10 commits del plan están en orden con mensajes claros. **No** hacer push aún — el usuario decide cuándo y cómo (PR vs. merge directo).

---

## Spec coverage check

| Hallazgo auditoría | Task que lo resuelve |
|---|---|
| #1 Landing dentro del shell | Task 6 + Task 8 |
| #2 Middleware permite `/` público pero shell siempre se renderiza | Task 8 (al sacar shell de root, ya no es problema) |
| #3 Doble offset por div fantasma | Task 5 (div fantasma eliminado en sidebar.tsx) + Task 8 (padding dinámico) |
| #4 Hidratación `new Date()` en header | Task 9 |
| #5 Sidebar collapsed no sync con layout | Task 5 + Task 8 (Context + padding consumiendo state) |
| #11 Formato CLP inconsistente | Task 1 + Task 2 |
| #12 `Number()` raw en inputs CLP | Task 1 + Task 4 |
| #13 RUT sin máscara ni validación | Task 3 |
| Script strategy | Task 6.3 |
| #27 aria-label landmarks en sidebar/sheet | Task 5.3 |
| #62 Breadcrumb separador duplicado | Task 9.1 (incidental) |
| skip-link a main | Task 8.1 |

### Hallazgos del bloque A no cubiertos:
- **Ninguno crítico.** `aria-current` para active links se aborda en Plan C (Accesibilidad transversal).

### Placeholder scan
- ✅ Todas las tareas con código incluyen el snippet completo.
- ✅ Todos los paths son absolutos al repo.
- ✅ No hay "TODO", "implementar después", "similar a Task N".

### Type consistency
- `formatCLP(value: number | null | undefined): string` — Tasks 1, 2.
- `parseCLP(value: string | null | undefined): number` — Tasks 1, 4.
- `useRutInput(value: string, setValue: (raw: string) => void)` — Task 3.
- `<RutField id, label, value, onChange, required?, placeholder?>` — Task 3 (3.2 define, 3.4–3.6 consumen).
- `useSidebarState(): SidebarState` con `collapsed | mobileOpen | toggleCollapsed | setCollapsed | setMobileOpen` — Tasks 5, 8.

---

## Risks & rollback notes

1. **Si la mudanza a `(app)/` rompe imports relativos**: los alias `@/` apuntan a `apps/web/`, no a la carpeta de la página, así que siguen funcionando. Si una página usa `../../components/...`, falla. Convertir a `@/components/...`.
2. **Si `git mv` no preserva history**: usar `git log --follow apps/web/app/(app)/dashboard/page.tsx` para verificar después.
3. **Si Clerk se queja del middleware después del move**: el matcher en `middleware.ts:29` es catch-all (`'/((?!.*\\..*|_next).*)'`), así que las rutas dentro de `(group)/...` siguen capturadas — los route groups no aparecen en la URL.
4. **Para rollback rápido de cualquier task**: `git revert <sha>`. Cada task es un commit autónomo.
