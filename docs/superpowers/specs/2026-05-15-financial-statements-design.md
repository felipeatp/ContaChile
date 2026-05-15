# Estados Financieros — Design Spec (Módulo 1B)

## Goal

Implementar los tres reportes contables base que cualquier software contable chileno debe ofrecer:

1. **Balance de Comprobación** — verifica que los libros cuadran y muestra saldos por cuenta a una fecha de corte.
2. **Estado de Resultados (PyG)** — utilidad/pérdida del período: ingresos − costos − gastos.
3. **Balance General** — activo, pasivo y patrimonio a una fecha de corte. Valida `ACTIVO = PASIVO + PATRIMONIO + Utilidad del ejercicio`.

Sin estos reportes ContaChile no puede cerrar el año fiscal de un cliente. Habilita parcialmente Módulo 8 (F22 con IA) que necesita la utilidad del ejercicio.

## Context

El proyecto ya tiene:
- Modelo `Account` con enum `AccountType` (ACTIVO, PASIVO, PATRIMONIO, INGRESO, GASTO, COSTO).
- Modelos `JournalEntry` + `JournalLine` con `debit`/`credit` enteros (CLP).
- 50 cuentas PUC base seedeadas por empresa.
- Asientos automáticos al emitir DTE y registrar Compra (Módulo 1A).
- Patrón de export PDF vía `window.print()` + CSS `@media print` (probado en F29 y F22).

No se necesita modelo nuevo en Prisma; los reportes se calculan en tiempo real.

## Architecture

### No requiere persistencia adicional

Como F29 y F22, estos reportes se calculan en cada request desde `JournalLine` agrupando por `Account`. La consulta es eficiente porque hay índice en `journalEntryId` y `accountId`.

### Endpoints

| Método | Path | Query | Descripción |
|--------|------|-------|-------------|
| GET | `/accounting/reports/trial-balance` | `?asOf=YYYY-MM-DD` | Saldos por cuenta a la fecha (default: hoy) |
| GET | `/accounting/reports/income-statement` | `?from=YYYY-MM-DD&to=YYYY-MM-DD` | Resultado del período |
| GET | `/accounting/reports/balance-sheet` | `?asOf=YYYY-MM-DD` | Balance general a la fecha |

### Lógica de cálculo

**Balance de Comprobación** — para cada cuenta con movimiento hasta `asOf`:

```
totalDebit  = SUM(jl.debit)  WHERE companyId AND jl.accountId = a.id AND je.date <= asOf
totalCredit = SUM(jl.credit) WHERE …
saldoDeudor   = MAX(0, totalDebit  - totalCredit)
saldoAcreedor = MAX(0, totalCredit - totalDebit)
```

Validación: `SUM(saldoDeudor) === SUM(saldoAcreedor)` debe cumplirse siempre.

**Estado de Resultados** — para el rango `[from, to]`:

```
ingresos = SUM(credit - debit) sobre INGRESO accounts en el rango
costos   = SUM(debit  - credit) sobre COSTO   accounts en el rango
gastos   = SUM(debit  - credit) sobre GASTO   accounts en el rango
utilidadBruta = ingresos - costos
utilidadEjercicio = ingresos - costos - gastos
```

Las cuentas de resultados (INGRESO/COSTO/GASTO) se valoran por su naturaleza:
- INGRESO: saldo natural acreedor → ingresos = credit − debit
- COSTO/GASTO: saldo natural deudor → costos/gastos = debit − credit

**Balance General** — saldos acumulados hasta `asOf`:

```
activo      = SUM(debit  - credit) por ACTIVO     accounts hasta asOf
pasivo      = SUM(credit - debit) por PASIVO      accounts hasta asOf
patrimonio  = SUM(credit - debit) por PATRIMONIO  accounts hasta asOf

// Utilidad acumulada desde el inicio del año fiscal hasta asOf
yearStart = first day of asOf's year
utilidadEjercicio = SUM(credit - debit) por INGRESO en [yearStart, asOf]
                  - SUM(debit - credit) por (COSTO+GASTO) en [yearStart, asOf]

totalPasivoPatrimonio = pasivo + patrimonio + utilidadEjercicio
```

**Invariante:** `activo === totalPasivoPatrimonio`. Si no cuadra, el balance está corrupto.

### Response schemas

**TrialBalance:**

```typescript
{
  asOf: string,
  rows: Array<{
    accountId: string,
    code: string,
    name: string,
    type: AccountType,
    totalDebit: number,
    totalCredit: number,
    saldoDeudor: number,
    saldoAcreedor: number,
  }>,
  totals: {
    totalDebit: number,
    totalCredit: number,
    saldoDeudor: number,
    saldoAcreedor: number,
    balanced: boolean,  // saldoDeudor === saldoAcreedor
  }
}
```

