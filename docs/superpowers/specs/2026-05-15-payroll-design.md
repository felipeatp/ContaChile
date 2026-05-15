# Remuneraciones — Design Spec (Módulo 2)

## Goal

Implementar el módulo completo de remuneraciones que cualquier pyme chilena con empleados necesita:

1. **Ficha de trabajadores** (2A): alta/baja/edición de empleados con datos previsionales.
2. **Liquidaciones de sueldo** (2B): cálculo legal (AFP, salud, cesantía, impuesto único), generación PDF, asiento contable automático.
3. **Exportaciones** (2C): archivo PreviRed mensual y DDJJ 1887 anual.

Sin este módulo, las pymes con empleados usan Buk u otra herramienta en paralelo y eventualmente migran toda la contabilidad allí.

## Context

El proyecto ya tiene:
- Validación de RUT (módulo 11) en `packages/validators`.
- Multi-tenant por `companyId`.
- Patrón de routes Fastify + proxies Next.js + páginas con shadcn/ui.
- Libro Diario y Mayor (Módulo 1A) listos para integrar asientos automáticos de remuneraciones.
- Motor PDF (`pdfkit` usado en DTE) que se puede reutilizar.

## Architecture

### Nuevos modelos Prisma

```prisma
enum ContractType {
  INDEFINIDO
  PLAZO_FIJO
  HONORARIOS
}

enum AfpCode {
  CAPITAL
  CUPRUM
  HABITAT
  MODELO
  PLANVITAL
  PROVIDA
  UNO
}

enum HealthPlan {
  FONASA
  ISAPRE
}

enum PayrollStatus {
  DRAFT
  APPROVED
  PAID
}

model Employee {
  id           String       @id @default(cuid())
  companyId    String
  rut          String
  name         String
  email        String?
  position     String
  startDate    DateTime
  endDate      DateTime?
  contractType ContractType
  workHours    Int          @default(45)
  baseSalary   Int
  afp          AfpCode
  healthPlan   HealthPlan
  healthAmount Int?         // Si es isapre con plan UF, monto pactado en CLP
  isActive     Boolean      @default(true)
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
  payrolls     Payroll[]

  @@unique([companyId, rut])
  @@index([companyId])
  @@index([isActive])
}

model Payroll {
  id            String        @id @default(cuid())
  companyId     String
  employeeId    String
  year          Int
  month         Int           // 1-12
  bruto         Int
  horasExtras   Int           @default(0)
  bonos         Int           @default(0)
  afp           Int           // monto descontado
  salud         Int
  cesantia      Int
  baseImponible Int
  impuesto      Int
  otrosDesc     Int           @default(0)
  liquido       Int
  status        PayrollStatus @default(DRAFT)
  generatedAt   DateTime      @default(now())
  approvedAt    DateTime?
  paidAt        DateTime?
  employee      Employee      @relation(fields: [employeeId], references: [id])

  @@unique([companyId, employeeId, year, month])
  @@index([companyId, year, month])
  @@index([status])
}
```

### Tasas legales (configurable en código + env vars)

```typescript
// packages/validators/src/payroll-constants.ts
export const AFP_RATES: Record<AfpCode, number> = {
  CAPITAL:   0.1144,
  CUPRUM:    0.1144,
  HABITAT:   0.1127,
  MODELO:    0.1058,
  PLANVITAL: 0.1154,
  PROVIDA:   0.1145,
  UNO:       0.1069,
}

export const SALUD_FONASA = 0.07              // 7% fijo
export const SEGURO_CESANTIA_EMPLEADO = 0.006 // 0.6% indefinido (0 plazo fijo)
export const SEGURO_CESANTIA_EMPLEADOR = 0.024

// UTM mensual — valor configurable via env (cambia mensualmente)
export const UTM_DEFAULT = 67000  // valor referencia 2026

// Tabla de impuesto único mensual (segunda categoría)
// Brackets en UTM. Rebaja en UTM también, para que el cálculo sea exacto a la tabla SII.
export const TAX_BRACKETS = [
  { upTo: 13.5,   rate: 0,      deduction: 0 },
  { upTo: 30,     rate: 0.04,   deduction: 0.54 },     // 13.5 * 0.04
  { upTo: 50,     rate: 0.08,   deduction: 1.74 },     // 0.54 + (30-13.5) * (0.08-0.04)
  { upTo: 70,     rate: 0.135,  deduction: 4.49 },
  { upTo: 90,     rate: 0.23,   deduction: 11.14 },
  { upTo: 120,    rate: 0.304,  deduction: 17.8 },
  { upTo: 150,    rate: 0.35,   deduction: 23.32 },
  { upTo: Infinity, rate: 0.40, deduction: 30.82 },
]
```

