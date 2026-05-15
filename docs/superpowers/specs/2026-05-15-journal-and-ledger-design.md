# Libro Diario y Mayor — Design Spec

## Goal

Implementar el módulo de contabilidad general: registrar asientos contables (manuales o automáticos), consultar libro diario (cronológico) y libro mayor (por cuenta). Es el cimiento que convierte a ContaChile en un software contable real (no solo un facturador). Habilita estados financieros del Módulo 1B.

## Context

El proyecto ya tiene:
- Modelo `Account` con PUC base de 50 cuentas semilla (seed en creación de empresa).
- Modelo `Document` (ventas emitidas, totalNet/totalTax/totalAmount).
- Modelo `Purchase` (compras de proveedores, netAmount/taxAmount/totalAmount).
- Patrón: validators Zod en `packages/validators`, routes Fastify en `apps/api/src/routes`, páginas Next.js en `apps/web/app/(...)`, proxies en `apps/web/app/api/(...)`.
- Multi-tenant por `companyId` inyectado en `request.companyId` via `tenantPlugin`.

No existe ningún modelo de asientos contables aún.

## Architecture

### Nuevos modelos Prisma

```prisma
model JournalEntry {
  id          String        @id @default(cuid())
  companyId   String
  date        DateTime
  description String
  reference   String?       // Folio DTE, número compra, etc.
  source      String        // 'manual' | 'dte' | 'purchase'
  sourceId    String?       // ID del Document o Purchase de origen
  createdAt   DateTime      @default(now())
  lines       JournalLine[]

  @@index([companyId])
  @@index([date])
  @@index([source])
}

model JournalLine {
  id             String       @id @default(cuid())
  journalEntryId String
  accountId      String
  debit          Int          @default(0)   // CLP enteros (consistencia con totalAmount)
  credit         Int          @default(0)
  description    String?

  journalEntry   JournalEntry @relation(fields: [journalEntryId], references: [id], onDelete: Cascade)
  account        Account      @relation(fields: [accountId], references: [id])

  @@index([journalEntryId])
  @@index([accountId])
}
```

Se agrega `lines JournalLine[]` al model `Account` existente (relación inversa).

### Invariantes

- Para todo `JournalEntry`: `SUM(lines.debit) === SUM(lines.credit) > 0` (asiento cuadrado y no nulo).
- Cada `JournalLine` tiene exactamente uno de `debit` o `credit` mayor que cero (no ambos).
- Las cuentas referenciadas deben pertenecer al mismo `companyId` y estar `isActive=true`.
- `JournalEntry` con `source='dte'` o `source='purchase'` se crea automáticamente y no es editable desde UI manual.

### API endpoints

| Método | Path | Descripción |
|--------|------|-------------|
| GET    | `/accounting/journal` | Lista asientos paginada (filtros: `from`, `to`, `source`, `page`, `limit`) |
| GET    | `/accounting/journal/:id` | Detalle de un asiento con sus líneas y cuentas |
| POST   | `/accounting/journal` | Crear asiento manual (validación cuadratura) |
| GET    | `/accounting/ledger/:accountId` | Movimientos de una cuenta en rango de fechas |

### Asientos automáticos

Tipo `dte` (al emitir factura tipo 33):

| Cuenta (código PUC) | Débito | Crédito |
|---------------------|--------|---------|
| 1103 Clientes       | total  | —       |
| 4100 Ingresos por ventas | — | neto    |
| 2111 IVA Débito Fiscal | —   | tax     |

Tipo `purchase` (al registrar compra tipo 33):

| Cuenta (código PUC) | Débito | Crédito |
|---------------------|--------|---------|
| 5220 Gastos diversos (default) | neto | — |
| 1115 IVA Crédito Fiscal | tax | —     |
| 2101 Proveedores    | —      | total   |

**Mapeo de categorías de compra a cuenta de gasto** (heurístico, opcional):

| `Purchase.category` | Código PUC |
|---------------------|-----------|
| `personal` | 5100 Gastos de personal |
| `honorarios` | 5101 Honorarios |
| `arriendo` | 5110 Gastos de arriendo |
| `servicios_basicos` | 5120 Servicios básicos |
| `mantenimiento` | 5130 Mantenimiento |
| `viaje` | 5140 Gastos de viaje |
| `marketing` | 5150 Gastos de marketing |
| `oficina` | 5160 Gastos de oficina |
| `seguros` | 5200 Seguros |
| (cualquier otra / null) | 5220 Gastos diversos |

