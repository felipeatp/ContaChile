# Sprint 9 — Tests Tier 2 + CI Gate

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cubrir los servicios de lógica de negocio del API con tests unitarios, agregar tests de rutas payroll y accounting/reports, extender el test de folio concurrente a 10 requests, y bloquear merge en CI si la cobertura cae bajo 60%.

**Architecture:** Tests de `lib/` llaman funciones exportadas directamente con Prisma mockeado (`vi.mock('@contachile/db')`). Tests de `routes/` levantan Fastify con `app.inject()`. Todos los tests usan `DEV_BYPASS_AUTH=true` y `@contachile/auth` mockeado. La cobertura se agrega con `@vitest/coverage-v8` en `apps/api/vitest.config.ts` y se valida en el CI existente.

**Tech Stack:** Vitest 1.x, `@vitest/coverage-v8`, Fastify 4.x, GitHub Actions (`.github/workflows/ci.yml` ya existe)

---

## Contexto del dominio (leer antes de tocar cualquier archivo)

### PUC (Plan Único de Cuentas)
Definido en `apps/api/src/lib/accounting-entries.ts`:
- `1103` = CLIENTES (ACTIVO, lado natural: debit)
- `1115` = IVA_CREDITO (ACTIVO, debit)
- `2101` = PROVEEDORES (PASIVO, credit)
- `2110` = IMPUESTOS_POR_PAGAR (PASIVO, credit)
- `2111` = IVA_DEBITO (PASIVO, credit)
- `2115` = REMUNERACIONES_POR_PAGAR (PASIVO, credit)
- `4100` = INGRESOS_VENTAS (INGRESO, credit)
- `5100` = GASTOS_PERSONAL (GASTO, debit)

### Invariante contable
En todo asiento: `sum(debit) === sum(credit)`. Los tests verifican esto explícitamente.

### Payroll service
`generatePayrollForMonth` excluye empleados con `contractType: 'HONORARIOS'` y salta registros existentes (findUnique no null → skipped++).

### Financial statements
- `computeTrialBalance`: `balanced: saldoDeudor === saldoAcreedor` donde saldoDeudor = max(0, debit-credit) por cuenta
- `computeBalanceSheet`: `balanced: activo.total === pasivo.total + patrimonio.total + utilidadEjercicio`

### Bank matching
`findAndApplyMatch` usa ventana de ±7 días y compara `totalAmount === movement.amount` exacto (1 CLP de diferencia = sin match).

### Inventory
`recordInventoryMovement` permite stock negativo en OUT (logea warn pero no lanza error). El costo promedio ponderado se recalcula solo en IN.

---

## File Map

| Archivo | Acción |
|---------|--------|
| `apps/api/tests/lib/accounting-entries.test.ts` | Crear |
| `apps/api/tests/lib/payroll-service.test.ts` | Crear |
| `apps/api/tests/lib/financial-statements.test.ts` | Crear |
| `apps/api/tests/lib/bank-service.test.ts` | Crear |
| `apps/api/tests/lib/inventory-service.test.ts` | Crear |
| `apps/api/tests/routes/payroll.test.ts` | Crear |
| `apps/api/tests/routes/accounting/reports.test.ts` | Crear |
| `apps/api/tests/dte/folio-concurrency.test.ts` | Extender (agregar 1 test) |
| `apps/api/vitest.config.ts` | Modificar (agregar coverage) |
| `apps/api/package.json` | Modificar (agregar @vitest/coverage-v8) |
| `.github/workflows/ci.yml` | Modificar (agregar paso de coverage check) |

---

## Task 1: Tests de accounting-entries.ts

