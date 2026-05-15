import { prisma } from '@contachile/db'

type AccountType = 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO' | 'COSTO'

interface AccountInfo {
  id: string
  code: string
  name: string
  type: AccountType
}

interface AccountSum {
  accountId: string
  debit: number
  credit: number
}

async function getCompanyAccounts(companyId: string): Promise<AccountInfo[]> {
  return prisma.account.findMany({
    where: { companyId },
    select: { id: true, code: true, name: true, type: true },
    orderBy: { code: 'asc' },
  })
}

async function sumLinesUntil(
  companyId: string,
  asOf: Date,
  accountIds: string[]
): Promise<AccountSum[]> {
  if (accountIds.length === 0) return []
  const groups = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where: {
      accountId: { in: accountIds },
      journalEntry: { companyId, date: { lte: asOf } },
    },
    _sum: { debit: true, credit: true },
  })
  return groups.map((g) => ({
    accountId: g.accountId,
    debit: g._sum.debit ?? 0,
    credit: g._sum.credit ?? 0,
  }))
}

async function sumLinesInRange(
  companyId: string,
  from: Date,
  to: Date,
  accountIds: string[]
): Promise<AccountSum[]> {
  if (accountIds.length === 0) return []
  const groups = await prisma.journalLine.groupBy({
    by: ['accountId'],
    where: {
      accountId: { in: accountIds },
      journalEntry: { companyId, date: { gte: from, lte: to } },
    },
    _sum: { debit: true, credit: true },
  })
  return groups.map((g) => ({
    accountId: g.accountId,
    debit: g._sum.debit ?? 0,
    credit: g._sum.credit ?? 0,
  }))
}

function groupRows(
  accounts: AccountInfo[],
  sums: AccountSum[],
  filterType: AccountType,
  naturalSide: 'debit' | 'credit'
) {
  const sumByAccount = new Map(sums.map((s) => [s.accountId, s]))
  const rows = accounts
    .filter((a) => a.type === filterType)
    .map((a) => {
      const s = sumByAccount.get(a.id) ?? { debit: 0, credit: 0 }
      const value = naturalSide === 'debit' ? s.debit - s.credit : s.credit - s.debit
      return { accountId: a.id, code: a.code, name: a.name, value }
    })
    .filter((r) => r.value !== 0)
  const total = rows.reduce((s, r) => s + r.value, 0)
  return { total, rows }
}

export async function computeTrialBalance(companyId: string, asOf: Date) {
  const accounts = await getCompanyAccounts(companyId)
  const sums = await sumLinesUntil(
    companyId,
    asOf,
    accounts.map((a) => a.id)
  )
  const sumByAccount = new Map(sums.map((s) => [s.accountId, s]))

  const rows = accounts
    .map((a) => {
      const s = sumByAccount.get(a.id) ?? { debit: 0, credit: 0 }
      const saldoDeudor = Math.max(0, s.debit - s.credit)
      const saldoAcreedor = Math.max(0, s.credit - s.debit)
      return {
        accountId: a.id,
        code: a.code,
        name: a.name,
        type: a.type,
        totalDebit: s.debit,
        totalCredit: s.credit,
        saldoDeudor,
        saldoAcreedor,
      }
    })
    .filter((r) => r.totalDebit > 0 || r.totalCredit > 0)

  const totalDebit = rows.reduce((s, r) => s + r.totalDebit, 0)
  const totalCredit = rows.reduce((s, r) => s + r.totalCredit, 0)
  const saldoDeudor = rows.reduce((s, r) => s + r.saldoDeudor, 0)
  const saldoAcreedor = rows.reduce((s, r) => s + r.saldoAcreedor, 0)

  return {
    asOf: asOf.toISOString().slice(0, 10),
    rows,
    totals: {
      totalDebit,
      totalCredit,
      saldoDeudor,
      saldoAcreedor,
      balanced: saldoDeudor === saldoAcreedor,
    },
  }
}

export async function computeIncomeStatement(companyId: string, from: Date, to: Date) {
  const accounts = await getCompanyAccounts(companyId)
  const sums = await sumLinesInRange(
    companyId,
    from,
    to,
    accounts.map((a) => a.id)
  )

  const ingresos = groupRows(accounts, sums, 'INGRESO', 'credit')
  const costos = groupRows(accounts, sums, 'COSTO', 'debit')
  const gastos = groupRows(accounts, sums, 'GASTO', 'debit')

  const utilidadBruta = ingresos.total - costos.total
  const utilidadEjercicio = ingresos.total - costos.total - gastos.total

  return {
    from: from.toISOString().slice(0, 10),
    to: to.toISOString().slice(0, 10),
    ingresos,
    costos,
    gastos,
    utilidadBruta,
    utilidadEjercicio,
  }
}

export async function computeBalanceSheet(companyId: string, asOf: Date) {
  const accounts = await getCompanyAccounts(companyId)
  const sumsAcum = await sumLinesUntil(
    companyId,
    asOf,
    accounts.map((a) => a.id)
  )

  const activo = groupRows(accounts, sumsAcum, 'ACTIVO', 'debit')
  const pasivo = groupRows(accounts, sumsAcum, 'PASIVO', 'credit')
  const patrimonio = groupRows(accounts, sumsAcum, 'PATRIMONIO', 'credit')

  const yearStart = new Date(asOf.getFullYear(), 0, 1)
  const sumsYear = await sumLinesInRange(
    companyId,
    yearStart,
    asOf,
    accounts.map((a) => a.id)
  )
  const ingresos = groupRows(accounts, sumsYear, 'INGRESO', 'credit')
  const costos = groupRows(accounts, sumsYear, 'COSTO', 'debit')
  const gastos = groupRows(accounts, sumsYear, 'GASTO', 'debit')
  const utilidadEjercicio = ingresos.total - costos.total - gastos.total

  const totalPasivoPatrimonio = pasivo.total + patrimonio.total + utilidadEjercicio

  return {
    asOf: asOf.toISOString().slice(0, 10),
    activo,
    pasivo,
    patrimonio,
    utilidadEjercicio,
    totalPasivoPatrimonio,
    balanced: activo.total === totalPasivoPatrimonio,
  }
}
