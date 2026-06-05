# Sprint 12 — Consistencia y Robustez UX (Design)

**Fecha:** 2026-06-05
**Estado:** Aprobado — listo para plan de implementación
**Origen:** Análisis crítico de UI/UX posterior al Sprint 11.

## Contexto

Tras el Sprint 11 (accesibilidad, password strength, tests) un análisis del frontend
reveló inconsistencias y un bug funcional que degradan la calidad percibida más que
cualquier feature nueva. Este sprint no agrega funcionalidad de negocio: corrige
robustez, consistencia y un bug de datos.

No hay decisiones visuales nuevas — el design system editorial existente (tokens en
`globals.css`, paleta `oxblood/ochre/sage/rust`, `tabular-nums`, serif display) se
mantiene tal cual.

## Objetivos

1. El dashboard muestra datos reales y se calcula de forma eficiente.
2. Toda la app usa el mismo lenguaje de feedback (toasts y modales propios; cero
   `alert()`/`confirm()` nativos).
3. El menú de usuario es accesible por teclado y touch.
4. Las listas distinguen "cargando" / "error" / "vacío".
5. Las búsquedas en vivo no disparan un request por tecla.
6. La documentación del repo (CLAUDE.md) y la raíz reflejan el estado real.

## No-objetivos (YAGNI)

- No se rediseña ninguna pantalla ni el design system.
- No se agrega paginación/infinite-scroll nuevo (ya existe).
- No se refactoriza código no relacionado con estos seis objetivos.

---

## A. Dashboard: datos reales + endpoint de stats

### Problema

`apps/web/app/(app)/dashboard/page.tsx` (`getStats`) hace `fetch(NEXT_PUBLIC_APP_URL + '/api/documents?limit=1000')` desde un Server Component **sin reenviar cookies**. En Next.js el fetch de servidor no propaga las cookies del request entrante, así que `/api/documents/route.ts` recibe sin cookie → reenvía sin cookie al backend → backend responde 4xx → la ruta lo traga y devuelve `{ documents: [] }` con status 200. Resultado: stats y gráficos en cero. Además trae hasta 1000 filas para agregarlas en el cliente (`StatsCards`/charts con `.filter()/.reduce()`).

### Diseño

- **Nuevo endpoint** `GET /documents/stats` en `apps/api/src/routes/dte/documents.ts`.
  Devuelve agregaciones calculadas en la base (sin traer filas):
  - `total`: count total de documentos de la empresa.
  - `byStatus`: count por `status` (PENDING/ACCEPTED/REJECTED/FAILED) vía `groupBy`.
  - `emittedToday`: count con `emittedAt` dentro del día actual.
  - `monthly`: serie de los últimos 12 meses `{ month, count, totalAmount }`.
  - `yoy`: comparación del período actual vs. mismo período del año anterior
    (monto y conteo), reutilizando la lógica de `buildContextSnapshot` donde aplique.
  - Filtra siempre por `request.companyId` (tenancy).
- **Cache Redis** por `companyId`, TTL 5 min, mismo patrón que `buildContextSnapshot`
  (`apps/api/src/lib/redis.ts` → `createRedisClient`). Key sugerida:
  `stats:documents:{companyId}`. Cache invalidada de forma natural por TTL (no se
  agrega invalidación activa en este sprint).
- **El dashboard** pasa a llamar `apiFetch('/documents/stats')` **directo** desde el
  Server Component (reenvía cookie vía `headers()`, igual que `lib/api-server.ts`).
  Se elimina el rodeo por `/api/documents` y el `limit=1000`.
- **Componentes** `StatsCards`, `DocumentsChart`, `StatusChart` cambian su prop de
  `Document[]` a un tipo `DocumentStats` pre-agregado. Los "documentos recientes"
  siguen viniendo de un fetch acotado (`limit=5`).

### Tipo compartido

```ts
interface DocumentStats {
  total: number
  emittedToday: number
  byStatus: { pending: number; accepted: number; rejected: number; failed: number }
  monthly: Array<{ month: string; count: number; totalAmount: number }>
  yoy: { current: number; previous: number; deltaPct: number }
}
```

Se define en `@contachile/validators` (o `types/`) para compartir entre API y web.

---

## B. Reemplazo de `alert()` y `confirm()` nativos

### Problema

16 `alert()` (en `documents`, `documents/[id]`, `banco/conciliacion`,
`ventas/cotizaciones`, `contador/tesoreria/conciliacion`) y 3 `confirm()` (en
`honorarios`, `inventario/productos`, `ventas/cotizaciones`) nativos. Rompen la
estética; ya existen `sonner` (toasts) y `components/ui/confirm-modal.tsx`.

### Diseño

- **`alert()` → `toast`** de sonner: `toast.error` para fallos, `toast.success` para
  éxitos, `toast.info` para informativos. Sonner ya está montado en `(app)/layout.tsx`.
- **`confirm()` → hook `useConfirm()` global (promise-based)** — *decisión aprobada*.
  - Un `ConfirmProvider` montado en `(app)/layout.tsx` con un único `<ConfirmModal>`.
  - API: `const ok = await confirm({ title, description?, confirmLabel?, destructive? })`
    → resuelve `true`/`false`.
  - Internamente: estado `{ open, opts, resolve }`; `confirm()` setea el estado y
    devuelve una promesa que resuelve en `onConfirm`/`onCancel`.
  - Reutiliza el `ConfirmModal` existente (que ya usa `Modal` con focus trap).