**Files:**
- Create: `apps/api/tests/lib/accounting-entries.test.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@contachile/db', () => ({
  prisma: {
    ledgerAccount: { findMany: vi.fn() },
    journalEntry: { create: vi.fn() },
  },
}))

import { prisma } from '@contachile/db'
import {
  createSalesEntry,
  createPurchaseEntry,
  createPayrollEntry,
  createHonorarioEntry,
} from '../../src/lib/accounting-entries'

const mockLedger = prisma.ledgerAccount.findMany as ReturnType<typeof vi.fn>
const mockCreate = prisma.journalEntry.create as ReturnType<typeof vi.fn>

const COMPANY = 'company-test'
const ENTRY_ID = 'entry-1'

function mockAccounts(codes: string[]) {
  mockLedger.mockResolvedValue(
    codes.map((code, i) => ({ id: `acc-${i}-${code}`, code }))
  )
}

function idForCode(code: string) {
  return `acc-${['1103','1115','2101','2110','2111','2115','4100','5100','5101','5220'].indexOf(code)}-${code}`
}

beforeEach(() => {
  vi.clearAllMocks()
  mockCreate.mockResolvedValue({ id: ENTRY_ID })
})

describe('createSalesEntry', () => {
  it('crea asiento con Clientes/Ventas/IVA_DEBITO y cuadra', async () => {
    mockAccounts(['1103', '4100', '2111'])
    const doc = {
      id: 'doc-1',
      companyId: COMPANY,
      folio: 42,
      type: 33,
      totalNet: 1_000_000,
      totalTax: 190_000,
      totalAmount: 1_190_000,
      emittedAt: new Date('2026-03-01'),
      receiverName: 'Cliente SpA',
    }

    const result = await createSalesEntry(doc)

    expect(result).not.toBeNull()
    const lines: Array<{ accountId: string; debit: number; credit: number }> =
      mockCreate.mock.calls[0][0].data.lines.create

    // Invariante contable: suma de débitos === suma de créditos
    const sumDebit = lines.reduce((s, l) => s + l.debit, 0)
    const sumCredit = lines.reduce((s, l) => s + l.credit, 0)
    expect(sumDebit).toBe(sumCredit) // 1_190_000 === 1_190_000

    // Clientes (1103): debit = totalAmount
    const clientes = lines.find((l) => l.accountId === 'acc-0-1103')!
    expect(clientes.debit).toBe(1_190_000)
    expect(clientes.credit).toBe(0)

    // Ventas (4100): credit = totalNet
    const ventas = lines.find((l) => l.accountId === 'acc-1-4100')!
    expect(ventas.debit).toBe(0)
    expect(ventas.credit).toBe(1_000_000)

    // IVA_DEBITO (2111): credit = totalTax
    const iva = lines.find((l) => l.accountId === 'acc-2-2111')!
    expect(iva.debit).toBe(0)
    expect(iva.credit).toBe(190_000)
  })

  it('retorna null si no hay companyId', async () => {
    const doc = {
      id: 'doc-2',
      companyId: null,
      folio: 1,
      type: 33,
      totalNet: 100_000,
      totalTax: 19_000,
      totalAmount: 119_000,
      emittedAt: new Date(),
      receiverName: 'X',
    }
    const result = await createSalesEntry(doc)
    expect(result).toBeNull()
    expect(mockCreate).not.toHaveBeenCalled()
  })

  it('retorna null si faltan cuentas PUC', async () => {
    // Solo devuelve 2 de las 3 cuentas requeridas
    mockLedger.mockResolvedValue([
      { id: 'acc-0-1103', code: '1103' },
      { id: 'acc-1-4100', code: '4100' },
      // 2111 falta
    ])
    const doc = {
      id: 'doc-3',
      companyId: COMPANY,
      folio: 1,
      type: 33,
      totalNet: 100_000,
      totalTax: 19_000,
      totalAmount: 119_000,
      emittedAt: new Date(),
      receiverName: 'X',
    }
    const result = await createSalesEntry(doc)
    expect(result).toBeNull()
    expect(mockCreate).not.toHaveBeenCalled()
  })
})

describe('createPurchaseEntry', () => {
  it('crea asiento con Gastos/IVA_Credito/Proveedores y cuadra', async () => {
    mockAccounts(['5220', '1115', '2101'])
    const purchase = {
      id: 'pur-1',
      companyId: COMPANY,
      type: 33,
      folio: 10,
      date: new Date('2026-03-05'),
      netAmount: 500_000,
      taxAmount: 95_000,
      totalAmount: 595_000,
      category: null, // → GASTOS_DIVERSOS (5220)
      issuerName: 'Proveedor SpA',
    }

    await createPurchaseEntry(purchase)

    const lines: Array<{ accountId: string; debit: number; credit: number }> =
      mockCreate.mock.calls[0][0].data.lines.create

    // Cuadre: 500_000 + 95_000 = 595_000
    const sumDebit = lines.reduce((s, l) => s + l.debit, 0)
    const sumCredit = lines.reduce((s, l) => s + l.credit, 0)
    expect(sumDebit).toBe(sumCredit) // 595_000 === 595_000

    // Gastos (5220): debit = netAmount
    const gastos = lines.find((l) => l.accountId === 'acc-0-5220')!
    expect(gastos.debit).toBe(500_000)

    // IVA_CREDITO (1115): debit = taxAmount
    const ivaC = lines.find((l) => l.accountId === 'acc-1-1115')!
    expect(ivaC.debit).toBe(95_000)

    // Proveedores (2101): credit = totalAmount
    const prov = lines.find((l) => l.accountId === 'acc-2-2101')!
    expect(prov.credit).toBe(595_000)
  })
})

describe('createPayrollEntry', () => {
  it('crea asiento GASTOS_PERSONAL/REMUNERACIONES_POR_PAGAR/IMPUESTOS_POR_PAGAR y cuadra', async () => {
    mockAccounts(['5100', '2115', '2110'])
    const payroll = {
      id: 'pay-1',
      companyId: COMPANY,
      employeeId: 'emp-abc123',
      year: 2026,
      month: 3,
      bruto: 1_000_000,
      liquido: 811_300,
      afp: 112_700,
      salud: 70_000,
      cesantia: 6_000,
      impuesto: 0,
    }

    await createPayrollEntry(payroll)

    const lines: Array<{ accountId: string; debit: number; credit: number }> =
      mockCreate.mock.calls[0][0].data.lines.create

    // cotizaciones = afp + salud + cesantia = 112_700 + 70_000 + 6_000 = 188_700
    // Debit: GASTOS_PERSONAL = bruto = 1_000_000
    // Credit: REMUNERACIONES_POR_PAGAR = liquido = 811_300
    // Credit: IMPUESTOS_POR_PAGAR = impuesto + cotizaciones = 0 + 188_700 = 188_700
    // 811_300 + 188_700 = 1_000_000 ✓
    const sumDebit = lines.reduce((s, l) => s + l.debit, 0)
    const sumCredit = lines.reduce((s, l) => s + l.credit, 0)
    expect(sumDebit).toBe(sumCredit) // 1_000_000 === 1_000_000

    const gastos = lines.find((l) => l.accountId === 'acc-0-5100')!
    expect(gastos.debit).toBe(1_000_000)

    const remun = lines.find((l) => l.accountId === 'acc-1-2115')!
    expect(remun.credit).toBe(811_300)

    const imp = lines.find((l) => l.accountId === 'acc-2-2110')!
    expect(imp.credit).toBe(188_700) // 0 + 188_700
  })
})

describe('createHonorarioEntry', () => {
  it('crea asiento BHE con HONORARIOS/IMPUESTOS_POR_PAGAR/PROVEEDORES y cuadra', async () => {
    mockAccounts(['5101', '2110', '2101'])
    const honorario = {
      id: 'hon-1',
      companyId: COMPANY,
      number: 5,
      date: new Date('2026-03-10'),
      counterpartName: 'Freelancer',
      grossAmount: 800_000,
      retentionAmount: 110_000, // 13.75%
      netAmount: 690_000,
    }

    await createHonorarioEntry(honorario)

    const lines: Array<{ accountId: string; debit: number; credit: number }> =
      mockCreate.mock.calls[0][0].data.lines.create

    const sumDebit = lines.reduce((s, l) => s + l.debit, 0)
    const sumCredit = lines.reduce((s, l) => s + l.credit, 0)
    expect(sumDebit).toBe(sumCredit) // 800_000 === 800_000

    const honLine = lines.find((l) => l.accountId === 'acc-0-5101')!
    expect(honLine.debit).toBe(800_000)

    const impLine = lines.find((l) => l.accountId === 'acc-1-2110')!
    expect(impLine.credit).toBe(110_000)

    const provLine = lines.find((l) => l.accountId === 'acc-2-2101')!
    expect(provLine.credit).toBe(690_000)
  })
})
```

- [ ] **Step 2: Ejecutar y verificar**

```bash
pnpm --filter @contachile/api exec vitest run tests/lib/accounting-entries.test.ts
```

Expected: 6 tests pasando.

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/lib/accounting-entries.test.ts
git commit -m "test(sprint9): accounting-entries — asientos Ventas/Compras/Payroll/BHE cuadran contablemente"
```

---

## Task 2: Tests de payroll-service.ts

**Files:**
- Create: `apps/api/tests/lib/payroll-service.test.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@contachile/db', () => ({
  prisma: {
    employee: { findMany: vi.fn() },
    payroll: { findUnique: vi.fn(), create: vi.fn() },
  },
}))

vi.mock('@contachile/validators', () => ({
  calcularLiquidacion: vi.fn().mockReturnValue({
    bruto: 1_000_000,
    horasExtras: 0,
    bonos: 0,
    afp: 112_700,
    salud: 70_000,
    cesantia: 6_000,
    baseImponible: 811_300,
    impuesto: 0,
    otrosDesc: 0,
    liquido: 811_300,
  }),
}))

import { prisma } from '@contachile/db'
import { calcularLiquidacion } from '@contachile/validators'
import { generatePayrollForMonth } from '../../src/lib/payroll-service'

const mockEmployees = prisma.employee.findMany as ReturnType<typeof vi.fn>
const mockPayrollUnique = prisma.payroll.findUnique as ReturnType<typeof vi.fn>
const mockPayrollCreate = prisma.payroll.create as ReturnType<typeof vi.fn>
const mockCalc = vi.mocked(calcularLiquidacion)

const COMPANY = 'company-payroll'

