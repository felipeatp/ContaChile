# Conciliación Bancaria — Implementation Plan (Módulo 5)

> Un commit por tarea.

---

## Task 1: Schema Prisma

- [ ] Agregar `BankAccount` y `BankMovement` + enums `BankMovementType`, `BankMovementStatus`
- [ ] `prisma db push`
- [ ] Commit: `feat(db): add BankAccount and BankMovement models`

---

## Task 2: Package fintoc-client

- [ ] Crear `packages/fintoc-client/` con package.json, tsconfig, src/
- [ ] `src/index.ts` exporta `FintocClient`, tipos
- [ ] Modo simulador: lista 1 cuenta + 5 movimientos sintéticos
- [ ] Modo real: esqueleto con TODOs (fetch GET /links/.../accounts y movements)
- [ ] Build
- [ ] Agregar a `apps/api/package.json` como `workspace:*`
- [ ] Commit: `feat(fintoc-client): add Fintoc client with simulator mode`

---

## Task 3: Bank service (matching + reconciliación)

- [ ] Crear `apps/api/src/lib/bank-service.ts`:
  - `syncMovements(companyId, bankAccountId)`: llama Fintoc, upsert movimientos
  - `findMatchingDocument(movement)`: busca DTE coincidente
  - `findMatchingPurchase(movement)`: busca Compra coincidente
  - `reconcileMovement(movement, debitAccountId, creditAccountId, description)`: crea JournalEntry
- [ ] Commit: `feat(api): add bank reconciliation service`

---

## Task 4: API routes

- [ ] Crear `apps/api/src/routes/bank.ts`:
  - GET /bank/accounts
  - POST /bank/accounts/sync
  - GET /bank/movements (filtros status/from/to)
  - POST /bank/movements/:id/match-auto
  - POST /bank/movements/:id/classify (usa clasificarTransaccion)
  - POST /bank/movements/:id/reconcile
  - POST /bank/movements/:id/ignore
- [ ] Registrar en index
- [ ] Commit: `feat(api): add bank reconciliation endpoints`

---

## Task 5: UI

- [ ] Proxies Next.js: /api/bank/accounts, /api/bank/movements + acciones
- [ ] Página `/banco/conciliacion`:
  - Listado de cuentas con botón Sync
  - Tabs por status
  - Tabla de movimientos con acciones (Match Auto, IA, Conciliar, Ignorar)
  - Modal conciliación con selects de cuentas + pre-llenado de sugerencia IA
- [ ] Sidebar: "Conciliación Bancaria"
- [ ] Build web
- [ ] Commit: `feat(web): add bank reconciliation page`

---

## Task 6: Smoke test

- [ ] `apps/api/scripts/smoke-banking.ts`:
  - Setup BankAccount
  - Sync 5 movimientos simulados
  - Match auto contra DTEs/Compras existentes
  - Conciliar movimiento sin match → asiento creado
- [ ] Correr y commitear

---

## Pendientes futuros (NO en este sprint)

- OAuth widget Fintoc en frontend
- Worker BullMQ con cron 6 horas
- Reportes de cobertura de conciliación
