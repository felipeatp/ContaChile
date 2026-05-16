/**
 * Smoke test for bank reconciliation.
 *
 * Run: $env:DATABASE_URL="postgresql://contachile:contachile@localhost:5432/contachile"
 *      apps/api/node_modules/.bin/tsx.CMD apps/api/scripts/smoke-banking.ts
 */

import { PrismaClient } from '../../../packages/db/generated/client'
import {
  syncBankAccounts,
  syncMovements,
  findAndApplyMatch,
  reconcileWithEntry,
} from '../src/lib/bank-service'

const prisma = new PrismaClient()
const COMPANY_ID = 'dev-test-company'

const logger = { warn: (data: object, msg: string) => console.log('[WARN]', msg, JSON.stringify(data)) }

async function cleanup() {
  // Borra solo lo que el smoke crea
  await prisma.journalEntry.deleteMany({
    where: { companyId: COMPANY_ID, source: 'bank' },
  })
  await prisma.bankMovement.deleteMany({ where: { companyId: COMPANY_ID } })
  await prisma.bankAccount.deleteMany({ where: { companyId: COMPANY_ID } })
}

async function ensureMatchableData() {
  // Verifica que haya al menos 1 DTE y 1 Purchase para que el simulador matchee
  const dteCount = await prisma.document.count({ where: { companyId: COMPANY_ID, type: 33 } })
  const purchaseCount = await prisma.purchase.count({ where: { companyId: COMPANY_ID } })

  if (dteCount === 0) {
    await prisma.document.create({
      data: {
        companyId: COMPANY_ID,
        type: 33,
        folio: 9000,
        status: 'ACCEPTED',
        receiverRut: '76.999.888-7',
        receiverName: 'Cliente Sync Test',
        totalNet: 100000,
        totalTax: 19000,
        totalAmount: 119000,
        paymentMethod: 'CONTADO',
        emittedAt: new Date(),
      },
    })
    console.log('[OK] DTE seed creado para matching')
  }

  if (purchaseCount === 0) {
    await prisma.purchase.create({
      data: {
        companyId: COMPANY_ID,
        type: 33,
        folio: 8000,
        issuerRut: '77.888.999-K',
        issuerName: 'Proveedor Sync Test',
        date: new Date(),
        netAmount: 50000,
        taxAmount: 9500,
        totalAmount: 59500,
      },
    })
    console.log('[OK] Purchase seed creado para matching')
  }
}

async function testSyncAccounts() {
  console.log('=== Test 1: syncBankAccounts ===')
  const result = await syncBankAccounts(COMPANY_ID, logger)
  console.log(`created=${result.created}, updated=${result.updated}`)
  const count = await prisma.bankAccount.count({ where: { companyId: COMPANY_ID } })
  if (count !== 1) {
    console.log(`[FAIL] esperado 1 cuenta, obtuvo ${count}`)
    return false
  }
  console.log('[OK] 1 BankAccount creado')
  return true
}

async function testSyncMovements() {
  console.log('\n=== Test 2: syncMovements ===')
  const result = await syncMovements(COMPANY_ID)
  console.log(`created=${result.created}, existing=${result.existing}, total=${result.total}, simulated=${result.simulated}`)
  if (result.created < 5) {
    console.log(`[FAIL] esperado al menos 5 movimientos creados, obtuvo ${result.created}`)
    return false
  }
  console.log(`[OK] ${result.created} movimientos creados`)
  return true
}

async function testMatchDte() {
  console.log('\n=== Test 3: match-auto contra DTE ===')
  // El simulador crea movimientos sim_mov_dte_0/1 con CREDIT que matchean DTEs
  const movements = await prisma.bankMovement.findMany({
    where: { companyId: COMPANY_ID, externalId: { startsWith: 'sim_mov_dte_' } },
  })
  if (movements.length === 0) {
    console.log('[INFO] No hay movimientos sim_mov_dte_* (sin DTEs para seed). Skipping.')
    return true
  }

  let matched = 0
  for (const m of movements) {
    const r = await findAndApplyMatch(m.id, COMPANY_ID)
    if (r.matched && r.type === 'DTE') matched++
    console.log(`  ${m.externalId}: matched=${r.matched} ${r.matched ? 'type=' + r.type : 'reason=' + r.reason}`)
  }
  if (matched === 0) {
    console.log('[FAIL] esperado al menos 1 match DTE')
    return false
  }
  console.log(`[OK] ${matched}/${movements.length} matcheados con DTE`)
  return true
}