**IncomeStatement:**

```typescript
{
  from: string,
  to: string,
  ingresos: { total: number, rows: AccountRow[] },
  costos:   { total: number, rows: AccountRow[] },
  gastos:   { total: number, rows: AccountRow[] },
  utilidadBruta: number,        // ingresos - costos
  utilidadEjercicio: number,    // ingresos - costos - gastos
}

// AccountRow:
{ accountId, code, name, value }
```

**BalanceSheet:**

```typescript
{
  asOf: string,
  activo:     { total: number, rows: AccountRow[] },
  pasivo:     { total: number, rows: AccountRow[] },
  patrimonio: { total: number, rows: AccountRow[] },
  utilidadEjercicio: number,
  totalPasivoPatrimonio: number,
  balanced: boolean,            // activo === totalPasivoPatrimonio
}
```

### Implementación Prisma

Para evitar N+1, usar una sola query por reporte con `groupBy` + `findMany` de cuentas:

```typescript
// 1. Cuentas de la empresa
const accounts = await prisma.account.findMany({
  where: { companyId },
  select: { id: true, code: true, name: true, type: true },
})

// 2. Sumas por cuenta hasta la fecha de corte
const sums = await prisma.journalLine.groupBy({
  by: ['accountId'],
  where: {
    journalEntry: { companyId, date: { lte: asOf } },
    accountId: { in: accounts.map((a) => a.id) },
  },
  _sum: { debit: true, credit: true },
})

// 3. Construir filas combinando ambos
```

Para el income statement, el filtro es `date: { gte: from, lte: to }`.

## UI

Tres páginas bajo `apps/web/app/contabilidad/reportes/`:

- `balance-comprobacion/page.tsx`
- `estado-resultados/page.tsx`
- `balance-general/page.tsx`

Cada una:
- Selector de período (date input). Trial Balance y Balance Sheet: un solo `asOf` con default = fin de mes anterior. Income Statement: rango `from`–`to` con default = primer y último día del mes actual.
- Cards resumen arriba (totales clave).
- Tabla principal con cuentas agrupadas (por tipo en estado resultados/balance general).
- Botón "Imprimir / PDF" usando `window.print()` y CSS print existente.
- Si no cuadra (trial balance o balance sheet): banner rojo "Los libros no cuadran — diferencia $X". Ayuda a detectar asientos malos.

## Sidebar

Agrupar bajo "Reportes" o agregar 3 entradas planas. Plan: 3 entradas planas para consistencia con el resto del menú.

## Error Handling

| Escenario | Comportamiento |
|----------|----------|
| `from > to` en income statement | 400 |
| `asOf > hoy + 1 día` | 400 (no permitir futuro) |
| Sin asientos en el período | Reporte con totales en 0, sin filas (mensaje "Sin movimientos") |
| Empresa sin PUC seedeado | Reporte vacío, no falla |
| Cuentas inactivas con movimientos | Se incluyen (los saldos existieron históricamente) |

## Testing Strategy

Usando los 3 asientos del smoke test anterior (1 venta + 2 compras):

1. Trial Balance al día de hoy:
   - 1103 Clientes: deudor 119.000
   - 4100 Ingresos: acreedor 100.000
   - 2111 IVA Débito: acreedor 19.000
   - 5110 Arriendo: deudor 50.000
   - 5220 Gastos diversos: deudor 30.000
   - 1115 IVA Crédito: deudor 15.200 (9.500+5.700)
   - 2101 Proveedores: acreedor 95.200 (59.500+35.700)
   - Total deudor = Total acreedor = 214.200 ✓

2. Income Statement del mes:
   - Ingresos: 100.000
   - Costos: 0
   - Gastos: 80.000 (50.000 + 30.000)
   - Utilidad ejercicio: 20.000

3. Balance Sheet al día de hoy:
   - Activo: 119.000 + 15.200 = 134.200
   - Pasivo: 19.000 + 95.200 = 114.200
   - Patrimonio: 0
   - Utilidad ejercicio: 20.000
   - Total P+P+U: 134.200 = Activo ✓

## Future Work (out of scope)

- Comparativo entre períodos (este mes vs anterior, año vs año anterior).
- Estados financieros consolidados (multi-empresa).
- Subagrupaciones por dígito del código (1.1 Activo Corriente vs 1.2 Activo Fijo).
- Asiento de cierre del ejercicio automático.
- IPC / corrección monetaria.
- Export a Excel además de PDF.
- Notas explicativas a cada estado financiero.