function makeEmployee(overrides: Partial<{
  id: string
  contractType: string
  baseSalary: number
  afp: string
  healthPlan: string
  healthAmount: null | number
  isActive: boolean
}> = {}) {
  return {
    id: 'emp-1',
    contractType: 'INDEFINIDO',
    baseSalary: 1_000_000,
    afp: 'HABITAT',
    healthPlan: 'FONASA',
    healthAmount: null,
    isActive: true,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPayrollCreate.mockResolvedValue({ id: 'pay-new' })
  mockPayrollUnique.mockResolvedValue(null) // no existing by default
})

describe('generatePayrollForMonth', () => {
  it('genera liquidación para cada empleado activo no-HONORARIOS', async () => {
    mockEmployees.mockResolvedValue([
      makeEmployee({ id: 'emp-1' }),
      makeEmployee({ id: 'emp-2' }),
    ])

    const result = await generatePayrollForMonth(COMPANY, 2026, 5)

    expect(result.generated).toBe(2)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)
    expect(mockPayrollCreate).toHaveBeenCalledTimes(2)
  })

  it('salta empleado si ya existe liquidación para ese período', async () => {
    mockEmployees.mockResolvedValue([
      makeEmployee({ id: 'emp-1' }),
      makeEmployee({ id: 'emp-2' }),
    ])
    // Primer empleado ya tiene liquidación
    mockPayrollUnique
      .mockResolvedValueOnce({ id: 'existing' })
      .mockResolvedValueOnce(null)

    const result = await generatePayrollForMonth(COMPANY, 2026, 5)

    expect(result.generated).toBe(1)
    expect(result.skipped).toBe(1)
    expect(mockPayrollCreate).toHaveBeenCalledTimes(1)
  })

  it('no genera liquidación para empleados HONORARIOS', async () => {
    // La query de findMany ya filtra contractType != HONORARIOS — aquí lo verificamos
    mockEmployees.mockResolvedValue([
      makeEmployee({ contractType: 'INDEFINIDO' }),
    ])

    await generatePayrollForMonth(COMPANY, 2026, 5)

    // Verificar que findMany se llamó con contractType != HONORARIOS
    expect(mockEmployees).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          contractType: { not: 'HONORARIOS' },
        }),
      })
    )
  })

  it('registra error y continúa si payroll.create lanza excepción', async () => {
    mockEmployees.mockResolvedValue([
      makeEmployee({ id: 'emp-ok' }),
      makeEmployee({ id: 'emp-fail' }),
    ])
    mockPayrollCreate
      .mockResolvedValueOnce({ id: 'pay-1' })
      .mockRejectedValueOnce(new Error('DB constraint'))

    const result = await generatePayrollForMonth(COMPANY, 2026, 5)

    expect(result.generated).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].employeeId).toBe('emp-fail')
    expect(result.errors[0].reason).toBe('DB constraint')
  })

  it('retorna { generated:0, skipped:0, errors:[] } cuando no hay empleados', async () => {
    mockEmployees.mockResolvedValue([])

    const result = await generatePayrollForMonth(COMPANY, 2026, 5)

    expect(result.generated).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('pasa utmValue a calcularLiquidacion cuando se provee', async () => {
    mockEmployees.mockResolvedValue([makeEmployee()])

    await generatePayrollForMonth(COMPANY, 2026, 5, 68_000)

    expect(mockCalc).toHaveBeenCalledWith(
      expect.objectContaining({ utmValue: 68_000 })
    )
  })
})
```

- [ ] **Step 2: Ejecutar**

```bash
pnpm --filter @contachile/api exec vitest run tests/lib/payroll-service.test.ts
```

Expected: 6 tests pasando.

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/lib/payroll-service.test.ts
git commit -m "test(sprint9): payroll-service — generatePayrollForMonth, skip existente, error handler"
```

---

## Task 3: Tests de financial-statements.ts