Las tasas y la UTM deben revisarse cada año/mes. El plan documenta esto como deuda técnica para actualizar.

### Función `calcularLiquidacion`

```typescript
export interface LiquidacionInput {
  baseSalary: number
  horasExtras?: number      // monto en CLP (precalculado)
  bonos?: number
  otrosDescuentos?: number
  afp: AfpCode
  healthPlan: HealthPlan
  healthAmount?: number     // Para isapre (CLP)
  contractType: ContractType
  utmValue?: number         // Override para tests/períodos pasados
}

export interface Liquidacion {
  bruto: number
  afp: number
  salud: number
  cesantia: number
  baseImponible: number
  impuesto: number
  otrosDesc: number
  liquido: number
}

export function calcularLiquidacion(input: LiquidacionInput): Liquidacion {
  const utm = input.utmValue ?? UTM_DEFAULT
  const bruto = input.baseSalary + (input.horasExtras ?? 0) + (input.bonos ?? 0)

  const afp = Math.round(bruto * AFP_RATES[input.afp])
  const salud = input.healthPlan === 'FONASA'
    ? Math.round(bruto * SALUD_FONASA)
    : Math.max(input.healthAmount ?? 0, Math.round(bruto * SALUD_FONASA))
  const cesantia = input.contractType === 'INDEFINIDO'
    ? Math.round(bruto * SEGURO_CESANTIA_EMPLEADO)
    : 0

  const baseImponible = bruto - afp - salud - cesantia
  const impuesto = calcularImpuestoUnico(baseImponible, utm)
  const otrosDesc = input.otrosDescuentos ?? 0

  const liquido = bruto - afp - salud - cesantia - impuesto - otrosDesc
  return { bruto, afp, salud, cesantia, baseImponible, impuesto, otrosDesc, liquido }
}

function calcularImpuestoUnico(baseImponible: number, utm: number): number {
  const baseInUtm = baseImponible / utm
  for (const bracket of TAX_BRACKETS) {
    if (baseInUtm <= bracket.upTo) {
      const tax = (baseInUtm * bracket.rate - bracket.deduction) * utm
      return Math.max(0, Math.round(tax))
    }
  }
  return 0
}
```

### Endpoints

| Método | Path | Descripción |
|--------|------|-------------|
| GET    | `/employees` | Lista empleados activos (filtro `?active=true/false`) |
| GET    | `/employees/:id` | Detalle |
| POST   | `/employees` | Crear |
| PATCH  | `/employees/:id` | Editar |
| DELETE | `/employees/:id` | Soft delete (`isActive=false`) |
| POST   | `/payroll/generate` | Generar liquidaciones del mes para todos los activos. Body: `{ year, month }` |
| GET    | `/payroll/:year/:month` | Listar liquidaciones del período |
| GET    | `/payroll/employee/:id` | Historial por empleado |
| GET    | `/payroll/item/:id` | Detalle de una liquidación |
| GET    | `/payroll/item/:id/pdf` | PDF de la liquidación |
| POST   | `/payroll/item/:id/approve` | Marca como APPROVED |
| GET    | `/payroll/previred/:year/:month` | Archivo PreviRed (texto plano) |
| GET    | `/payroll/ddjj-1887/:year` | DDJJ 1887 anual (texto plano) |

### Integración con Libro Diario

Al aprobar (POST /payroll/item/:id/approve) la liquidación, crear asiento automático `source='payroll'`:

| Cuenta | Débito | Crédito |
|--------|--------|---------|
| 5100 Gastos de personal | bruto | — |
| 2115 Remuneraciones por pagar | — | liquido |
| 2110 Impuestos por pagar (impuesto único) | — | impuesto |
| 2110 Impuestos por pagar (cotizaciones empleado) | — | afp + salud + cesantia |

