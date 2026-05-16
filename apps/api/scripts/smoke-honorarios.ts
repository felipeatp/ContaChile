/**
 * Smoke test for honorarios: cálculo retención + asiento auto + filtros.
 *
 * Run: $env:DATABASE_URL="postgresql://contachile:contachile@localhost:5432/contachile"
 *      apps/api/node_modules/.bin/tsx.CMD apps/api/scripts/smoke-honorarios.ts
 */

import { PrismaClient } from '../../../packages/db/generated/client'
import { calcularRetencionHonorarios } from '@contachile/validators'
import { createHonorarioEntry } from '../src/lib/accounting-entries'

const prisma = new PrismaClient()
const COMPANY_ID = 'dev-test-company'

const logger = { warn: (data: object, msg: string) => console.log('[WARN]', msg, JSON.stringify(data)) }

async function cleanup() {
  await prisma.honorario.deleteMany({ where: { companyId: COMPANY_ID, number: { in: [9001, 9002, 9003] } } })
  await prisma.journalEntry.deleteMany({
    where: { companyId: COMPANY_ID, source: 'honorario', reference: { in: ['BHE-9002', 'BHE-9003'] } },
  })
}

function testRetentionCalc() {
  console.log('=== Test 1: cálculo retención ===')
  const r1 = calcularRetencionHonorarios(1_000_000)
  console.log(`Bruto $1M: retención=${r1.retention} líquido=${r1.net}`)
  if (r1.retention !== 137500 || r1.net !== 862500) {
    console.log(`[FAIL] esperado retención 137500, líquido 862500`)
    return false
  }
  console.log('[OK] $1M bruto → retención $137.500, líquido $862.500')

  const r2 = calcularRetencionHonorarios(500_000)
  console.log(`Bruto $500K: retención=${r2.retention} líquido=${r2.net}`)
  if (r2.retention !== 68750 || r2.net !== 431250) {
    console.log(`[FAIL] esperado retención 68750, líquido 431250`)
    return false
  }
  console.log('[OK] $500K bruto → retención $68.750, líquido $431.250')

  // Test con tasa custom (histórica 2024 = 13%)
  const r3 = calcularRetencionHonorarios(1_000_000, 0.13)
  if (r3.retention !== 130000) {
    console.log(`[FAIL] esperado retención 130000 con tasa 13%, obtuvo ${r3.retention}`)
    return false
  }
  console.log('[OK] tasa custom 13% funciona')
  return true
}

async function testCreateIssued() {
  console.log('\n=== Test 2: crear BHE ISSUED $1M ===')
  const calc = calcularRetencionHonorarios(1_000_000)
  const h = await prisma.honorario.create({
    data: {
      companyId: COMPANY_ID,
      type: 'ISSUED',
      number: 9001,
      date: new Date('2026-05-15'),
      counterpartRut: '76.111.222-3',
      counterpartName: 'Cliente Test SpA',
      grossAmount: calc.gross,
      retentionRate: calc.rate,
      retentionAmount: calc.retention,
      netAmount: calc.net,
    },
  })
  console.log(`Creada BHE ISSUED #${h.number}: bruto=${h.grossAmount}, retención=${h.retentionAmount}, líquido=${h.netAmount}`)

  // ISSUED no debería crear asiento
  const entries = await prisma.journalEntry.count({
    where: { companyId: COMPANY_ID, source: 'honorario', sourceId: h.id },
  })
  if (entries !== 0) {
    console.log(`[FAIL] BHE ISSUED no debería crear asiento, encontró ${entries}`)
    return false
  }
  console.log('[OK] ISSUED no genera asiento (esperado)')
  return true
}

