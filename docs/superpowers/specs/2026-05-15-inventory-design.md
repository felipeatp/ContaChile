# Inventario Básico — Design Spec (Módulo 7)

## Goal

Implementar control de stock con valorización por costo promedio ponderado: alta de productos, movimientos (entrada/salida), kardex por producto, alertas de stock mínimo y auto-decrement al emitir DTE con items vinculados a productos.

Esto desbloquea retail y comercio (segmentos con inventario). Sin inventario, perdemos a todo cliente que no sea solo servicios.

## Context

- DTE emite items con `description`, `quantity`, `unitPrice` pero **sin** `productId`. Para auto-decrement necesitamos agregar la referencia opcional.
- Purchase es header-only (sin items). Para entrada de stock vía compra: opción manual ("Recibir inventario") referenciando una Purchase opcional.
- pdfkit ya disponible para futuros reportes (kardex PDF).

## Architecture

### Modelos Prisma

```prisma
enum InventoryMovementType {
  IN       // entrada (compra, ajuste positivo, devolución cliente)
  OUT      // salida (venta DTE, ajuste negativo, devolución a proveedor)
}

model Product {
  id          String   @id @default(cuid())
  companyId   String
  code        String
  name        String
  description String?
  unit        String   @default("unidad")  // 'unidad' | 'kg' | 'litro' | etc
  salePrice   Int                          // precio venta sin IVA (CLP)
  costPrice   Int                          // costo unitario actual (promedio ponderado)
  stock       Int      @default(0)         // cantidad actual
  minStock    Int      @default(0)         // umbral para alerta
  affectedIVA Boolean  @default(true)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt
  movements   InventoryMovement[]

  @@unique([companyId, code])
  @@index([companyId])
  @@index([isActive])
}

model InventoryMovement {
  id            String                @id @default(cuid())
  companyId     String
  productId     String
  type          InventoryMovementType
  quantity      Int                   // siempre positivo
  unitCost      Int                   // costo unitario al momento
  reason        String                // 'manual' | 'dte' | 'purchase' | 'adjustment'
  reference     String?               // folio DTE, número compra, etc.
  documentItemId String?              // si proviene de DocumentItem
  notes         String?
  createdAt     DateTime              @default(now())

  product       Product               @relation(fields: [productId], references: [id])

  @@index([companyId])
  @@index([productId])
  @@index([createdAt])
}
```

Adicionalmente, agregar campo opcional `productId` a `DocumentItem`:

```prisma
model DocumentItem {
  // ... existing fields
  productId   String?   // FK opcional para auto-decrement
}
```

### Valorización: costo promedio ponderado

Algoritmo en cada entrada (IN):
```
new_avg = (old_stock * old_avg + quantity * unit_cost) / (old_stock + quantity)
new_stock = old_stock + quantity
```

Si `old_stock + quantity == 0`: keep old_avg (no update).

En salida (OUT):
- `unitCost` del movimiento = `product.costPrice` actual (snapshot)
- `new_stock = old_stock - quantity` (puede ir a negativo si lo permitimos, o validar)

Decisión: permitir stock negativo con warning (algunos negocios despachan antes de recibir compra). Pero alerta en UI.

### Endpoints

| Método | Path | Descripción |
|--------|------|-------------|
| GET    | `/inventory/products?active=` | Lista |
| GET    | `/inventory/products/:id` | Detalle |
| POST   | `/inventory/products` | Crear (stock inicial via IN movement automático) |
| PATCH  | `/inventory/products/:id` | Editar metadata (no stock; usar movements) |
| DELETE | `/inventory/products/:id` | Soft delete (isActive=false) |
| GET    | `/inventory/movements/:productId?from=&to=` | Kardex |
| POST   | `/inventory/movements` | Movimiento manual (IN o OUT) |
| GET    | `/inventory/alerts` | Productos con stock <= minStock |

### Hook auto-decrement al emitir DTE

En `emit.ts`, después de crear `Document`, iterar `DocumentItem` y para cada uno con `productId`:
- Crear `InventoryMovement` OUT con `quantity` y `unitCost = product.costPrice`
- Actualizar `product.stock -= quantity`
- Log warn si stock queda negativo

Patrón idéntico al actual `createSalesEntry`: helper `recordSalesMovements(doc, items)` en `apps/api/src/lib/inventory-service.ts`.

### Validación

```typescript
export const CreateProductSchema = z.object({
  code: z.string().min(1).max(50),
  name: z.string().min(1).max(150),
  description: z.string().max(500).optional(),
  unit: z.string().max(20).default('unidad'),
  salePrice: z.number().int().min(0),
  costPrice: z.number().int().min(0),
  initialStock: z.number().int().min(0).default(0),
  minStock: z.number().int().min(0).default(0),
  affectedIVA: z.boolean().default(true),
})

export const InventoryMovementSchema = z.object({
  productId: z.string().cuid(),
  type: z.enum(['IN', 'OUT']),
  quantity: z.number().int().min(1),
  unitCost: z.number().int().min(0).optional(), // si OUT, default product.costPrice
  reason: z.string().max(50).default('manual'),
  reference: z.string().max(100).optional(),
  notes: z.string().max(300).optional(),
})
```

## UI

### `/inventario/productos`

- Lista con stock actual y badge rojo si stock <= minStock
- Filtros: activos/inactivos, buscar por nombre/código
- Modal de alta: code, name, unit, salePrice, costPrice, stock inicial, minStock
- Modal de edición: solo metadata (no stock)

### `/inventario/movimientos`

- Selector de producto → muestra kardex
- Tabla: fecha, tipo, cantidad, costo unitario, valor, razón, referencia
- Saldo acumulado en cada fila
- Botón "Nuevo movimiento" → modal: tipo, cantidad, unitCost (si IN), razón, notas

### Banner alertas (futuro)

Por ahora la página `/inventario/productos` muestra alertas inline (badge). Banner en dashboard se puede agregar más tarde.

## Error Handling

| Escenario | Comportamiento |
|----------|----------|
| Code duplicado en mismo company | 409 |
| OUT con stock insuficiente | Permitir pero log warn; UI muestra alerta |
| productId inválido en /movements | 400 |
| DELETE producto con movimientos | Soft delete (isActive=false), no permite hard delete |
| DTE con productId inexistente | Log warn, skip movement, no bloquea emisión |

## Testing Strategy

Smoke test `smoke-inventory.ts`:
1. Crear producto $1000 costo / $1500 venta / 10 unidades iniciales
2. IN de 5 más a costo $1200 → avg = (10*1000 + 5*1200)/15 = 1066,67 → redondeado 1067
3. OUT de 3 unidades → stock=12, movement.unitCost = 1067 (snapshot)
4. Crear DTE con DocumentItem.productId → auto-decrement stock
5. Verificar alerta cuando stock <= minStock

## Future Work

- Kardex en PDF
- Valorización FIFO como alternativa configurable
- Variantes (talla, color) — actualmente cada variante es un producto separado
- Códigos de barra escaneables
- Múltiples bodegas/sucursales
- Conteo físico y conciliación
- Cálculo automático de costo desde Purchase items (cuando Purchase tenga items)
