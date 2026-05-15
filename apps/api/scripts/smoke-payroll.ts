/**
 * Smoke test for payroll module: employee + liquidación + asiento + PreviRed.
 *
 * Run: $env:DATABASE_URL="postgresql://contachile:contachile@localhost:5432/contachile"
 *      apps/api/node_modules/.bin/tsx.CMD apps/api/scripts/smoke-payroll.ts
 */

import { PrismaClient } from '../../../packages/db/generated/client'
import { calcularLiquidacion, UTM_DEFAULT } from '@contachile/validators'
import { generatePayrollForMonth } from '../src/lib/payroll-service'
import { createPayrollEntry } from '../src/lib/accounting-entries'
import { generatePreviRedFile, generateDdjj1887File } from '../src/lib/payroll-exports'

const prisma = new PrismaClient()
const COMPANY_ID = 'dev-test-company'

const logger = { warn: (data: object, msg: string) => console.log('[WARN]', msg, JSON.stringify(data)) }

async function ensureCompanyRut() {
  const c = await prisma.company.findUnique({ where: { id: COMPANY_ID } })
  return c?.rut || '11.111.111-1'
}

async function ensureEmployees() {
  const employees = [
    {
      rut: '11.111.111-1',
      name: 'Juan Pérez González',
      position: 'Desarrollador Junior',
      baseSalary: 1_000_000,
      afp: 'HABITAT' as const,
      contractType: 'INDEFINIDO' as const,
    },
    {
      rut: '22.222.222-2',
      name: 'María Soto Riquelme',
      position: 'Project Manager',
      baseSalary: 3_000_000,
      afp: 'CAPITAL' as const,
      contractType: 'INDEFINIDO' as const,
    },
  ]

  for (const e of employees) {
    const existing = await prisma.employee.findUnique({
      where: { companyId_rut: { companyId: COMPANY_ID, rut: e.rut } },
    })
    if (existing) {
      await prisma.employee.update({
        where: { id: existing.id },
        data: { isActive: true, baseSalary: e.baseSalary, afp: e.afp },
      })
      console.log(`[OK] Employee ${e.name} ya existía, actualizado`)
    } else {
      await prisma.employee.create({
        data: {
          companyId: COMPANY_ID,
          rut: e.rut,
          name: e.name,
          position: e.position,
          startDate: new Date('2025-01-01'),
          contractType: e.contractType,
          workHours: 45,
          baseSalary: e.baseSalary,
          afp: e.afp,
          healthPlan: 'FONASA',
        },
      })
      console.log(`[OK] Created employee ${e.name} ($${e.baseSalary.toLocaleString()})`)
    }
  }
}

