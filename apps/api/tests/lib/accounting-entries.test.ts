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
