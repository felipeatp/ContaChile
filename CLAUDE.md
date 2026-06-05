# CLAUDE.md

Guía para Claude Code al trabajar en este repositorio.

## Qué es

**ContAI / ContaChile** — SaaS chileno de contabilidad y tributación (DTE, F29/F22,
remuneraciones, inventario, conciliación bancaria, agentes IA). Monorepo Turborepo en
producción, NO es documentación-only.

## Estructura

```
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
```

## Comandos

```bash
pnpm dev                         # turbo: todos los servicios
pnpm build                       # turbo build
pnpm test                        # turbo test
pnpm lint                        # turbo lint
pnpm --filter web dev            # solo web
pnpm --filter api dev            # solo api
pnpm --filter @contachile/dte test
```

> Nota tests web: el runner Jest deja open handles; correr con
> `--forceExit --runInBand` (vía `node apps/web/node_modules/jest/bin/jest.js`) para
> evitar que el proceso quede colgado.

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
  oxblood/ochre/sage/rust), serif display, `tabular-nums` en números.

## Restricciones de dominio

- **RUT:** validación módulo 11 (`@contachile/validators`).
- **IVA:** 19% del neto, truncado a entero.
- **DTE:** XML en ISO-8859-1 (no UTF-8).
- **Certificación SII:** maullin.sii.cl (test) / api.sii.cl (prod). Bridge Acepta para MVP.

## Testing

- API: Vitest en `apps/api/tests/`. Web unit: en `apps/web/__tests__`. E2E: Playwright
  en `apps/web/e2e/`. Gate de cobertura 80% en CI.