---

## C. Menú de usuario accesible

### Problema

`UserMenu` en `header.tsx` usa un dropdown solo-hover (`group-hover:opacity-100`) sin
`onClick` ni manejo de foco → inalcanzable por teclado y por touch (en móvil "Cambiar
perfil" y "Cerrar sesión" no se pueden abrir).

### Diseño — *Radix, decisión aprobada*

- Agregar dependencia `@radix-ui/react-dropdown-menu` (ya usan `@radix-ui/react-dialog`).
- Reescribir `UserMenu` con `DropdownMenu` de Radix: trigger es el avatar/iniciales;
  contenido con items "Cambiar perfil" (Link) y "Cerrar sesión" (signOut).
- Gratis: foco al abrir, navegación por flechas, Escape, click-outside, soporte touch,
  roles ARIA correctos.
- Mantener el estilo visual actual (paper, border, sombras) vía `className` en los
  componentes de Radix.

---

## D. Estados de error en listas

### Problema

Solo 2 de 30 páginas manejan `isError` de React Query. Si una consulta falla, la
mayoría se queda en loading o muestra vacío silenciosamente, sin distinguir "no hay
datos" de "falló la carga".

### Diseño

- Componente reutilizable `components/ui/query-state.tsx`:
  ```tsx
  <QueryState
    isLoading={...} isError={...} isEmpty={...}
    onRetry={refetch}
    emptyMessage="..."
  >
    {children}
  </QueryState>
  ```
  - `isLoading` → skeleton/spinner.
  - `isError` → mensaje + botón "Reintentar" que llama `onRetry` (`refetch()`).
  - `isEmpty` → mensaje vacío (si la lista provee uno propio, se respeta).
- Aplicado a las páginas de lista que usan React Query: `documents`, `purchases`,
  `honorarios`, `inventario/productos`, `inventario/movimientos`,
  `ventas/cotizaciones`, `banco/conciliacion`, `remuneraciones/*`.

---

## E. Debounce en búsquedas

### Problema

`documents/page.tsx` actualiza `search` en cada tecla y ese valor entra directo al
`queryKey` de React Query → un request HTTP por pulsación.

### Diseño

- Nuevo hook `hooks/use-debounce.ts` (`useDebounce<T>(value, delay)`), el canónico de
  las reglas del proyecto.
- El valor **debounced** (300 ms) entra al `queryKey`; el input sigue mostrando el
  valor crudo (sin lag visual). Aplicado a la búsqueda de `documents` y demás búsquedas
  en vivo que filtran por query de servidor.

---

## F. Deuda menor

- **CLAUDE.md**: reescribir. Hoy dice "documentation-only repo, no codebase"; ya hay
  3 apps (`web`, `api`, `mobile`), 8 packages y ~30 páginas. Documentar: estructura
  real, comandos `turbo`/`pnpm`, patrón `apiFetch`/tenancy (cookie forwarding,
  `request.companyId`), flujo DTE, ubicación de tests.
- **Raíz**: mover `check-tables.mjs`, `create-auth-tables.mjs` a `scripts/`; mover o
  ignorar `login-test.png`, `login-test-2.png`, `mobile-dashboard.png`,
  `mobile-landing.png` (a `docs/` o `.gitignore`).
- **`loading.tsx`** por grupo de rutas en `(app)` para skeleton durante navegación de
  Server Components.

---

## Testing (estricto — TDD, 80%+)

- **Unit (API)** — mirror de `apps/api/tests/dte/documents.test.ts`:
  - `GET /documents/stats`: agregaciones correctas, filtro por `companyId`,
    serie mensual, YoY, cache hit/miss.
- **Unit (web)**:
  - `useDebounce`: respeta delay, cancela en cambios rápidos.
  - `useConfirm` / `ConfirmProvider`: resuelve true/false, cierra modal.
  - `QueryState`: renderiza correctamente loading/error(+retry)/empty/children.
- **E2E (Playwright)** — junto a los specs existentes en `apps/web/e2e/`:
  - Menú de usuario operable por teclado (Tab/Enter/flechas/Escape) y visible en móvil.
  - Flujo de error en lista con botón "Reintentar".
  - Eliminación que dispara `ConfirmModal` (reemplazo de `confirm()`).
- **Gate CI**: coverage 80%+, `pnpm build` y `pnpm lint` verdes.

## Orden de ejecución sugerido

1. **F** — Deuda (CLAUDE.md, raíz, loading.tsx). Rápido, despeja el terreno.
2. **E** — `useDebounce` + aplicar a búsquedas.
3. **D** — `QueryState` + aplicar a listas.
4. **B** — toasts + `useConfirm` global.
5. **C** — menú de usuario con Radix.
6. **A** — endpoint `/documents/stats` + dashboard (lo más grande, cierra el sprint).

## Riesgos

- **A** toca backend y cambia las props de 3 componentes de dashboard → mayor
  superficie de cambio; se deja al final y con tests primero.
- **C** agrega una dependencia (`@radix-ui/react-dropdown-menu`) → verificar bundle y
  que el estilo coincida con el design system.
- El cache de stats con TTL 5 min puede mostrar datos ligeramente desfasados tras una
  emisión; aceptable para un dashboard (no es la vista transaccional).