async function testMatchPurchase() {
  console.log('\n=== Test 4: match-auto contra Purchase ===')
  const movements = await prisma.bankMovement.findMany({
    where: { companyId: COMPANY_ID, externalId: { startsWith: 'sim_mov_purchase_' } },
  })
  if (movements.length === 0) {
    console.log('[INFO] No hay movimientos sim_mov_purchase_* (sin compras para seed). Skipping.')
    return true
  }

  let matched = 0
  for (const m of movements) {
    const r = await findAndApplyMatch(m.id, COMPANY_ID)
    if (r.matched && r.type === 'PURCHASE') matched++
    console.log(`  ${m.externalId}: matched=${r.matched} ${r.matched ? 'type=' + r.type : 'reason=' + r.reason}`)
  }
  if (matched === 0) {
    console.log('[FAIL] esperado al menos 1 match Purchase')
    return false
  }
  console.log(`[OK] ${matched}/${movements.length} matcheados con Purchase`)
  return true
}

async function testReconcile() {
  console.log('\n=== Test 5: reconcileWithEntry de movimiento misc ===')
  const movement = await prisma.bankMovement.findFirst({
    where: { companyId: COMPANY_ID, externalId: { startsWith: 'sim_mov_misc_' } },
  })
  if (!movement) {
    console.log('[FAIL] no hay movimiento misc para reconciliar')
    return false
  }

  // Necesitamos 2 cuentas activas: 1102 Bancos y 5220 Gastos diversos
  const bankAccount = await prisma.account.findFirst({
    where: { companyId: COMPANY_ID, code: '1102', isActive: true },
  })
  const expenseAccount = await prisma.account.findFirst({
    where: { companyId: COMPANY_ID, code: '5220', isActive: true },
  })
  if (!bankAccount || !expenseAccount) {
    console.log('[FAIL] cuentas 1102 o 5220 no existen, ¿corriste el seed PUC?')
    return false
  }

  // Para DEBIT (salida de dinero): D Gastos diversos / H Bancos
  // Para CREDIT (entrada): D Bancos / H Ingresos varios (4110)
  const debit = movement.type === 'DEBIT' ? expenseAccount.id : bankAccount.id
  const credit = movement.type === 'DEBIT' ? bankAccount.id : expenseAccount.id

  const entry = await reconcileWithEntry(movement.id, COMPANY_ID, debit, credit, 'Smoke test reconcile')

  const fullEntry = await prisma.journalEntry.findUnique({
    where: { id: entry.id },
    include: { lines: true },
  })
  if (!fullEntry || fullEntry.lines.length !== 2) {
    console.log(`[FAIL] asiento sin 2 líneas`)
    return false
  }
  const totalD = fullEntry.lines.reduce((s, l) => s + l.debit, 0)
  const totalH = fullEntry.lines.reduce((s, l) => s + l.credit, 0)
  if (totalD !== totalH || totalD !== movement.amount) {
    console.log(`[FAIL] asiento no cuadra: D=${totalD} H=${totalH} esperado=${movement.amount}`)
    return false
  }
  console.log(`[OK] Asiento bank creado, cuadra en $${movement.amount}`)

  const refreshed = await prisma.bankMovement.findUnique({ where: { id: movement.id } })
  if (refreshed?.status !== 'RECONCILED') {
    console.log(`[FAIL] movement.status esperado RECONCILED, obtuvo ${refreshed?.status}`)
    return false
  }
  console.log('[OK] BankMovement.status = RECONCILED')
  return true
}

async function main() {
  try {
    console.log('===== Smoke test: Conciliación Bancaria =====\n')
    await cleanup()
    await ensureMatchableData()
    const r1 = await testSyncAccounts()
    const r2 = await testSyncMovements()
    const r3 = await testMatchDte()
    const r4 = await testMatchPurchase()
    const r5 = await testReconcile()
    await cleanup()

    console.log('\n===== Resultado =====')
    console.log(`Test 1 (sync accounts):    ${r1 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 2 (sync movements):   ${r2 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 3 (match DTE):        ${r3 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 4 (match Purchase):   ${r4 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 5 (reconcile entry):  ${r5 ? 'PASS' : 'FAIL'}`)

    process.exit(r1 && r2 && r3 && r4 && r5 ? 0 : 1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