**Files:**
- Create: `apps/api/tests/lib/financial-statements.test.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@contachile/db', () => ({
  prisma: {
    ledgerAccount: { findMany: vi.fn() },
    journalLine: { groupBy: vi.fn() },
  },
}))

import { prisma } from '@contachile/db'
import {
  computeTrialBalance,
  computeIncomeStatement,
  computeBalanceSheet,
} from '../../src/lib/financial-statements'

const mockAccounts = prisma.ledgerAccount.findMany as ReturnType<typeof vi.fn>
const mockGroupBy = prisma.journalLine.groupBy as ReturnType<typeof vi.fn>

const COMPANY = 'company-fs'

// Cuentas representativas para un ciclo de ventas
const ACCOUNTS = [
  { id: 'acc-clientes', code: '1103', name: 'Clientes', type: 'ACTIVO' },
  { id: 'acc-ventas',   code: '4100', name: 'Ventas',   type: 'INGRESO' },
  { id: 'acc-iva',      code: '2111', name: 'IVA Débito', type: 'PASIVO' },
]

// El asiento: Clientes debit=1_190_000 | Ventas credit=1_000_000 | IVA credit=190_000
const SUMS = [
  { accountId: 'acc-clientes', _sum: { debit: 1_190_000, credit: 0 } },
  { accountId: 'acc-ventas',   _sum: { debit: 0, credit: 1_000_000 } },
  { accountId: 'acc-iva',      _sum: { debit: 0, credit: 190_000 } },
]

beforeEach(() => {
  vi.clearAllMocks()
  mockAccounts.mockResolvedValue(ACCOUNTS)
})

describe('computeTrialBalance', () => {
  it('saldoDeudor === saldoAcreedor cuando el libro está cuadrado', async () => {
    mockGroupBy.mockResolvedValue(SUMS)

    const result = await computeTrialBalance(COMPANY, new Date('2026-03-31'))

    // saldoDeudor: Clientes max(0, 1_190_000-0)=1_190_000; Ventas 0; IVA 0 → total 1_190_000
    // saldoAcreedor: Clientes 0; Ventas max(0, 1_000_000-0)=1_000_000; IVA max(0, 190_000-0)=190_000 → total 1_190_000
    expect(result.totals.balanced).toBe(true)
    expect(result.totals.saldoDeudor).toBe(result.totals.saldoAcreedor)
    expect(result.totals.saldoDeudor).toBe(1_190_000)
  })

  it('reporta balanced=false cuando los totales no cuadran', async () => {
    // Solo el ACTIVO, sin el crédito correspondiente
    mockGroupBy.mockResolvedValue([
      { accountId: 'acc-clientes', _sum: { debit: 500_000, credit: 0 } },
    ])

    const result = await computeTrialBalance(COMPANY, new Date('2026-03-31'))

    expect(result.totals.balanced).toBe(false)
    expect(result.totals.saldoDeudor).toBeGreaterThan(0)
    expect(result.totals.saldoAcreedor).toBe(0)
  })

  it('retorna rows vacías cuando no hay movimientos', async () => {
    mockGroupBy.mockResolvedValue([])

    const result = await computeTrialBalance(COMPANY, new Date('2026-03-31'))

    expect(result.rows).toHaveLength(0)
    expect(result.totals.balanced).toBe(true) // 0 === 0
  })

  it('incluye el campo asOf formateado como YYYY-MM-DD', async () => {
    mockGroupBy.mockResolvedValue([])

    const result = await computeTrialBalance(COMPANY, new Date('2026-03-31'))

    expect(result.asOf).toBe('2026-03-31')
  })
})

describe('computeIncomeStatement', () => {
  it('utilidadEjercicio = ingresos - costos - gastos', async () => {
    // Ventas credit=1_000_000 (INGRESO); sin costos ni gastos
    mockGroupBy.mockResolvedValue([
      { accountId: 'acc-ventas', _sum: { debit: 0, credit: 1_000_000 } },
    ])

    const from = new Date('2026-01-01')
    const to   = new Date('2026-03-31')
    const result = await computeIncomeStatement(COMPANY, from, to)

    expect(result.ingresos.total).toBe(1_000_000)
    expect(result.costos.total).toBe(0)
    expect(result.gastos.total).toBe(0)
    expect(result.utilidadEjercicio).toBe(1_000_000)
    expect(result.utilidadBruta).toBe(1_000_000)
  })

  it('utilidadEjercicio negativa cuando gastos superan ingresos', async () => {
    const gastoAccount = { id: 'acc-gasto', code: '5100', name: 'Gastos Personal', type: 'GASTO' as const }
    mockAccounts.mockResolvedValue([...ACCOUNTS, gastoAccount])
    mockGroupBy.mockResolvedValue([
      { accountId: 'acc-ventas', _sum: { debit: 0, credit: 300_000 } },
      { accountId: 'acc-gasto',  _sum: { debit: 800_000, credit: 0 } },
    ])

    const result = await computeIncomeStatement(COMPANY, new Date('2026-01-01'), new Date('2026-03-31'))

    expect(result.ingresos.total).toBe(300_000)
    expect(result.gastos.total).toBe(800_000)
    expect(result.utilidadEjercicio).toBe(-500_000)
  })

  it('incluye campos from y to formateados', async () => {
    mockGroupBy.mockResolvedValue([])

    const result = await computeIncomeStatement(
      COMPANY,
      new Date('2026-01-01'),
      new Date('2026-03-31')
    )

    expect(result.from).toBe('2026-01-01')
    expect(result.to).toBe('2026-03-31')
  })
})

describe('computeBalanceSheet', () => {
  it('activo.total === pasivo.total + patrimonio.total + utilidadEjercicio cuando está cuadrado', async () => {
    // Asiento: Clientes (ACTIVO) debit=1_190_000; IVA_Debito (PASIVO) credit=190_000; Ventas (INGRESO) credit=1_000_000
    // Para el balance sheet:
    //   sumLinesUntil (acumulado): Clientes+IVA_DEBITO (solo ACTIVO y PASIVO)
    //   sumLinesInRange (año): Ventas (INGRESO para utilidadEjercicio)
    mockGroupBy
      .mockResolvedValueOnce([
        // sumLinesUntil — todas las cuentas acumuladas
        { accountId: 'acc-clientes', _sum: { debit: 1_190_000, credit: 0 } },
        { accountId: 'acc-iva',      _sum: { debit: 0, credit: 190_000 } },
        { accountId: 'acc-ventas',   _sum: { debit: 0, credit: 1_000_000 } },
      ])
      .mockResolvedValueOnce([
        // sumLinesInRange — solo del año para utilidadEjercicio
        { accountId: 'acc-ventas', _sum: { debit: 0, credit: 1_000_000 } },
      ])

    const result = await computeBalanceSheet(COMPANY, new Date('2026-03-31'))

    // activo = 1_190_000 (Clientes debit - credit)
    expect(result.activo.total).toBe(1_190_000)

    // pasivo = 190_000 (IVA_DEBITO credit - debit)
    expect(result.pasivo.total).toBe(190_000)

    // utilidadEjercicio = 1_000_000 - 0 - 0 = 1_000_000
    expect(result.utilidadEjercicio).toBe(1_000_000)

    // totalPasivoPatrimonio = 190_000 + 0 + 1_000_000 = 1_190_000
    expect(result.totalPasivoPatrimonio).toBe(1_190_000)

    // balanced: 1_190_000 === 1_190_000
    expect(result.balanced).toBe(true)
  })
})
```

- [ ] **Step 2: Ejecutar**

```bash
pnpm --filter @contachile/api exec vitest run tests/lib/financial-statements.test.ts
```

Expected: 7 tests pasando.

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/lib/financial-statements.test.ts
git commit -m "test(sprint9): financial-statements — balance cuadra, PyG correcto, utilidad negativa"
```

---

## Task 4: Tests de bank-service.ts (findAndApplyMatch)

**Files:**
- Create: `apps/api/tests/lib/bank-service.test.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@contachile/db', () => ({
  prisma: {
    bankMovement: { findFirst: vi.fn(), update: vi.fn() },
    document: { findMany: vi.fn() },
    purchase: { findMany: vi.fn() },
  },
}))

// bank-service también importa fintoc-client; lo mockeamos para que el import no falle
vi.mock('@contachile/fintoc-client', () => ({
  FintocClient: vi.fn().mockImplementation(() => ({
    listAccounts: vi.fn(),
    listMovements: vi.fn(),
  })),
}))

import { prisma } from '@contachile/db'
import { findAndApplyMatch } from '../../src/lib/bank-service'

const mockMovement = prisma.bankMovement.findFirst as ReturnType<typeof vi.fn>
const mockMovementUpdate = prisma.bankMovement.update as ReturnType<typeof vi.fn>
const mockDocuments = prisma.document.findMany as ReturnType<typeof vi.fn>
const mockPurchases = prisma.purchase.findMany as ReturnType<typeof vi.fn>

const COMPANY = 'company-bank'
const MOVEMENT_ID = 'mov-1'

function makeMovement(overrides: Partial<{
  id: string
  companyId: string
  status: string
  type: string
  amount: number
  counterpartRut: string | null
  postedAt: Date
}> = {}) {
  return {
    id: MOVEMENT_ID,
    companyId: COMPANY,
    status: 'PENDING',
    type: 'CREDIT',
    amount: 1_190_000,
    counterpartRut: '12345678-5',
    postedAt: new Date('2026-03-15'),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockMovementUpdate.mockResolvedValue({ id: MOVEMENT_ID, status: 'MATCHED_DTE' })
  mockDocuments.mockResolvedValue([])
  mockPurchases.mockResolvedValue([])
})