async function testCalculationDirectly() {
  console.log('\n--- Test 1: cálculo directo con calcularLiquidacion ---')

  const small = calcularLiquidacion({
    baseSalary: 1_000_000,
    afp: 'HABITAT',
    healthPlan: 'FONASA',
    contractType: 'INDEFINIDO',
  })
  console.log(`Empleado $1M (HABITAT 11.27%, FONASA 7%, cesantía 0.6%):`)
  console.log(`  bruto=${small.bruto} afp=${small.afp} salud=${small.salud} cesantia=${small.cesantia}`)
  console.log(`  baseImponible=${small.baseImponible} impuesto=${small.impuesto} liquido=${small.liquido}`)

  // Verificar: AFP = 1M * 0.1127 = 112700
  if (small.afp !== 112700) { console.log(`[FAIL] AFP esperado 112700, obtuvo ${small.afp}`); return false }
  // Salud = 1M * 0.07 = 70000
  if (small.salud !== 70000) { console.log(`[FAIL] Salud esperado 70000, obtuvo ${small.salud}`); return false }
  // Cesantía = 1M * 0.006 = 6000
  if (small.cesantia !== 6000) { console.log(`[FAIL] Cesantía esperado 6000, obtuvo ${small.cesantia}`); return false }
  // Base = 1000000 - 112700 - 70000 - 6000 = 811300
  if (small.baseImponible !== 811300) { console.log(`[FAIL] Base esperado 811300, obtuvo ${small.baseImponible}`); return false }
  // Base / UTM = 811300 / 67000 = 12.10 < 13.5 → exento
  if (small.impuesto !== 0) { console.log(`[FAIL] Impuesto esperado 0 (exento), obtuvo ${small.impuesto}`); return false }
  // Liquido = bruto - afp - salud - cesantia = 811300
  if (small.liquido !== 811300) { console.log(`[FAIL] Liquido esperado 811300, obtuvo ${small.liquido}`); return false }
  console.log('[OK] Cálculo $1M correcto: líquido $811.300, sin impuesto')

  const big = calcularLiquidacion({
    baseSalary: 3_000_000,
    afp: 'CAPITAL',
    healthPlan: 'FONASA',
    contractType: 'INDEFINIDO',
  })
  console.log(`\nEmpleado $3M (CAPITAL 11.44%, FONASA 7%):`)
  console.log(`  bruto=${big.bruto} afp=${big.afp} salud=${big.salud} cesantia=${big.cesantia}`)
  console.log(`  baseImponible=${big.baseImponible} impuesto=${big.impuesto} liquido=${big.liquido}`)

  // AFP = 3M * 0.1144 = 343200
  if (big.afp !== 343200) { console.log(`[FAIL] AFP esperado 343200, obtuvo ${big.afp}`); return false }
  // Base imponible = 3000000 - 343200 - 210000 - 18000 = 2428800
  if (big.baseImponible !== 2428800) { console.log(`[FAIL] Base esperado 2428800, obtuvo ${big.baseImponible}`); return false }

  // Base / UTM = 2428800 / 67000 = 36.25 UTM
  // Bracket 30-50 UTM: tasa 0.08, rebaja 1.74
  // tax UTM = 36.25*0.08 - 1.74 = 2.9 - 1.74 = 1.16
  // tax CLP ≈ 1.16 * 67000 ≈ 77720
  if (big.impuesto < 75000 || big.impuesto > 80000) {
    console.log(`[FAIL] Impuesto fuera de rango esperado [75k, 80k]: ${big.impuesto}`)
    return false
  }
  console.log(`[OK] Impuesto $3M = ${big.impuesto} (esperado ~77.720 con UTM ${UTM_DEFAULT})`)
  return true
}

async function testGenerateForMonth() {
  console.log('\n--- Test 2: generatePayrollForMonth ---')
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  // Limpiar liquidaciones previas para empezar limpio
  await prisma.payroll.deleteMany({
    where: { companyId: COMPANY_ID, year, month },
  })

  const result = await generatePayrollForMonth(COMPANY_ID, year, month)
  console.log(`Generated: ${result.generated}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`)

  if (result.generated !== 2) {
    console.log(`[FAIL] Esperado 2 generados, obtuvo ${result.generated}`)
    return false
  }
  if (result.errors.length > 0) {
    console.log(`[FAIL] Errores: ${JSON.stringify(result.errors)}`)
    return false
  }

  const payrolls = await prisma.payroll.findMany({
    where: { companyId: COMPANY_ID, year, month },
    include: { employee: { select: { name: true } } },
  })
  for (const p of payrolls) {
    console.log(`  ${p.employee.name}: bruto=${p.bruto} liquido=${p.liquido}`)
  }
  return true
}

async function testApprovalEntry() {
  console.log('\n--- Test 3: aprobar liquidación → asiento contable ---')
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const payroll = await prisma.payroll.findFirst({
    where: { companyId: COMPANY_ID, year, month, status: 'DRAFT' },
  })
  if (!payroll) {
    console.log('[FAIL] no hay liquidación DRAFT para aprobar')
    return false
  }

  const before = await prisma.journalEntry.count({
    where: { companyId: COMPANY_ID, source: 'payroll' },
  })

  const updated = await prisma.payroll.update({
    where: { id: payroll.id },
    data: { status: 'APPROVED', approvedAt: new Date() },
  })

  const entry = await createPayrollEntry(updated, logger)
  if (!entry) {
    console.log('[FAIL] createPayrollEntry returned null')
    return false
  }

  const after = await prisma.journalEntry.count({
    where: { companyId: COMPANY_ID, source: 'payroll' },
  })
  if (after !== before + 1) {
    console.log(`[FAIL] entries antes ${before}, después ${after}`)
    return false
  }

  const lines = await prisma.journalLine.findMany({
    where: { journalEntryId: entry.id },
    include: { account: { select: { code: true } } },
    orderBy: { account: { code: 'asc' } },
  })
  const codes = lines.map((l) => l.account.code).sort()
  const expected = ['2110', '2115', '5100'].sort()
  if (JSON.stringify(codes) !== JSON.stringify(expected)) {
    console.log(`[FAIL] cuentas inesperadas: ${codes.join(',')} (esperado ${expected.join(',')})`)
    return false
  }

  const totalDebit = lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = lines.reduce((s, l) => s + l.credit, 0)
  if (totalDebit !== totalCredit) {
    console.log(`[FAIL] asiento no cuadra: debit=${totalDebit} credit=${totalCredit}`)
    return false
  }
  console.log(`[OK] Asiento creado: 3 líneas (5100/2115/2110), cuadra en ${totalDebit}`)
  return true
}

