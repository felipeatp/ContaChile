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