describe('findAndApplyMatch', () => {
  it('CREDIT con RUT y monto exacto → MATCHED_DTE', async () => {
    mockMovement.mockResolvedValue(makeMovement({ type: 'CREDIT', amount: 1_190_000 }))
    mockDocuments.mockResolvedValue([
      { id: 'doc-1', totalAmount: 1_190_000, receiverRut: '12345678-5', emittedAt: new Date('2026-03-14') },
    ])

    const result = await findAndApplyMatch(MOVEMENT_ID, COMPANY)

    expect(result.matched).toBe(true)
    expect(result.type).toBe('DTE')
    expect(result.documentId).toBe('doc-1')
    expect(mockMovementUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'MATCHED_DTE', matchedDocumentId: 'doc-1' }),
      })
    )
  })

  it('diferencia de 1 CLP impide el match — detección de inconsistencias monto exacto', async () => {
    // Movimiento = 1_190_000; DTE = 1_189_999 (1 CLP menos) → sin match
    mockMovement.mockResolvedValue(makeMovement({ amount: 1_190_000 }))
    mockDocuments.mockResolvedValue([
      { id: 'doc-1', totalAmount: 1_189_999, receiverRut: '12345678-5', emittedAt: new Date('2026-03-14') },
    ])

    const result = await findAndApplyMatch(MOVEMENT_ID, COMPANY)

    expect(result.matched).toBe(false)
    expect(mockMovementUpdate).not.toHaveBeenCalled()
  })

  it('DEBIT con compra exacta → MATCHED_PURCHASE', async () => {
    mockMovement.mockResolvedValue(
      makeMovement({ type: 'DEBIT', amount: 595_000, counterpartRut: '76000001-5' })
    )
    mockPurchases.mockResolvedValue([
      { id: 'pur-1', totalAmount: 595_000, issuerRut: '76000001-5', date: new Date('2026-03-14') },
    ])

    const result = await findAndApplyMatch(MOVEMENT_ID, COMPANY)

    expect(result.matched).toBe(true)
    expect(result.type).toBe('PURCHASE')
    expect(result.purchaseId).toBe('pur-1')
  })

  it('movimiento ya RECONCILED → matched:false sin update', async () => {
    mockMovement.mockResolvedValue(makeMovement({ status: 'RECONCILED' }))

    const result = await findAndApplyMatch(MOVEMENT_ID, COMPANY)

    expect(result.matched).toBe(false)
    expect(result.reason).toContain('RECONCILED')
    expect(mockMovementUpdate).not.toHaveBeenCalled()
  })

  it('múltiples DTEs candidatos → matched:false con lista de candidates', async () => {
    mockMovement.mockResolvedValue(makeMovement({ amount: 1_000_000 }))
    mockDocuments.mockResolvedValue([
      { id: 'doc-1', totalAmount: 1_000_000, receiverRut: '12345678-5' },
      { id: 'doc-2', totalAmount: 1_000_000, receiverRut: '12345678-5' },
    ])

    const result = await findAndApplyMatch(MOVEMENT_ID, COMPANY) as any

    expect(result.matched).toBe(false)
    expect(result.candidates).toHaveLength(2)
    expect(result.candidates).toContain('doc-1')
    expect(mockMovementUpdate).not.toHaveBeenCalled()
  })

  it('sin counterpartRut → matched:false sin consultas a DB', async () => {
    mockMovement.mockResolvedValue(makeMovement({ counterpartRut: null }))

    const result = await findAndApplyMatch(MOVEMENT_ID, COMPANY)

    expect(result.matched).toBe(false)
    expect(mockDocuments).not.toHaveBeenCalled()
    expect(mockPurchases).not.toHaveBeenCalled()
  })

  it('lanza error si movimiento no existe', async () => {
    mockMovement.mockResolvedValue(null)

    await expect(findAndApplyMatch(MOVEMENT_ID, COMPANY)).rejects.toThrow('Movimiento no encontrado')
  })
})
```

- [ ] **Step 2: Ejecutar**

```bash
pnpm --filter @contachile/api exec vitest run tests/lib/bank-service.test.ts
```

Expected: 7 tests pasando.

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/lib/bank-service.test.ts
git commit -m "test(sprint9): bank-service — findAndApplyMatch, diferencia 1 CLP, múltiples candidatos"
```

---

## Task 5: Tests de inventory-service.ts

**Files:**
- Create: `apps/api/tests/lib/inventory-service.test.ts`

- [ ] **Step 1: Crear el archivo**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@contachile/db', () => ({
  prisma: {
    product: { findFirst: vi.fn(), update: vi.fn() },
    inventoryMovement: { create: vi.fn() },
  },
}))

import { prisma } from '@contachile/db'
import {
  recordInventoryMovement,
  recordSalesMovements,
} from '../../src/lib/inventory-service'

const mockProductFind = prisma.product.findFirst as ReturnType<typeof vi.fn>
const mockProductUpdate = prisma.product.update as ReturnType<typeof vi.fn>
const mockMovCreate = prisma.inventoryMovement.create as ReturnType<typeof vi.fn>

const COMPANY = 'company-inv'

function makeProduct(overrides: Partial<{
  id: string
  code: string
  companyId: string
  stock: number
  costPrice: number
}> = {}) {
  return {
    id: 'prod-1',
    code: 'P001',
    companyId: COMPANY,
    stock: 10,
    costPrice: 5_000,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockProductUpdate.mockResolvedValue({})
  mockMovCreate.mockResolvedValue({ id: 'mov-1' })
})

describe('recordInventoryMovement — IN', () => {
  it('incrementa stock y recalcula costo promedio ponderado', async () => {
    // Stock actual: 10 unidades a $5_000 = $50_000
    // Entrada: 5 unidades a $7_000 = $35_000
    // Nuevo costo: ($50_000 + $35_000) / 15 = $5_667 (rounded)
    mockProductFind.mockResolvedValue(makeProduct({ stock: 10, costPrice: 5_000 }))

    const result = await recordInventoryMovement({
      companyId: COMPANY,
      productId: 'prod-1',
      type: 'IN',
      quantity: 5,
      unitCost: 7_000,
    })

    expect(result.product.stock).toBe(15)
    expect(result.product.costPrice).toBe(5_667) // Math.round(85_000 / 15)

    expect(mockProductUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ stock: 15, costPrice: 5_667 }),
      })
    )
  })

  it('IN sobre stock=0 usa unitCost directamente como nuevo costo', async () => {
    mockProductFind.mockResolvedValue(makeProduct({ stock: 0, costPrice: 0 }))

    const result = await recordInventoryMovement({
      companyId: COMPANY,
      productId: 'prod-1',
      type: 'IN',
      quantity: 3,
      unitCost: 4_000,
    })

    expect(result.product.stock).toBe(3)
    expect(result.product.costPrice).toBe(4_000)
  })
})

describe('recordInventoryMovement — OUT', () => {
  it('decrementa stock sin modificar costPrice', async () => {
    mockProductFind.mockResolvedValue(makeProduct({ stock: 10, costPrice: 5_000 }))

    const result = await recordInventoryMovement({
      companyId: COMPANY,
      productId: 'prod-1',
      type: 'OUT',
      quantity: 3,
    })

    expect(result.product.stock).toBe(7)
    expect(result.product.costPrice).toBe(5_000) // sin cambio
  })

  it('OUT que deja stock negativo: registra movimiento igualmente (no lanza error)', async () => {
    // stock=2, OUT 5 → stock=-3. Debe logear warn pero no lanzar.
    mockProductFind.mockResolvedValue(makeProduct({ stock: 2, costPrice: 5_000 }))
    const warnSpy = vi.fn()
    const logger = { warn: warnSpy }

    const result = await recordInventoryMovement(
      {
        companyId: COMPANY,
        productId: 'prod-1',
        type: 'OUT',
        quantity: 5,
      },
      logger
    )

    // No lanza — stock queda negativo
    expect(result.product.stock).toBe(-3)
    expect(warnSpy).toHaveBeenCalledOnce()
    expect(mockMovCreate).toHaveBeenCalledOnce()
  })

  it('lanza error si el producto no existe', async () => {
    mockProductFind.mockResolvedValue(null)

    await expect(
      recordInventoryMovement({ companyId: COMPANY, productId: 'no-existe', type: 'OUT', quantity: 1 })
    ).rejects.toThrow('no encontrado')
  })
})