async function testPreviRedExport() {
  console.log('\n--- Test 4: PreviRed export format ---')
  const now = new Date()
  const year = now.getFullYear()
  const month = now.getMonth() + 1

  const payrolls = await prisma.payroll.findMany({
    where: { companyId: COMPANY_ID, year, month },
    include: { employee: true },
  })

  const companyRut = await ensureCompanyRut()
  const content = generatePreviRedFile(
    companyRut,
    year,
    month,
    payrolls.map((p) => ({
      payroll: { bruto: p.bruto, afp: p.afp, salud: p.salud, cesantia: p.cesantia },
      employee: {
        rut: p.employee.rut,
        name: p.employee.name,
        afp: p.employee.afp,
        healthPlan: p.employee.healthPlan,
      },
    }))
  )

  console.log('Archivo generado:')
  console.log(content)

  const lines = content.split('\n')
  if (lines.length !== payrolls.length + 1) {
    console.log(`[FAIL] esperado ${payrolls.length + 1} líneas, obtuvo ${lines.length}`)
    return false
  }
  if (!lines[0].startsWith('rut;dv;nombres')) {
    console.log('[FAIL] header inesperado')
    return false
  }
  for (let i = 1; i < lines.length; i++) {
    const fields = lines[i].split(';')
    if (fields.length !== 14) {
      console.log(`[FAIL] línea ${i} tiene ${fields.length} campos, esperado 14`)
      return false
    }
  }
  console.log(`[OK] PreviRed format: ${lines.length - 1} workers, 14 columns each`)
  return true
}

async function testDdjjExport() {
  console.log('\n--- Test 5: DDJJ 1887 export ---')
  const now = new Date()
  const year = now.getFullYear()

  const payrolls = await prisma.payroll.findMany({
    where: { companyId: COMPANY_ID, year, status: { in: ['APPROVED', 'PAID'] } },
    include: { employee: true },
  })
  console.log(`Liquidaciones aprobadas en ${year}: ${payrolls.length}`)

  const byEmp = new Map<string, { rut: string; name: string; totalAnual: number; retenciones: number }>()
  for (const p of payrolls) {
    const cur = byEmp.get(p.employee.id) ?? {
      rut: p.employee.rut,
      name: p.employee.name,
      totalAnual: 0,
      retenciones: 0,
    }
    cur.totalAnual += p.bruto
    cur.retenciones += p.impuesto
    byEmp.set(p.employee.id, cur)
  }

  const content = generateDdjj1887File(year, Array.from(byEmp.values()))
  console.log(content)

  if (!content.startsWith('rut;nombre;ano;totalAnual;retenciones')) {
    console.log('[FAIL] header inesperado')
    return false
  }
  console.log(`[OK] DDJJ 1887 con ${byEmp.size} trabajadores`)
  return true
}

async function main() {
  try {
    console.log('===== Smoke test: Remuneraciones =====\n')
    await ensureEmployees()
    const r1 = await testCalculationDirectly()
    const r2 = await testGenerateForMonth()
    const r3 = await testApprovalEntry()
    const r4 = await testPreviRedExport()
    const r5 = await testDdjjExport()

    console.log('\n===== Resultado =====')
    console.log(`Test 1 (cálculo directo):      ${r1 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 2 (generate mes):         ${r2 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 3 (aprobar + asiento):    ${r3 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 4 (PreviRed export):      ${r4 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 5 (DDJJ 1887 export):     ${r5 ? 'PASS' : 'FAIL'}`)

    process.exit(r1 && r2 && r3 && r4 && r5 ? 0 : 1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
