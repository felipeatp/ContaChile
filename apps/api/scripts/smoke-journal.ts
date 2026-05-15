/**
 * Smoke test for journal entries: creates an isolated dev-test-company,
 * seeds the PUC, simulates a DTE emission, and verifies the JournalEntry
 * was created with the correct 3 lines.
 *
 * Run with: pnpm --filter @contachile/db exec tsx ../../apps/api/scripts/smoke-journal.ts
 * Or:       DATABASE_URL=... node --import tsx apps/api/scripts/smoke-journal.ts
 */

import { PrismaClient } from '../../../packages/db/generated/client'
import { PUC_BASE_ACCOUNTS } from '@contachile/validators'
import {
  createSalesEntry,
  createPurchaseEntry,
} from '../src/lib/accounting-entries'

const prisma = new PrismaClient()

const COMPANY_ID = 'dev-test-company'
const COMPANY_RUT = '11.111.111-1'

const logger = {
  warn: (data: object, msg: string) =>
    console.log('[WARN]', msg, JSON.stringify(data)),
}

async function ensureCompany() {
  const existing = await prisma.company.findUnique({ where: { id: COMPANY_ID } })
  if (existing) {
    console.log(`[OK] Company ${COMPANY_ID} already exists (RUT ${existing.rut})`)
    return existing
  }
  const created = await prisma.company.create({
    data: {
      id: COMPANY_ID,
      rut: COMPANY_RUT,
      name: 'Test Co — Smoke Journal',
      giro: 'Servicios de prueba',
    },
  })
  console.log(`[OK] Created company ${COMPANY_ID}`)
  return created
}

async function ensurePuc() {
  const count = await prisma.account.count({ where: { companyId: COMPANY_ID } })
  if (count > 0) {
    console.log(`[OK] PUC already seeded (${count} accounts)`)
    return
  }
  await prisma.account.createMany({
    data: PUC_BASE_ACCOUNTS.map((a) => ({
      companyId: COMPANY_ID,
      code: a.code,
      name: a.name,
      type: a.type,
      description: a.description,
      isSystem: true,
    })),
    skipDuplicates: true,
  })
  console.log(`[OK] Seeded PUC (${PUC_BASE_ACCOUNTS.length} accounts)`)
}

async function testSalesEntry() {
  console.log('\n--- Test 1: createSalesEntry from DTE emission ---')
  const before = await prisma.journalEntry.count({
    where: { companyId: COMPANY_ID, source: 'dte' },
  })

  const fakeDoc = {
    id: `test-doc-${Date.now()}`,
    companyId: COMPANY_ID,
    folio: 9001,
    type: 33,
    totalNet: 100000,
    totalTax: 19000,
    totalAmount: 119000,
    emittedAt: new Date(),
    receiverName: 'Cliente Test SpA',
  }

  const entry = await createSalesEntry(fakeDoc, logger)
  if (!entry) {
    console.log('[FAIL] createSalesEntry returned null')
    return false
  }

  const fullEntry = await prisma.journalEntry.findUnique({
    where: { id: entry.id },
    include: { lines: { include: { account: { select: { code: true, name: true } } } } },
  })
  if (!fullEntry) {
    console.log('[FAIL] JournalEntry not found after create')
    return false
  }

  console.log(`[OK] Entry id=${fullEntry.id} description="${fullEntry.description}"`)
  for (const l of fullEntry.lines) {
    console.log(
      `     ${l.account.code} ${l.account.name.padEnd(30)} debit=${l.debit.toString().padStart(8)} credit=${l.credit.toString().padStart(8)}`
    )
  }

  const totalDebit = fullEntry.lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = fullEntry.lines.reduce((s, l) => s + l.credit, 0)
  if (totalDebit !== totalCredit) {
    console.log(`[FAIL] Entry no cuadra: debe=${totalDebit} haber=${totalCredit}`)
    return false
  }
  console.log(`[OK] Cuadra: debe=haber=${totalDebit}`)

  const codes = fullEntry.lines.map((l) => l.account.code).sort()
  const expected = ['1103', '2111', '4100'].sort()
  if (JSON.stringify(codes) !== JSON.stringify(expected)) {
    console.log(`[FAIL] Cuentas inesperadas: ${codes.join(',')} vs ${expected.join(',')}`)
    return false
  }
  console.log(`[OK] Cuentas correctas: ${codes.join(',')}`)

  const after = await prisma.journalEntry.count({
    where: { companyId: COMPANY_ID, source: 'dte' },
  })
  if (after !== before + 1) {
    console.log(`[FAIL] Conteo incorrecto: antes=${before} despues=${after}`)
    return false
  }
  console.log(`[OK] Conteo: ${before} -> ${after}`)
  return true
}

