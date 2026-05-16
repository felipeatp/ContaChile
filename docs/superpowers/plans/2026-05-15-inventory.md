# Inventario Básico — Implementation Plan (Módulo 7)

> Un commit por tarea.

---

## Task 1: Schema Prisma

- [ ] Models `Product`, `InventoryMovement` + enum `InventoryMovementType`
- [ ] Agregar `productId String?` a `DocumentItem`
- [ ] `prisma db push`
- [ ] Commit: `feat(db): add Product and InventoryMovement models`

---

## Task 2: Validators

- [ ] `packages/validators/src/inventory.ts`: `CreateProductSchema`, `UpdateProductSchema`, `InventoryMovementSchema`
- [ ] Exportar
- [ ] Build
- [ ] Commit: `feat(validators): add inventory schemas`

---

## Task 3: inventory-service

- [ ] `apps/api/src/lib/inventory-service.ts`:
  - `createProduct(companyId, data)` — crea Product + IN inicial si stock>0
  - `recordMovement(companyId, productId, type, quantity, unitCost?, reason, reference?, notes?)` — actualiza stock + costPrice (avg)
  - `recordSalesMovements(documentId, items)` — para hook auto-decrement
- [ ] Commit: `feat(api): add inventory service with weighted average cost`

---

## Task 4: API routes

- [ ] `apps/api/src/routes/inventory.ts`:
  - GET/POST/PATCH/DELETE `/inventory/products`
  - GET `/inventory/movements/:productId` (kardex)
  - POST `/inventory/movements`
  - GET `/inventory/alerts`
- [ ] Registrar en index
- [ ] Commit: `feat(api): add inventory CRUD and movements endpoints`

---

## Task 5: Hook en emit.ts

- [ ] En `apps/api/src/routes/dte/emit.ts`: después de crear Document, llamar `recordSalesMovements`. Solo afecta items con productId.
- [ ] No bloquea emisión si falla.
- [ ] Commit: `feat(api): wire auto-decrement on DTE emit when items have productId`

---

## Task 6: UI

- [ ] Proxies `/api/inventory/products` y `/api/inventory/movements`
- [ ] Página `/inventario/productos`: tabla con stock, badge alerta, modal alta/edición
- [ ] Página `/inventario/movimientos`: selector de producto + kardex, modal de nuevo movimiento
- [ ] Sidebar: "Productos" y "Movimientos"
- [ ] Build
- [ ] Commit: `feat(web): add inventory pages`

---

## Task 7: Smoke test

- [ ] `smoke-inventory.ts`: crear producto con stock inicial, IN con costo distinto (avg ponderado), OUT con snapshot de costo, alerta minStock, auto-decrement vía emit (con DocumentItem.productId)
- [ ] Correr y commitear