async function testCreateReceivedWithEntry() {
  console.log('\n=== Test 3: crear BHE RECEIVED $500K + asiento ===')
  const calc = calcularRetencionHonorarios(500_000)
  const h = await prisma.honorario.create({
    data: {
      companyId: COMPANY_ID,
      type: 'RECEIVED',
      number: 9002,
      date: new Date('2026-05-15'),
      counterpartRut: '14.555.666-7',
      counterpartName: 'Ana Profesional González',
      grossAmount: calc.gross,
      retentionRate: calc.rate,
      retentionAmount: calc.retention,
      netAmount: calc.net,
    },
  })

  const entry = await createHonorarioEntry(h, logger)
  if (!entry) {
    console.log('[FAIL] createHonorarioEntry retornó null')
    return false
  }

  const fullEntry = await prisma.journalEntry.findUnique({
    where: { id: entry.id },
    include: { lines: { include: { account: { select: { code: true, name: true } } } } },
  })
  if (!fullEntry) return false

  console.log(`Asiento creado: ${fullEntry.description}`)
  for (const l of fullEntry.lines) {
    console.log(`  ${l.account.code} ${l.account.name.padEnd(28)} D=${l.debit.toString().padStart(8)} H=${l.credit.toString().padStart(8)}`)
  }

  const codes = fullEntry.lines.map((l) => l.account.code).sort()
  const expected = ['2101', '2110', '5101'].sort()
  if (JSON.stringify(codes) !== JSON.stringify(expected)) {
    console.log(`[FAIL] cuentas inesperadas: ${codes.join(',')}, esperado ${expected.join(',')}`)
    return false
  }

  const totalD = fullEntry.lines.reduce((s, l) => s + l.debit, 0)
  const totalH = fullEntry.lines.reduce((s, l) => s + l.credit, 0)
  if (totalD !== totalH || totalD !== 500_000) {
    console.log(`[FAIL] asiento no cuadra: D=${totalD} H=${totalH}`)
    return false
  }
  console.log(`[OK] Asiento 5101/2110/2101 cuadra en $500.000`)
  return true
}

async function testFilters() {
  console.log('\n=== Test 4: filtros ===')

  // Crear una RECEIVED extra de junio
  const calc = calcularRetencionHonorarios(200_000)
  await prisma.honorario.create({
    data: {
      companyId: COMPANY_ID,
      type: 'RECEIVED',
      number: 9003,
      date: new Date('2026-06-10'),
      counterpartRut: '15.555.666-7',
      counterpartName: 'Otro Profesional',
      grossAmount: calc.gross,
      retentionRate: calc.rate,
      retentionAmount: calc.retention,
      netAmount: calc.net,
    },
  })

  // Filtrar mayo
  const may = await prisma.honorario.findMany({
    where: {
      companyId: COMPANY_ID,
      date: { gte: new Date(2026, 4, 1), lt: new Date(2026, 5, 1) },
      number: { in: [9001, 9002, 9003] },
    },
  })
  console.log(`Boletas en mayo 2026: ${may.length} (esperadas 2: 9001 ISSUED + 9002 RECEIVED)`)
  if (may.length !== 2) {
    console.log(`[FAIL] esperado 2 boletas en mayo, encontró ${may.length}`)
    return false
  }

  // Filtrar solo RECEIVED del año
  const received = await prisma.honorario.findMany({
    where: { companyId: COMPANY_ID, type: 'RECEIVED', number: { in: [9001, 9002, 9003] } },
  })
  console.log(`Boletas RECEIVED 2026: ${received.length} (esperadas 2: 9002 + 9003)`)
  if (received.length !== 2) {
    console.log(`[FAIL] esperado 2 RECEIVED, encontró ${received.length}`)
    return false
  }
  console.log('[OK] Filtros funcionan correctamente')
  return true
}

async function main() {
  try {
    console.log('===== Smoke test: Honorarios =====\n')
    await cleanup()
    const r1 = testRetentionCalc()
    const r2 = await testCreateIssued()
    const r3 = await testCreateReceivedWithEntry()
    const r4 = await testFilters()
    await cleanup()

    console.log('\n===== Resultado =====')
    console.log(`Test 1 (cálculo retención):       ${r1 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 2 (BHE ISSUED $1M):          ${r2 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 3 (BHE RECEIVED + asiento):  ${r3 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 4 (filtros):                 ${r4 ? 'PASS' : 'FAIL'}`)

    process.exit(r1 && r2 && r3 && r4 ? 0 : 1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