describe('recordSalesMovements', () => {
  it('registra OUT para cada item con productId', async () => {
    mockProductFind.mockResolvedValue(makeProduct())

    const result = await recordSalesMovements(COMPANY, 'T33-42', [
      { documentItemId: 'item-1', productId: 'prod-1', quantity: 2 },
      { documentItemId: 'item-2', productId: 'prod-1', quantity: 3 },
    ])

    expect(result.created).toBe(2)
    expect(result.skipped).toBe(0)
    expect(mockMovCreate).toHaveBeenCalledTimes(2)
  })

  it('salta items sin productId', async () => {
    const result = await recordSalesMovements(COMPANY, 'T33-43', [
      { documentItemId: 'item-1', productId: null, quantity: 1 },
    ])

    expect(result.skipped).toBe(1)
    expect(result.created).toBe(0)
    expect(mockMovCreate).not.toHaveBeenCalled()
  })

  it('salta item si el producto no existe (no bloquea el resto)', async () => {
    mockProductFind
      .mockResolvedValueOnce(makeProduct()) // prod-1 ok
      .mockResolvedValueOnce(null)          // prod-2 no existe

    const result = await recordSalesMovements(COMPANY, 'T33-44', [
      { documentItemId: 'item-1', productId: 'prod-1', quantity: 1 },
      { documentItemId: 'item-2', productId: 'prod-2', quantity: 1 },
    ])

    expect(result.created).toBe(1)
    expect(result.skipped).toBe(1)
  })
})
```

- [ ] **Step 2: Ejecutar**

```bash
pnpm --filter @contachile/api exec vitest run tests/lib/inventory-service.test.ts
```

Expected: 8 tests pasando.

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/lib/inventory-service.test.ts
git commit -m "test(sprint9): inventory-service — costo promedio, stock negativo, recordSalesMovements"
```

---

## Task 6: Tests de routes/payroll.ts

**Files:**
- Create: `apps/api/tests/routes/payroll.test.ts`

- [ ] **Step 1: Crear directorio y archivo**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

vi.mock('@contachile/db', () => ({
  prisma: {
    payroll: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    company: { findUnique: vi.fn() },
    companyMembership: {
      findMany: vi.fn().mockResolvedValue([{ companyId: 'company-pay', role: 'owner' }]),
      findFirst: vi.fn(),
    },
  },
}))

vi.mock('@contachile/auth', () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue(null) } },
  decryptCertPassword: vi.fn(),
}))

vi.mock('../../src/lib/payroll-service', () => ({
  generatePayrollForMonth: vi.fn(),
}))

vi.mock('../../src/lib/accounting-entries', () => ({
  createPayrollEntry: vi.fn().mockResolvedValue({ id: 'entry-1' }),
}))

vi.mock('../../src/lib/payroll-pdf', () => ({
  generatePayrollPdf: vi.fn().mockResolvedValue(Buffer.from('%PDF-1.4 fake')),
}))

vi.mock('../../src/lib/payroll-exports', () => ({
  generatePreviRedFile: vi.fn().mockReturnValue('PREVIRED_CONTENT'),
  generateDdjj1887File: vi.fn().mockReturnValue('DDJJ_CONTENT'),
}))

import { prisma } from '@contachile/db'
import { generatePayrollForMonth } from '../../src/lib/payroll-service'
import tenantPlugin from '../../src/plugins/tenant'
import payrollRoute from '../../src/routes/payroll'

const mockPayrollFindMany = prisma.payroll.findMany as ReturnType<typeof vi.fn>
const mockPayrollFindFirst = prisma.payroll.findFirst as ReturnType<typeof vi.fn>
const mockPayrollUpdate = prisma.payroll.update as ReturnType<typeof vi.fn>
const mockGenerate = vi.mocked(generatePayrollForMonth)

const COMPANY = 'company-pay'
const HEADERS = { 'x-active-company-id': COMPANY, 'x-user-id': 'user-1' }

function buildApp() {
  const app = Fastify()
  app.register(tenantPlugin)
  app.register(payrollRoute)
  return app
}

const MOCK_PAYROLL = {
  id: 'pay-1',
  companyId: COMPANY,
  employeeId: 'emp-1',
  year: 2026,
  month: 5,
  bruto: 1_000_000,
  afp: 112_700,
  salud: 70_000,
  cesantia: 6_000,
  impuesto: 0,
  liquido: 811_300,
  status: 'DRAFT',
  approvedAt: null,
  employee: { rut: '12345678-5', name: 'Juan Pérez', position: 'Desarrollador', afp: 'HABITAT' },
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.DEV_BYPASS_AUTH = 'true'
  mockGenerate.mockResolvedValue({ generated: 1, skipped: 0, errors: [] })
})

describe('POST /payroll/generate', () => {
  it('genera payroll para un mes pasado → 201', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/payroll/generate',
      headers: HEADERS,
      payload: { year: 2026, month: 5 },
    })

    expect(res.statusCode).toBe(201)
    expect(mockGenerate).toHaveBeenCalledWith(COMPANY, 2026, 5)
    const body = res.json()
    expect(body.generated).toBe(1)
  })

  it('rechaza un mes futuro → 400', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/payroll/generate',
      headers: HEADERS,
      payload: { year: 2099, month: 12 },
    })

    expect(res.statusCode).toBe(400)
    expect(mockGenerate).not.toHaveBeenCalled()
  })

  it('rechaza body inválido (mes fuera de rango) → 400', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/payroll/generate',
      headers: HEADERS,
      payload: { year: 2026, month: 13 },
    })

    expect(res.statusCode).toBe(400)
  })
})

describe('GET /payroll/:year/:month', () => {
  it('retorna liquidaciones y totales → 200', async () => {
    mockPayrollFindMany.mockResolvedValue([MOCK_PAYROLL])

    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/payroll/2026/5',
      headers: HEADERS,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.payrolls).toHaveLength(1)
    expect(body.totals.bruto).toBe(1_000_000)
    expect(body.totals.liquido).toBe(811_300)
  })

  it('mes inválido → 400', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/payroll/2026/99',
      headers: HEADERS,
    })

    expect(res.statusCode).toBe(400)
  })

  it('lista vacía cuando no hay liquidaciones', async () => {
    mockPayrollFindMany.mockResolvedValue([])

    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/payroll/2026/5',
      headers: HEADERS,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.payrolls).toHaveLength(0)
    expect(body.totals.bruto).toBe(0)
  })
})

