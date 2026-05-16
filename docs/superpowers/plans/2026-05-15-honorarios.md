# Boletas de Honorarios — Implementation Plan (Módulo 4)

> Un commit por tarea.

---

## Task 1: Schema Prisma

- [ ] Agregar al schema: enums `HonorarioType`, `HonorarioStatus`, modelo `Honorario`
- [ ] `prisma db push`
- [ ] Commit: `feat(db): add Honorario model`

---

## Task 2: Validators + cálculo

- [ ] Crear `packages/validators/src/honorarios.ts`:
  - `RETENCION_HONORARIOS_RATE = 0.1375`
  - `calcularRetencionHonorarios(gross, rate?)`
  - `CreateHonorarioSchema`, `UpdateHonorarioSchema`
- [ ] Exportar desde index
- [ ] Build validators
- [ ] Commit: `feat(validators): add honorarios calculator and schemas`

---

## Task 3: API routes + asiento auto

- [ ] Crear `apps/api/src/routes/honorarios.ts` con CRUD + summary
- [ ] Agregar `createHonorarioEntry` en `apps/api/src/lib/accounting-entries.ts`:
  - Solo para `type=RECEIVED`
  - Líneas: 5101 Honorarios D / 2110 Impuestos por pagar H (retention) / 2101 Proveedores H (net)
- [ ] Wire desde POST /honorarios (cuando type=RECEIVED)
- [ ] Registrar ruta en index
- [ ] Commit: `feat(api): add honorarios CRUD with auto journal entry`

---

## Task 4: UI

- [ ] Proxies Next.js para `/honorarios` y `/honorarios/:id`
- [ ] Página `/honorarios/page.tsx`: filtros, summary cards, tabla, modal form con preview de retención
- [ ] Sidebar nav: "Honorarios"
- [ ] Build web
- [ ] Commit: `feat(web): add honorarios page`

---

## Task 5: Smoke test

- [ ] `apps/api/scripts/smoke-honorarios.ts`:
  - BHE ISSUED $1M → retention $137.500, líquido $862.500
  - BHE RECEIVED $500K → retention $68.750, líquido $431.250, asiento creado
  - Filtros por tipo
- [ ] Correr y commit