El asiento del empleador (cesantía 2.4%) se puede agregar en el futuro como otro registro.

### Generación PDF

Reutilizar la lógica de PDF existente en `packages/dte`. Crear un módulo nuevo `apps/api/src/lib/payroll-pdf.ts` que use `pdfkit` directamente:

- Encabezado: razón social, RUT empresa
- Datos del trabajador: nombre, RUT, cargo, fecha de ingreso
- Tabla HABERES: sueldo base, horas extras, bonos, total haberes
- Tabla DESCUENTOS: AFP, salud, cesantía, impuesto, otros, total descuentos
- Línea: LÍQUIDO A PAGAR
- Firma: empleador / empleado

### Formato PreviRed

Archivo de texto fijo `previred_AAAAMM_RUTEMPRESA.txt`. Cada línea representa un trabajador, con campos delimitados (depende del proveedor; PreviRed acepta un CSV simple o un fijo). Para el MVP usamos CSV separado por punto y coma:

```
rut;dgVerif;nombre;apellidoPaterno;apellidoMaterno;rutEmpresa;periodo;sueldoBase;afp;cotizacionAfp;salud;cotizacionSalud;cesantiaEmpleado;cesantiaEmpleador
```

El formato real de PreviRed se ajustará en producción según especificación oficial. Para MVP el archivo es válido y procesable.

### DDJJ 1887

Solo se genera anualmente (marzo). Para honorarios pagados. Por ahora un placeholder simple que liste todos los pagos de honorarios del año por RUT.

## UI

Tres páginas bajo `apps/web/app/remuneraciones/`:

- `trabajadores/page.tsx` — Lista + form de alta/edición
- `liquidaciones/page.tsx` — Selector de período, botón "Generar mes", lista, descarga PDF, aprobar
- `exportaciones/page.tsx` — Botones de descarga PreviRed y DDJJ 1887

## Sidebar

Tres entradas nuevas (Trabajadores, Liquidaciones, Exportaciones) bajo grupo "Remuneraciones".

## Error Handling

| Escenario | Comportamiento |
|----------|----------|
| RUT inválido | 400 con mensaje claro |
| RUT duplicado en mismo company | 409 conflict |
| Generar payroll para mes futuro | 400 |
| Generar payroll para mes ya generado | Solo genera para empleados sin liquidación; existing skipped |
| Empleado sin AFP/salud configurado | 400 al generar |
| Empleado tipo HONORARIOS | Skipped en generate (no aplica liquidación tradicional) |
| PDF de liquidación inexistente | 404 |

## Testing Strategy

Smoke test que cubra:

1. Crear empleado con sueldo $1.000.000 / AFP HABITAT / FONASA / INDEFINIDO
2. Generar liquidación del mes actual:
   - bruto = 1.000.000
   - AFP = 1.000.000 * 0.1127 = 112.700
   - Salud = 70.000
   - Cesantía = 6.000
   - Base imponible = 1.000.000 - 112.700 - 70.000 - 6.000 = 811.300
   - Base / UTM = 811.300 / 67.000 ≈ 12.11 UTM
   - Está bajo 13.5 UTM exento → impuesto = 0
   - Líquido = 1.000.000 - 112.700 - 70.000 - 6.000 - 0 = 811.300
3. Crear empleado con sueldo $3.000.000 — verificar que impuesto > 0
4. Verificar PreviRed genera texto válido
5. Aprobar liquidación → verificar asiento en libro diario

## Future Work (out of scope)

- Horas extras como input separado calculado automáticamente desde marcaciones de asistencia.
- Gratificación legal (artículo 50): suma anual o porcentaje mensual con tope.
- Bono producción / comisiones / participación de utilidades.
- Indemnización por años de servicio (al finiquito).
- Permisos administrativos, vacaciones (acumular y pagar).
- Préstamos a trabajadores (descuento mensual).
- AFC complemento empleador en hojas separadas.
- Integración API Previred (no solo archivo descarga).
- DDJJ 1887 completa con retenciones, bonos, asignaciones por casa, viaje.
- DDJJ 1879 (gastos de personal completos).