describe('POST /payroll/item/:id/approve', () => {
  it('aprueba liquidación DRAFT → 200 y crea asiento', async () => {
    mockPayrollFindFirst.mockResolvedValue(MOCK_PAYROLL)
    mockPayrollUpdate.mockResolvedValue({ ...MOCK_PAYROLL, status: 'APPROVED', approvedAt: new Date() })

    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `/payroll/item/${MOCK_PAYROLL.id}/approve`,
      headers: HEADERS,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.status).toBe('APPROVED')
    expect(mockPayrollUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'APPROVED' }),
      })
    )
  })

  it('rechaza aprobar una liquidación que no está en DRAFT → 400', async () => {
    mockPayrollFindFirst.mockResolvedValue({ ...MOCK_PAYROLL, status: 'APPROVED' })

    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: `/payroll/item/${MOCK_PAYROLL.id}/approve`,
      headers: HEADERS,
    })

    expect(res.statusCode).toBe(400)
    expect(mockPayrollUpdate).not.toHaveBeenCalled()
  })

  it('retorna 404 si la liquidación no pertenece al tenant', async () => {
    mockPayrollFindFirst.mockResolvedValue(null)

    const app = buildApp()
    const res = await app.inject({
      method: 'POST',
      url: '/payroll/item/no-existe/approve',
      headers: HEADERS,
    })

    expect(res.statusCode).toBe(404)
  })
})
```

- [ ] **Step 2: Ejecutar**

```bash
pnpm --filter @contachile/api exec vitest run tests/routes/payroll.test.ts
```

Expected: 8 tests pasando.

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/routes/payroll.test.ts
git commit -m "test(sprint9): routes/payroll — generate, listado, approve con control de estado"
```

---

## Task 7: Tests de routes/accounting/reports.ts

**Files:**
- Create: `apps/api/tests/routes/accounting/reports.test.ts`

- [ ] **Step 1: Crear el directorio y archivo**

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'

vi.mock('@contachile/auth', () => ({
  auth: { api: { getSession: vi.fn().mockResolvedValue(null) } },
  decryptCertPassword: vi.fn(),
}))

vi.mock('@contachile/db', () => ({
  prisma: {
    companyMembership: {
      findMany: vi.fn().mockResolvedValue([{ companyId: 'company-rpt', role: 'owner' }]),
      findFirst: vi.fn(),
    },
    company: { findUnique: vi.fn(), upsert: vi.fn(), findFirst: vi.fn() },
  },
}))

vi.mock('../../../src/lib/financial-statements', () => ({
  computeTrialBalance: vi.fn(),
  computeIncomeStatement: vi.fn(),
  computeBalanceSheet: vi.fn(),
}))

import {
  computeTrialBalance,
  computeIncomeStatement,
  computeBalanceSheet,
} from '../../../src/lib/financial-statements'
import tenantPlugin from '../../../src/plugins/tenant'
import reportsRoute from '../../../src/routes/accounting/reports'

const mockTrialBalance = vi.mocked(computeTrialBalance)
const mockIncomeStatement = vi.mocked(computeIncomeStatement)
const mockBalanceSheet = vi.mocked(computeBalanceSheet)

const COMPANY = 'company-rpt'
const HEADERS = { 'x-active-company-id': COMPANY, 'x-user-id': 'user-1' }

const TRIAL_BALANCE_RESPONSE = {
  asOf: '2026-03-31',
  rows: [],
  totals: { totalDebit: 1_190_000, totalCredit: 1_190_000, saldoDeudor: 1_190_000, saldoAcreedor: 1_190_000, balanced: true },
}

const INCOME_RESPONSE = {
  from: '2026-01-01',
  to: '2026-03-31',
  ingresos: { total: 1_000_000, rows: [] },
  costos: { total: 0, rows: [] },
  gastos: { total: 0, rows: [] },
  utilidadBruta: 1_000_000,
  utilidadEjercicio: 1_000_000,
}

const BALANCE_RESPONSE = {
  asOf: '2026-03-31',
  activo: { total: 1_190_000, rows: [] },
  pasivo: { total: 190_000, rows: [] },
  patrimonio: { total: 0, rows: [] },
  utilidadEjercicio: 1_000_000,
  totalPasivoPatrimonio: 1_190_000,
  balanced: true,
}

function buildApp() {
  const app = Fastify()
  app.register(tenantPlugin)
  app.register(reportsRoute)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.DEV_BYPASS_AUTH = 'true'
  mockTrialBalance.mockResolvedValue(TRIAL_BALANCE_RESPONSE)
  mockIncomeStatement.mockResolvedValue(INCOME_RESPONSE)
  mockBalanceSheet.mockResolvedValue(BALANCE_RESPONSE)
})

describe('GET /accounting/reports/trial-balance', () => {
  it('retorna balance de comprobación con campo balanced → 200', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/accounting/reports/trial-balance?asOf=2026-03-31',
      headers: HEADERS,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.totals.balanced).toBe(true)
    expect(mockTrialBalance).toHaveBeenCalledWith(COMPANY, expect.any(Date))
  })

  it('usa fecha de hoy cuando asOf no se especifica', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/accounting/reports/trial-balance',
      headers: HEADERS,
    })

    expect(res.statusCode).toBe(200)
    expect(mockTrialBalance).toHaveBeenCalledOnce()
  })
})

describe('GET /accounting/reports/income-statement', () => {
  it('retorna estado de resultados con utilidadEjercicio → 200', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/accounting/reports/income-statement?from=2026-01-01&to=2026-03-31',
      headers: HEADERS,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.utilidadEjercicio).toBe(1_000_000)
    expect(body.ingresos.total).toBe(1_000_000)
  })

  it('retorna 400 cuando faltan parámetros from/to', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/accounting/reports/income-statement?from=2026-01-01',
      headers: HEADERS,
    })

    expect(res.statusCode).toBe(400)
    expect(mockIncomeStatement).not.toHaveBeenCalled()
  })
})

