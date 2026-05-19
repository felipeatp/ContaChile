/**
 * Smoke test for honorarios: creates a received BHE, verifies retention
 * calculation and automatic accounting entry.
 *
 * Run with: DATABASE_URL=... npx tsx apps/api/scripts/smoke-honorarios.ts
 */

import { PrismaClient } from '../../../packages/db/generated/client'

const prisma = new PrismaClient()

const COMPANY_ID = 'dev-test-company'

async function ensureCompany() {
  const existing = await prisma.company.findUnique({ where: { id: COMPANY_ID } })
  if (existing) {
    console.log(`[OK] Company ${COMPANY_ID} already exists`)
    return existing
  }
  const created = await prisma.company.create({
    data: { id: COMPANY_ID, rut: '11.111.111-1', name: 'Test Co — Smoke Honorarios', giro: 'Servicios' },
  })
  console.log(`[OK] Created company ${COMPANY_ID}`)
  return created
}

async function cleanup() {
  const existing = await prisma.honorario.findFirst({
    where: { companyId: COMPANY_ID, number: 9999 },
  })
  if (existing) {
    await prisma.journalLine.deleteMany({ where: { journalEntry: { sourceId: existing.id } } })
    await prisma.journalEntry.deleteMany({ where: { sourceId: existing.id } })
    await prisma.honorario.delete({ where: { id: existing.id } })
    console.log(`[OK] Cleaned up previous honorario`)
  }
}

async function testCreateHonorarioReceived() {
  console.log('\n--- Test 1: Create RECEIVED honorario ---')

  const { calcularRetencionHonorarios } = await import('../../../packages/validators/src/honorarios')
  const calc = calcularRetencionHonorarios(1_000_000)

  const honorario = await prisma.honorario.create({
    data: {
      companyId: COMPANY_ID,
      type: 'RECEIVED',
      number: 9999,
      date: new Date('2026-05-15'),
      counterpartRut: '12.345.678-9',
      counterpartName: 'Consultor Test',
      description: 'Servicios profesionales',
      grossAmount: calc.gross,
      retentionRate: calc.rate,
      retentionAmount: calc.retention,
      netAmount: calc.net,
    },
  })

  console.log(`[OK] Created honorario id=${honorario.id}`)
  console.log(`     Gross:      $${honorario.grossAmount.toLocaleString('es-CL')}`)
  console.log(`     Retention:  $${honorario.retentionAmount.toLocaleString('es-CL')} (${(honorario.retentionRate * 100).toFixed(2)}%)`)
  console.log(`     Net:        $${honorario.netAmount.toLocaleString('es-CL')}`)

  // Validations
  const expectedRetention = Math.round(1_000_000 * 0.1375)
  const expectedNet = 1_000_000 - expectedRetention

  let pass = true
  if (honorario.retentionAmount !== expectedRetention) {
    console.log(`[FAIL] Retention expected $${expectedRetention}, got $${honorario.retentionAmount}`)
    pass = false
  }
  if (honorario.netAmount !== expectedNet) {
    console.log(`[FAIL] Net expected $${expectedNet}, got $${honorario.netAmount}`)
    pass = false
  }
  if (honorario.type !== 'RECEIVED') {
    console.log(`[FAIL] Type expected RECEIVED, got ${honorario.type}`)
    pass = false
  }

  if (pass) console.log('[OK] All calculations correct')
  return pass ? honorario : null
}

async function testAccountingEntry(honorarioId: string) {
  console.log('\n--- Test 2: Verify automatic accounting entry ---')

  const { createHonorarioEntry } = await import('../src/lib/accounting-entries')
  const honorario = await prisma.honorario.findFirst({
    where: { id: honorarioId, companyId: COMPANY_ID },
  })
  if (!honorario) {
    console.log('[FAIL] Honorario not found')
    return false
  }

  const before = await prisma.journalEntry.count({
    where: { companyId: COMPANY_ID, source: 'honorario' },
  })

  await createHonorarioEntry(honorario)

  const after = await prisma.journalEntry.count({
    where: { companyId: COMPANY_ID, source: 'honorario' },
  })

  if (after !== before + 1) {
    console.log(`[FAIL] Expected ${before + 1} honorario entries, got ${after}`)
    return false
  }

  const entry = await prisma.journalEntry.findFirst({
    where: { companyId: COMPANY_ID, source: 'honorario' },
    orderBy: { createdAt: 'desc' },
    include: { lines: { include: { account: { select: { code: true, name: true } } } } },
  })

  console.log(`[OK] Accounting entry created: ${entry?.id}`)
  for (const l of entry?.lines || []) {
    console.log(`     ${l.account.code} ${l.account.name.padEnd(30)} debit=${l.debit.toString().padStart(8)} credit=${l.credit.toString().padStart(8)}`)
  }

  // Verify amounts
  const totalDebit = entry?.lines.reduce((s, l) => s + l.debit, 0) || 0
  const totalCredit = entry?.lines.reduce((s, l) => s + l.credit, 0) || 0
  if (totalDebit !== totalCredit) {
    console.log(`[FAIL] Entry does not balance: debit=${totalDebit} credit=${totalCredit}`)
    return false
  }

  return true
}

async function testListHonorarios() {
  console.log('\n--- Test 3: List honorarios ---')

  const result = await prisma.honorario.findMany({
    where: { companyId: COMPANY_ID },
    orderBy: { date: 'desc' },
  })

  const received = result.filter((h) => h.type === 'RECEIVED')
  const issued = result.filter((h) => h.type === 'ISSUED')

  console.log(`[OK] Found ${result.length} honorarios (${received.length} received, ${issued.length} issued)`)
  return result.length > 0
}

async function main() {
  try {
    console.log('===== Smoke test: Honorarios =====\n')
    await ensureCompany()
    await cleanup()

    const honorario = await testCreateHonorarioReceived()
    const r2 = honorario ? await testAccountingEntry(honorario.id) : false
    const r3 = await testListHonorarios()

    console.log('\n===== Resultado =====')
    console.log(`Test 1 (create + calculations): ${honorario ? 'PASS' : 'FAIL'}`)
    console.log(`Test 2 (accounting entry):      ${r2 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 3 (list):                  ${r3 ? 'PASS' : 'FAIL'}`)

    const allPass = honorario && r2 && r3
    process.exit(allPass ? 0 : 1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
