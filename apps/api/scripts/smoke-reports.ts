/**
 * Smoke test for financial statements: trial balance, income statement, balance sheet.
 *
 * Assumes smoke-journal.ts has been run first so that `dev-test-company` has:
 * - 1 sales entry ($119k total: 1103 D, 4100/2111 H)
 * - 2 purchase entries: arriendo (5110/1115 D, 2101 H) and fallback (5220/1115 D, 2101 H)
 *
 * Run: $env:DATABASE_URL="postgresql://contachile:contachile@localhost:5432/contachile"
 *      apps/api/node_modules/.bin/tsx.CMD apps/api/scripts/smoke-reports.ts
 */

import { PrismaClient } from '../../../packages/db/generated/client'
import {
  computeTrialBalance,
  computeIncomeStatement,
  computeBalanceSheet,
} from '../src/lib/financial-statements'

const prisma = new PrismaClient()
const COMPANY_ID = 'dev-test-company'

async function testTrialBalance() {
  console.log('=== Test 1: Trial Balance ===')
  const today = new Date()
  today.setHours(23, 59, 59)
  const tb = await computeTrialBalance(COMPANY_ID, today)

  console.log(`asOf: ${tb.asOf}, rows: ${tb.rows.length}`)
  for (const r of tb.rows) {
    console.log(
      `  ${r.code} ${r.name.padEnd(28)} D=${r.totalDebit.toString().padStart(8)} H=${r.totalCredit.toString().padStart(8)} sD=${r.saldoDeudor.toString().padStart(8)} sA=${r.saldoAcreedor.toString().padStart(8)}`
    )
  }
  console.log(`Totals: D=${tb.totals.totalDebit} H=${tb.totals.totalCredit} sD=${tb.totals.saldoDeudor} sA=${tb.totals.saldoAcreedor}`)

  if (!tb.totals.balanced) {
    console.log(`[FAIL] balance no cuadra (sD=${tb.totals.saldoDeudor} sA=${tb.totals.saldoAcreedor})`)
    return false
  }
  if (tb.totals.totalDebit !== tb.totals.totalCredit) {
    console.log(`[FAIL] totales debe/haber no coinciden`)
    return false
  }
  console.log(`[OK] balanced (sD=sA=${tb.totals.saldoDeudor})`)
  return true
}

async function testIncomeStatement() {
  console.log('\n=== Test 2: Income Statement (año actual) ===')
  const today = new Date()
  const yearStart = new Date(today.getFullYear(), 0, 1)
  const yearEnd = new Date(today.getFullYear(), 11, 31, 23, 59, 59)

  const is = await computeIncomeStatement(COMPANY_ID, yearStart, yearEnd)
  console.log(`Período: ${is.from} → ${is.to}`)
  console.log(`Ingresos: ${is.ingresos.total}`)
  for (const r of is.ingresos.rows) console.log(`  + ${r.code} ${r.name} = ${r.value}`)
  console.log(`Costos: ${is.costos.total}`)
  console.log(`Gastos: ${is.gastos.total}`)
  for (const r of is.gastos.rows) console.log(`  - ${r.code} ${r.name} = ${r.value}`)
  console.log(`Utilidad bruta: ${is.utilidadBruta}`)
  console.log(`Utilidad ejercicio: ${is.utilidadEjercicio}`)

  if (is.utilidadEjercicio !== is.ingresos.total - is.costos.total - is.gastos.total) {
    console.log(`[FAIL] utilidad no calcula bien`)
    return false
  }
  if (is.utilidadBruta !== is.ingresos.total - is.costos.total) {
    console.log(`[FAIL] utilidad bruta no calcula bien`)
    return false
  }
  console.log(`[OK] Utilidad ejercicio = ${is.utilidadEjercicio}`)
  return true
}

async function testBalanceSheet() {
  console.log('\n=== Test 3: Balance Sheet ===')
  const today = new Date()
  today.setHours(23, 59, 59)
  const bs = await computeBalanceSheet(COMPANY_ID, today)

  console.log(`asOf: ${bs.asOf}`)
  console.log(`Activo: ${bs.activo.total}`)
  for (const r of bs.activo.rows) console.log(`  ${r.code} ${r.name} = ${r.value}`)
  console.log(`Pasivo: ${bs.pasivo.total}`)
  for (const r of bs.pasivo.rows) console.log(`  ${r.code} ${r.name} = ${r.value}`)
  console.log(`Patrimonio: ${bs.patrimonio.total}`)
  for (const r of bs.patrimonio.rows) console.log(`  ${r.code} ${r.name} = ${r.value}`)
  console.log(`Utilidad ejercicio: ${bs.utilidadEjercicio}`)
  console.log(`Total Pasivo+Patrimonio+Utilidad: ${bs.totalPasivoPatrimonio}`)

  if (!bs.balanced) {
    console.log(`[FAIL] activo (${bs.activo.total}) != total P+P+U (${bs.totalPasivoPatrimonio})`)
    return false
  }
  console.log(`[OK] balanced: activo = P+P+U = ${bs.activo.total}`)
  return true
}

async function testCrossConsistency() {
  console.log('\n=== Test 4: Consistencia cruzada ===')
  const today = new Date()
  today.setHours(23, 59, 59)
  const yearStart = new Date(today.getFullYear(), 0, 1)

  const is = await computeIncomeStatement(COMPANY_ID, yearStart, today)
  const bs = await computeBalanceSheet(COMPANY_ID, today)

  if (is.utilidadEjercicio !== bs.utilidadEjercicio) {
    console.log(
      `[FAIL] Utilidad ejercicio discrepa: income statement=${is.utilidadEjercicio} balance sheet=${bs.utilidadEjercicio}`
    )
    return false
  }
  console.log(`[OK] Utilidad consistente entre IS y BS: ${is.utilidadEjercicio}`)
  return true
}

async function main() {
  try {
    console.log('===== Smoke test: Estados Financieros =====\n')
    const r1 = await testTrialBalance()
    const r2 = await testIncomeStatement()
    const r3 = await testBalanceSheet()
    const r4 = await testCrossConsistency()

    console.log('\n===== Resultado =====')
    console.log(`Test 1 (trial balance balanced):     ${r1 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 2 (income statement math):      ${r2 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 3 (balance sheet balanced):     ${r3 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 4 (utilidad consistente IS=BS): ${r4 ? 'PASS' : 'FAIL'}`)

    process.exit(r1 && r2 && r3 && r4 ? 0 : 1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
