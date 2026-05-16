# Boletas de Honorarios — Design Spec (Módulo 4)

## Goal

Implementar el módulo de Boletas de Honorarios Electrónicas (BHE): registro manual de boletas emitidas y recibidas, cálculo automático de retención 13,75%, integración con libro diario para las recibidas, y enriquecimiento de DDJJ 1887.

Esto desbloquea el segmento de profesionales independientes (segunda categoría) y permite a las empresas registrar correctamente sus gastos de honorarios con la retención fiscal.

## Context

- El SII gestiona la emisión real de BHE en su propia plataforma (no son DTE XML como tipo 33).
- Para MVP, **no integramos con el API del SII** (eso requiere credenciales y certificado distintos). En su lugar, permitimos **registro manual** de BHEs emitidas y recibidas para que la contabilidad sea correcta.
- El proyecto ya tiene `Purchase` para compras DTE — `Honorario` es complementario, no reemplaza.
- Libro Diario (Módulo 1A) ya tiene asientos automáticos via `accounting-entries.ts`.
- DDJJ 1887 anual (Módulo 2C) actualmente solo lista sueldos; este módulo debería poder agregar honorarios pagados.

## Architecture

### Modelo Prisma

```prisma
enum HonorarioType {
  ISSUED   // emitidas por la empresa (la empresa es profesional)
  RECEIVED // recibidas (la empresa contrata profesionales)
}

enum HonorarioStatus {
  PENDING  // registrada
  PAID     // pagada
}

model Honorario {
  id              String          @id @default(cuid())
  companyId       String
  type            HonorarioType
  number          Int             // número correlativo BHE
  date            DateTime
  counterpartRut  String          // RUT del profesional (si ISSUED: empresa cliente; si RECEIVED: profesional)
  counterpartName String
  description     String?
  grossAmount     Int             // monto bruto
  retentionRate   Decimal         @db.Decimal(5, 4) @default(0.1375)
  retentionAmount Int             // gross * rate (cached para queries rápidas)
  netAmount       Int             // gross - retention
  status          HonorarioStatus @default(PENDING)
  paidAt          DateTime?
  createdAt       DateTime        @default(now())

  @@unique([companyId, type, number])
  @@index([companyId])
  @@index([type, date])
}
```

`@unique [companyId, type, number]` — el correlativo de boletas es por tipo (separamos numeración de emitidas y recibidas).

### Cálculo de retención

```typescript
// 2025+: tasa fija 13.75%
export const RETENCION_HONORARIOS_RATE = 0.1375

export function calcularRetencionHonorarios(gross: number, rate = RETENCION_HONORARIOS_RATE) {
  const retention = Math.round(gross * rate)
  const net = gross - retention
  return { gross, retention, net, rate }
}
```

Configurable via parámetro para soportar tasas históricas (12.25% en 2023, 13% en 2024, etc.) si en el futuro se quiere cargar datos retro.

### Endpoints

| Método | Path | Descripción |
|--------|------|-------------|
| GET    | `/honorarios?type=&year=&month=` | Lista con filtros |
| GET    | `/honorarios/:id` | Detalle |
| POST   | `/honorarios` | Crear (calcula retención si no viene) |
| PATCH  | `/honorarios/:id` | Actualizar estado (PENDING → PAID) |
| DELETE | `/honorarios/:id` | Eliminar |
| GET    | `/honorarios/summary?year=&month=` | Totales del período (emitidas, recibidas, retenciones) |

### Asiento automático para BHE recibidas

Al crear `Honorario` con `type=RECEIVED`, crear asiento `source='honorario'`:

| Cuenta | Débito | Crédito |
|--------|--------|---------|
| 5101 Honorarios | gross | — |
| 2110 Impuestos por pagar (retención) | — | retention |
| 2101 Proveedores | — | net |

Para BHE `ISSUED` no creamos asiento automático en el MVP. (En el futuro, podríamos crear: 1103 Clientes D net + PPM honorarios D retention / 4101 Ingresos servicios H gross.)

### Integración con DDJJ 1887

Modificar el endpoint actual `/payroll/ddjj-1887/:year` para que también incluya:
- Honorarios pagados a profesionales del año (suma de RECEIVED con type=RECEIVED y status=PAID, agrupado por RUT del profesional)
- Las dos secciones (sueldos y honorarios) van en bloques separados del archivo

Alternativamente, crear endpoint dedicado `/honorarios/ddjj-1887/:year` que devuelve sólo la sección honorarios. Para el MVP: hacer **endpoint dedicado** porque es más simple y backwards-compatible.

### Validación

```typescript
export const CreateHonorarioSchema = z.object({
  type: z.enum(['ISSUED', 'RECEIVED']),
  number: z.number().int().min(1),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  counterpartRut: z.string().min(8).max(15),
  counterpartName: z.string().min(1).max(150),
  description: z.string().max(300).optional(),
  grossAmount: z.number().int().min(1),
  // retentionRate puede venir explícito (datos históricos) o se usa 0.1375 default
  retentionRate: z.number().min(0).max(0.5).optional(),
})
```

## UI

### Página `/honorarios`

- Header: título, botón "Nueva boleta"
- Filtros: tipo (Todas / Emitidas / Recibidas), año, mes
- Cards resumen: total emitidas, total recibidas, retención total del período
- Tabla: fecha, tipo, número, contraparte, bruto, retención, líquido, estado, acciones
- Modal form: type, number, date, counterpartRut+name, description, grossAmount → calcula retención preview en tiempo real

### Sidebar

Agregar entrada "Honorarios" cerca de "Compras" (es un tipo de gasto/ingreso especial).

## Error Handling

| Escenario | Comportamiento |
|----------|----------|
| RUT inválido | 400 con mensaje |
| Boleta duplicada (mismo type+number) | 409 |
| grossAmount = 0 | 400 |
| DELETE de boleta con asiento ya aprobado | 400 "Tiene asiento contable; revierta primero" |
| Cuentas PUC ausentes al crear asiento | Log warn, no bloquea creación |

## Testing Strategy

Smoke test `smoke-honorarios.ts`:

1. Crear BHE ISSUED $1.000.000 → retention $137.500, net $862.500
2. Crear BHE RECEIVED $500.000 → retention $68.750, net $431.250
3. Verificar asiento auto de la RECEIVED: 5101 D 500.000 / 2110 H 68.750 / 2101 H 431.250
4. Listar por tipo y verificar summary

## Future Work (out of scope)

- Integración real con API SII BHE (emisión y consulta automática).
- Asiento automático para ISSUED (lado del profesional independiente).
- Pago consolidado de retenciones al SII (mes a mes), descontando del 2110.
- Importación masiva de BHEs desde CSV/XML de SII.
- Notificación al profesional cuando se registra una BHE recibida.