describe('GET /accounting/reports/balance-sheet', () => {
  it('retorna balance general con campo balanced → 200', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/accounting/reports/balance-sheet?asOf=2026-03-31',
      headers: HEADERS,
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.balanced).toBe(true)
    expect(body.activo.total).toBe(1_190_000)
    expect(body.totalPasivoPatrimonio).toBe(1_190_000)
  })

  it('usa fecha de hoy cuando asOf no se especifica', async () => {
    const app = buildApp()
    const res = await app.inject({
      method: 'GET',
      url: '/accounting/reports/balance-sheet',
      headers: HEADERS,
    })

    expect(res.statusCode).toBe(200)
    expect(mockBalanceSheet).toHaveBeenCalledOnce()
  })
})
```

- [ ] **Step 2: Crear el directorio si no existe**

```bash
mkdir -p apps/api/tests/routes/accounting
```

- [ ] **Step 3: Ejecutar**

```bash
pnpm --filter @contachile/api exec vitest run tests/routes/accounting/reports.test.ts
```

Expected: 6 tests pasando.

- [ ] **Step 4: Commit**

```bash
git add apps/api/tests/routes/accounting/reports.test.ts
git commit -m "test(sprint9): routes/accounting/reports — trial-balance, income-statement, balance-sheet"
```

---

## Task 8: Extender folio-concurrency.test.ts

**Files:**
- Modify: `apps/api/tests/dte/folio-concurrency.test.ts`

Agregar un test al final del `describe` existente que verifica que 10 requests concurrentes obtienen folios únicos a través del mock de `$queryRaw`.

- [ ] **Step 1: Agregar el test al final del describe existente**

Abrir `apps/api/tests/dte/folio-concurrency.test.ts` y agregar este test al final, antes del cierre del `describe`:

```typescript
  it('10 requests concurrentes: cada uno obtiene un folio único de $queryRaw', async () => {
    let seq = 0

    mockPrisma.company.findUnique.mockResolvedValue(MOCK_COMPANY)
    mockPrisma.document.findUnique.mockResolvedValue(null)
    mockPrisma.documentItem.findMany.mockResolvedValue([])
    mockPrisma.$queryRaw.mockImplementation(async () => {
      seq++
      return [{ folio: BigInt(seq) }]
    })
    mockPrisma.document.create.mockImplementation(async (args: any) => ({
      id: `doc-${seq}`,
      type: args.data.type ?? 33,
      folio: args.data.folio ?? seq,
      status: 'PENDING',
      trackId: `SII-${Date.now()}`,
      emittedAt: new Date(),
      receiverEmail: null,
      companyId: 'company-concurrent',
    }))

    const app = Fastify()
    app.register(tenantPlugin)
    app.register(emitRoute)
    await app.ready()

    const results = await Promise.all(
      Array.from({ length: 10 }, () =>
        app.inject({
          method: 'POST',
          url: '/dte/emit',
          headers: { 'x-company-id': 'company-concurrent' },
          payload: PAYLOAD,
        })
      )
    )

    // Todos los requests deben tener éxito
    for (const r of results) {
      expect(
        r.statusCode,
        `Request falló (${r.statusCode}): ${r.body.substring(0, 200)}`
      ).toBe(201)
    }

    // $queryRaw se llamó exactamente una vez por request
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(10)

    // Los folios asignados deben ser todos distintos
    const createArgs = mockPrisma.document.create.mock.calls.map(
      (c: any[]) => c[0].data.folio as number
    )
    const uniqueFolios = new Set(createArgs)
    expect(uniqueFolios.size).toBe(10)
  })
```

- [ ] **Step 2: Ejecutar solo este archivo**

```bash
pnpm --filter @contachile/api exec vitest run tests/dte/folio-concurrency.test.ts
```

Expected: 4 tests pasando (los 3 existentes + el nuevo).

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/dte/folio-concurrency.test.ts
git commit -m "test(sprint9): folio-concurrency — 10 requests paralelos obtienen folios únicos"
```

---

## Task 9: Coverage threshold en vitest.config.ts + CI gate

**Files:**
- Modify: `apps/api/package.json`
- Modify: `apps/api/vitest.config.ts`
- Modify: `.github/workflows/ci.yml`

- [ ] **Step 1: Agregar @vitest/coverage-v8 a package.json del API**

```bash
pnpm --filter @contachile/api add -D @vitest/coverage-v8
```

Expected: sin errores; `pnpm-lock.yaml` actualizado.

- [ ] **Step 2: Actualizar apps/api/vitest.config.ts**

Reemplazar el contenido actual con:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    setupFiles: ['./vitest.setup.ts'],
    environment: 'node',
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: [
        'src/index.ts',
        'src/lib/email.ts',       // solo fachada de Resend, no lógica propia
        'src/lib/redis.ts',       // wrapper delgado
        'src/lib/payroll-pdf.ts', // depende de pdfkit, testeado manualmente
        'src/lib/payroll-exports.ts',
        'src/lib/quote-pdf.ts',
      ],
      thresholds: {
        lines: 60,
        functions: 60,
        branches: 50,
        statements: 60,
      },
    },
  },
})
```

- [ ] **Step 3: Verificar que coverage corre localmente**

```bash
pnpm --filter @contachile/api exec vitest run --coverage
```

Expected: coverage report generado en `apps/api/coverage/`. Si algún threshold falla, revisar qué módulo necesita más tests.

- [ ] **Step 4: Actualizar .github/workflows/ci.yml**

Reemplazar el paso `Run tests` con uno que incluya coverage:

```yaml
      - name: Run tests with coverage
        run: pnpm --filter @contachile/api exec vitest run --coverage
        env:
          DATABASE_URL: postgresql://contachile:contachile@localhost:5432/contachile
          REDIS_HOST: localhost
          REDIS_PORT: 6379
          SII_BASE_URL: https://maullin.sii.cl
          SII_ENV: test
          ACEPTA_API_KEY: test-key
          FINTOC_SECRET_KEY: test-fintoc-key
          BETTER_AUTH_SECRET: test-secret
          DEV_BYPASS_AUTH: "true"
```

> El threshold de 60% en `vitest.config.ts` hace que el paso falle automáticamente si la cobertura cae. No se necesita un paso adicional de verificación.

- [ ] **Step 5: Commit final**

```bash
git add apps/api/vitest.config.ts apps/api/package.json pnpm-lock.yaml .github/workflows/ci.yml
git commit -m "ci(sprint9): coverage threshold 60% en API — vitest --coverage bloquea CI si cae"
```

---

## Self-Review

**Spec coverage:**
- ✅ `accounting-entries.test.ts` — Ventas (Clientes/Ventas/IVA_DEBITO), Compras (Gastos/IVA_Crédito/Proveedores), Payroll (GastosPersonal/Remuneraciones/Impuestos), BHE: Task 1
- ✅ `payroll-service.test.ts` — generatePayrollForMonth, skip existente, filtro HONORARIOS, error handler: Task 2
- ✅ `financial-statements.test.ts` — balance cuadra, balanced=false, PyG, utilidad negativa, balance sheet: Task 3
- ✅ `bank-service.test.ts` — CREDIT match, 1 CLP diferencia sin match, DEBIT match, RECONCILED, múltiples candidatos: Task 4
- ✅ `inventory-service.test.ts` — costo promedio IN, OUT decrementa, stock negativo warn, error si no existe, recordSalesMovements: Task 5
- ✅ `routes/payroll.test.ts` — generate 201, futuro 400, mes inválido 400, listado con totales, approve DRAFT, approve no-DRAFT 400, 404: Task 6
- ✅ `routes/accounting/reports.test.ts` — trial-balance, income-statement (missing params 400), balance-sheet, fecha de hoy default: Task 7
- ✅ `folio-concurrency.test.ts` — 10 requests paralelos folios únicos: Task 8
- ✅ Coverage threshold 60% + CI gate: Task 9

**Placeholder scan:** ninguno detectado — todos los steps tienen código completo.

**Type consistency:** todas las funciones importadas (`createSalesEntry`, `generatePayrollForMonth`, `findAndApplyMatch`, etc.) usan los mismos nombres que en los archivos fuente. Los tipos de mock (`vi.fn()`) son consistentes en todos los tasks.