Si el código PUC no se encuentra (porque el seed no se ejecutó), el helper **omite** el asiento y registra un warning en log — la creación del DTE/Purchase sigue siendo exitosa. Nunca bloquea el flujo principal.

### Data Flow — Emisión DTE

```
POST /dte/emit
  → crea Document
  → enqueuePollJob
  → createSalesEntry(doc)           [NUEVO]
       ├─ busca cuentas 1103, 4100, 2111 por companyId+code
       ├─ si alguna falta → log.warn y retorna sin crear asiento
       └─ crea JournalEntry con 3 líneas
  → responde 201
```

### Data Flow — Registro de Compra

```
POST /purchases
  → crea Purchase
  → createPurchaseEntry(purchase)   [NUEVO]
       ├─ resuelve cuenta de gasto desde Purchase.category (o 5220 default)
       ├─ busca cuentas 1115, 2101 + cuenta resuelta
       ├─ si alguna falta → log.warn y retorna sin crear asiento
       └─ crea JournalEntry con 3 líneas (gasto, IVA, proveedores)
  → responde 201
```

## Validación

`packages/validators/src/journal.ts`:

```typescript
export const JournalLineSchema = z.object({
  accountId: z.string().cuid(),
  debit: z.number().int().min(0).default(0),
  credit: z.number().int().min(0).default(0),
  description: z.string().max(200).optional(),
}).refine(
  (line) => (line.debit > 0) !== (line.credit > 0),
  'Cada línea debe tener débito o crédito (uno y solo uno)'
)

export const CreateJournalEntrySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  description: z.string().min(1).max(300),
  reference: z.string().max(100).optional(),
  lines: z.array(JournalLineSchema).min(2),
}).refine(
  (entry) => {
    const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0)
    const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0)
    return totalDebit === totalCredit && totalDebit > 0
  },
  'El asiento no cuadra: la suma del debe debe ser igual a la del haber y mayor que cero'
)
```

## Páginas Frontend

### `/contabilidad/libro-diario`

- Tabla paginada de asientos: fecha, descripción, referencia, fuente, total débito/crédito, acción "ver detalle".
- Filtros: rango de fechas, fuente (`manual` / `dte` / `purchase`).
- Botón "Nuevo asiento manual" → modal con formulario.
- Modal de detalle: tabla de líneas (cuenta, descripción, debe, haber).
- Formulario manual: fecha, descripción, líneas dinámicas (agregar/quitar), select de cuenta por línea, validación de cuadratura en tiempo real (mostrar diferencia si no cuadra).

### `/contabilidad/mayor`

- Selector de cuenta (autocomplete sobre PUC) y rango de fechas.
- Tabla de movimientos: fecha, referencia, descripción, debe, haber, saldo acumulado.
- Saldo inicial al rango + total débitos + total créditos + saldo final.

## Error Handling

| Escenario | Comportamiento |
|----------|----------|
| Asiento no cuadra | 400 con mensaje del refinement Zod |
| Cuenta no existe o no pertenece al tenant | 400 "Cuenta inválida" |
| Cuenta inactiva | 400 "Cuenta inactiva" |
| Cuentas PUC base no presentes al emitir DTE | Log warn, NO bloquea emisión, asiento omitido |
| Asiento source='dte' borrado vía API manual | 403 "Asientos automáticos no editables" |
| GET ledger sin accountId válido | 400 |

## Testing Strategy

1. Crear asiento manual válido → 201 + asiento visible en libro diario.
2. Crear asiento desbalanceado → 400 con mensaje claro.
3. Emitir DTE tipo 33 → verificar JournalEntry creado con 3 líneas correctas (1103 debe, 4100/2111 haber).
4. Registrar Purchase → verificar JournalEntry con cuenta de gasto según categoría, 1115 IVA crédito, 2101 proveedores.
5. Eliminar empresa (futuro): los asientos se borran en cascada.
6. Consultar mayor de cuenta 1103 → ver todas las facturas emitidas como movimientos débito.

## Future Work (out of scope)

- Edición y reversión de asientos automáticos (con asiento de reversión inverso).
- Cierre mensual (asiento de cierre, traspaso a resultado del ejercicio).
- Centros de costo en cada línea.
- Concepto "Documentos por cobrar" (efecto post-vencimiento de Clientes).
- Conciliación bancaria (Módulo 5) consumirá este libro diario para sus matches.