async function testPurchaseEntry() {
  console.log('\n--- Test 2: createPurchaseEntry with category=arriendo ---')
  const before = await prisma.journalEntry.count({
    where: { companyId: COMPANY_ID, source: 'purchase' },
  })

  const fakePurchase = {
    id: `test-purchase-${Date.now()}`,
    companyId: COMPANY_ID,
    type: 33,
    folio: 7001,
    date: new Date(),
    netAmount: 50000,
    taxAmount: 9500,
    totalAmount: 59500,
    category: 'arriendo',
    issuerName: 'Proveedor Test Ltda',
  }

  const entry = await createPurchaseEntry(fakePurchase, logger)
  if (!entry) {
    console.log('[FAIL] createPurchaseEntry returned null')
    return false
  }

  const fullEntry = await prisma.journalEntry.findUnique({
    where: { id: entry.id },
    include: { lines: { include: { account: { select: { code: true, name: true } } } } },
  })
  if (!fullEntry) return false

  console.log(`[OK] Entry id=${fullEntry.id} description="${fullEntry.description}"`)
  for (const l of fullEntry.lines) {
    console.log(
      `     ${l.account.code} ${l.account.name.padEnd(30)} debit=${l.debit.toString().padStart(8)} credit=${l.credit.toString().padStart(8)}`
    )
  }

  const codes = fullEntry.lines.map((l) => l.account.code).sort()
  const expected = ['1115', '2101', '5110'].sort()
  if (JSON.stringify(codes) !== JSON.stringify(expected)) {
    console.log(`[FAIL] Cuentas inesperadas: ${codes.join(',')} vs ${expected.join(',')}`)
    return false
  }
  console.log(`[OK] Cuentas correctas (arriendo mapeado a 5110): ${codes.join(',')}`)

  const after = await prisma.journalEntry.count({
    where: { companyId: COMPANY_ID, source: 'purchase' },
  })
  if (after !== before + 1) return false
  console.log(`[OK] Conteo: ${before} -> ${after}`)
  return true
}

async function testFallbackCategory() {
  console.log('\n--- Test 3: createPurchaseEntry with unknown category (fallback to 5220) ---')

  const fakePurchase = {
    id: `test-purchase-fallback-${Date.now()}`,
    companyId: COMPANY_ID,
    type: 33,
    folio: 7002,
    date: new Date(),
    netAmount: 30000,
    taxAmount: 5700,
    totalAmount: 35700,
    category: 'categoria_que_no_existe',
    issuerName: 'Otro Proveedor',
  }

  const entry = await createPurchaseEntry(fakePurchase, logger)
  if (!entry) {
    console.log('[FAIL] returned null')
    return false
  }

  const fullEntry = await prisma.journalEntry.findUnique({
    where: { id: entry.id },
    include: { lines: { include: { account: { select: { code: true } } } } },
  })
  if (!fullEntry) return false

  const codes = fullEntry.lines.map((l) => l.account.code).sort()
  const expected = ['1115', '2101', '5220'].sort()
  if (JSON.stringify(codes) !== JSON.stringify(expected)) {
    console.log(`[FAIL] Esperado 5220 (Gastos diversos) pero obtuvo: ${codes.join(',')}`)
    return false
  }
  console.log(`[OK] Fallback a 5220 funcionó`)
  return true
}

async function testMissingPucGracefully() {
  console.log('\n--- Test 4: createSalesEntry con companyId inexistente (fallback silencioso) ---')

  const fakeDoc = {
    id: 'no-existe-doc',
    companyId: 'company-que-no-existe-en-db',
    folio: 1,
    type: 33,
    totalNet: 1000,
    totalTax: 190,
    totalAmount: 1190,
    emittedAt: new Date(),
    receiverName: 'X',
  }

  const entry = await createSalesEntry(fakeDoc, logger)
  if (entry !== null) {
    console.log(`[FAIL] esperado null, obtuvo ${entry?.id}`)
    return false
  }
  console.log(`[OK] Retornó null sin lanzar excepción (fallback funcionando)`)
  return true
}

async function listRecentEntries() {
  console.log('\n--- Resumen: últimos 5 asientos del company de prueba ---')
  const entries = await prisma.journalEntry.findMany({
    where: { companyId: COMPANY_ID },
    orderBy: { createdAt: 'desc' },
    take: 5,
    include: { lines: { include: { account: { select: { code: true } } } } },
  })
  for (const e of entries) {
    const total = e.lines.reduce((s, l) => s + l.debit, 0)
    console.log(
      `  ${e.createdAt.toISOString().slice(11, 19)} ${e.source.padEnd(8)} ${e.reference?.padEnd(8) ?? '—       '} ${e.description.slice(0, 50).padEnd(50)} $${total}`
    )
  }
}

async function main() {
  try {
    console.log('===== Smoke test: Journal entries =====\n')
    await ensureCompany()
    await ensurePuc()

    const r1 = await testSalesEntry()
    const r2 = await testPurchaseEntry()
    const r3 = await testFallbackCategory()
    const r4 = await testMissingPucGracefully()

    await listRecentEntries()

    console.log('\n===== Resultado =====')
    console.log(`Test 1 (sales entry):           ${r1 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 2 (purchase + arriendo):   ${r2 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 3 (fallback category):     ${r3 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 4 (missing PUC graceful):  ${r4 ? 'PASS' : 'FAIL'}`)

    const allPass = r1 && r2 && r3 && r4
    process.exit(allPass ? 0 : 1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
