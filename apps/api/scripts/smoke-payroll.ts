/**
 * Smoke test for payroll: creates a test employee, generates payroll,
 * approves it, verifies PDF and PreviRed export.
 *
 * Run with: DATABASE_URL=... npx tsx apps/api/scripts/smoke-payroll.ts
 */

import { PrismaClient } from '../../../packages/db/generated/client'

const prisma = new PrismaClient()

const COMPANY_ID = 'dev-test-company'
const COMPANY_RUT = '11.111.111-1'

async function ensureCompany() {
  const existing = await prisma.company.findUnique({ where: { id: COMPANY_ID } })
  if (existing) {
    console.log(`[OK] Company ${COMPANY_ID} already exists`)
    return existing
  }
  const created = await prisma.company.create({
    data: { id: COMPANY_ID, rut: COMPANY_RUT, name: 'Test Co — Smoke Payroll', giro: 'Servicios' },
  })
  console.log(`[OK] Created company ${COMPANY_ID}`)
  return created
}

async function cleanupEmployee(rut: string) {
  const existing = await prisma.employee.findUnique({
    where: { companyId_rut: { companyId: COMPANY_ID, rut } },
  })
  if (existing) {
    await prisma.payroll.deleteMany({ where: { employeeId: existing.id } })
    await prisma.employee.delete({ where: { id: existing.id } })
    console.log(`[OK] Cleaned up previous employee ${rut}`)
  }
}

async function createTestEmployee() {
  const rut = '12.345.678-9'
  await cleanupEmployee(rut)

  const employee = await prisma.employee.create({
    data: {
      companyId: COMPANY_ID,
      rut,
      name: 'Juan Pérez González',
      email: 'juan@test.cl',
      position: 'Desarrollador',
      startDate: new Date('2024-01-01'),
      contractType: 'INDEFINIDO',
      workHours: 45,
      baseSalary: 1_500_000,
      afp: 'HABITAT',
      healthPlan: 'FONASA',
    },
  })
  console.log(`[OK] Created employee: ${employee.name} (${employee.rut}) — salary $${employee.baseSalary.toLocaleString('es-CL')}`)
  return employee
}

async function testGeneratePayroll(employeeId: string) {
  const today = new Date()
  const year = today.getFullYear()
  const month = today.getMonth() + 1

  console.log(`\n--- Test 1: Generate payroll for ${year}-${String(month).padStart(2, '0')} ---`)

  // Llamar al servicio directamente
  const { generatePayrollForMonth } = await import('../src/lib/payroll-service')
  const result = await generatePayrollForMonth(COMPANY_ID, year, month)
  console.log(`[OK] Generated: ${result.generated}, Skipped: ${result.skipped}, Errors: ${result.errors.length}`)

  if (result.generated !== 1) {
    console.log('[FAIL] Expected 1 payroll generated')
    return null
  }

  const payrolls = await prisma.payroll.findMany({
    where: { companyId: COMPANY_ID, year, month },
    include: { employee: true },
  })

  const p = payrolls[0]
  console.log(`[OK] Payroll id=${p.id}`)
  console.log(`     Bruto:    $${p.bruto.toLocaleString('es-CL')}`)
  console.log(`     AFP:      $${p.afp.toLocaleString('es-CL')}`)
  console.log(`     Salud:    $${p.salud.toLocaleString('es-CL')}`)
  console.log(`     Cesantía: $${p.cesantia.toLocaleString('es-CL')}`)
  console.log(`     Impuesto: $${p.impuesto.toLocaleString('es-CL')}`)
  console.log(`     Líquido:  $${p.liquido.toLocaleString('es-CL')}`)

  // Validaciones matemáticas
  const expectedAfp = Math.round(1_500_000 * 0.1127) // HABITAT rate
  const expectedSalud = Math.round(1_500_000 * 0.07) // FONASA
  const expectedCesantia = Math.round(1_500_000 * 0.006) // INDEFINIDO
  const baseImponible = 1_500_000 - expectedAfp - expectedSalud - expectedCesantia

  console.log(`\n--- Validations ---`)
  const checks = [
    { label: 'AFP (Habitat 11.27%)', actual: p.afp, expected: expectedAfp },
    { label: 'Salud (FONASA 7%)', actual: p.salud, expected: expectedSalud },
    { label: 'Cesantía (0.6%)', actual: p.cesantia, expected: expectedCesantia },
    { label: 'Base imponible', actual: p.baseImponible, expected: baseImponible },
    { label: 'Líquido = bruto - descuentos', actual: p.liquido, expected: p.bruto - p.afp - p.salud - p.cesantia - p.impuesto - p.otrosDesc },
  ]

  let allPass = true
  for (const c of checks) {
    const pass = c.actual === c.expected
    console.log(`[${pass ? 'OK' : 'FAIL'}] ${c.label}: $${c.actual.toLocaleString('es-CL')} (expected $${c.expected.toLocaleString('es-CL')})`)
    if (!pass) allPass = false
  }

  if (!allPass) return null
  return p
}

async function testApproveAndEntry(payrollId: string) {
  console.log(`\n--- Test 2: Approve payroll and verify accounting entry ---`)

  const before = await prisma.journalEntry.count({
    where: { companyId: COMPANY_ID, source: 'payroll' },
  })

  const { createPayrollEntry } = await import('../src/lib/accounting-entries')
  const payroll = await prisma.payroll.findFirst({
    where: { id: payrollId, companyId: COMPANY_ID },
    include: { employee: true },
  })
  if (!payroll) {
    console.log('[FAIL] Payroll not found')
    return false
  }

  await createPayrollEntry(payroll)

  const after = await prisma.journalEntry.count({
    where: { companyId: COMPANY_ID, source: 'payroll' },
  })

  if (after !== before + 1) {
    console.log(`[FAIL] Expected ${before + 1} payroll entries, got ${after}`)
    return false
  }

  const entry = await prisma.journalEntry.findFirst({
    where: { companyId: COMPANY_ID, source: 'payroll' },
    orderBy: { createdAt: 'desc' },
    include: { lines: { include: { account: { select: { code: true, name: true } } } } },
  })

  console.log(`[OK] Accounting entry created: ${entry?.id}`)
  for (const l of entry?.lines || []) {
    console.log(`     ${l.account.code} ${l.account.name.padEnd(30)} debit=${l.debit.toString().padStart(8)} credit=${l.credit.toString().padStart(8)}`)
  }

  return true
}

async function testPdf(payrollId: string) {
  console.log(`\n--- Test 3: Generate PDF ---`)
  const { generatePayrollPdf } = await import('../src/lib/payroll-pdf')

  const payroll = await prisma.payroll.findFirst({
    where: { id: payrollId, companyId: COMPANY_ID },
    include: { employee: true },
  })
  if (!payroll) {
    console.log('[FAIL] Payroll not found')
    return false
  }

  const company = await prisma.company.findUnique({ where: { id: COMPANY_ID } })
  if (!company) {
    console.log('[FAIL] Company not found')
    return false
  }

  const pdf = await generatePayrollPdf({ payroll, employee: payroll.employee, company })
  const sizeKB = Math.round(pdf.length / 1024)
  console.log(`[OK] PDF generated: ${sizeKB} KB (${pdf.length} bytes)`)
  return sizeKB > 0
}

async function testPreviRed(payrollId: string) {
  console.log(`\n--- Test 4: Generate PreviRed file ---`)
  const { generatePreviRedFile } = await import('../src/lib/payroll-exports')

  const payrolls = await prisma.payroll.findMany({
    where: { companyId: COMPANY_ID },
    include: { employee: true },
  })

  const content = generatePreviRedFile(
    COMPANY_RUT,
    payrolls[0].year,
    payrolls[0].month,
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

  const lines = content.split('\n').filter(Boolean)
  console.log(`[OK] PreviRed file: ${lines.length} lines, ${content.length} bytes`)
  console.log(`     First line preview: ${lines[0]?.slice(0, 80)}...`)
  return lines.length > 0 && content.length > 0
}

async function main() {
  try {
    console.log('===== Smoke test: Payroll / Remuneraciones =====\n')
    await ensureCompany()
    const employee = await createTestEmployee()
    const payroll = await testGeneratePayroll(employee.id)

    let r2 = false, r3 = false, r4 = false
    if (payroll) {
      r2 = await testApproveAndEntry(payroll.id)
      r3 = await testPdf(payroll.id)
      r4 = await testPreviRed(payroll.id)
    }

    console.log('\n===== Resultado =====')
    console.log(`Test 1 (generate payroll):      ${payroll ? 'PASS' : 'FAIL'}`)
    console.log(`Test 2 (approve + entry):       ${r2 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 3 (PDF):                   ${r3 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 4 (PreviRed):              ${r4 ? 'PASS' : 'FAIL'}`)

    const allPass = payroll && r2 && r3 && r4
    process.exit(allPass ? 0 : 1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
