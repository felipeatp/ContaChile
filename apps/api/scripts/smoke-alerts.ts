/**
 * Smoke test for alerts module: vencimientos calendar + dedup + email queue.
 *
 * Run: $env:DATABASE_URL="postgresql://contachile:contachile@localhost:5432/contachile"
 *      apps/api/node_modules/.bin/tsx.CMD apps/api/scripts/smoke-alerts.ts
 */

import { PrismaClient } from '../../../packages/db/generated/client'
import { findUpcomingDueDates, adjustForWeekend } from '@contachile/validators'
import { processDailyAlerts } from '../src/workers/alerts'

const prisma = new PrismaClient()
const COMPANY_ID = 'dev-test-company'

function fmt(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function isoDay(d: Date): string {
  return ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()]
}

function testWeekendRollover() {
  console.log('=== Test 1: weekend rollover ===')

  // May 10 2026 should be Sunday
  const may10 = new Date(2026, 4, 10) // mes 0-indexed
  console.log(`May 10 2026 is ${isoDay(may10)}`)
  if (may10.getDay() !== 0) {
    console.log(`[FAIL] May 10 2026 esperado domingo, obtuvo ${isoDay(may10)}`)
    return false
  }
  const adjusted = adjustForWeekend(may10)
  if (fmt(adjusted) !== '2026-05-11') {
    console.log(`[FAIL] esperado 2026-05-11 (lunes), obtuvo ${fmt(adjusted)}`)
    return false
  }
  console.log(`[OK] domingo 2026-05-10 → lunes 2026-05-11`)

  // March 14 2026: probable sábado
  const march14 = new Date(2026, 2, 14)
  console.log(`March 14 2026 is ${isoDay(march14)}`)
  if (march14.getDay() === 6) {
    const adj = adjustForWeekend(march14)
    if (fmt(adj) !== '2026-03-16') {
      console.log(`[FAIL] esperado 2026-03-16 (lunes), obtuvo ${fmt(adj)}`)
      return false
    }
    console.log(`[OK] sábado 2026-03-14 → lunes 2026-03-16`)
  }

  // Tuesday should be unchanged
  const may12 = new Date(2026, 4, 12)
  console.log(`May 12 2026 is ${isoDay(may12)}`)
  const sameDay = adjustForWeekend(may12)
  if (fmt(sameDay) !== fmt(may12)) {
    console.log(`[FAIL] martes no debe modificarse`)
    return false
  }
  console.log('[OK] día hábil no se modifica')
  return true
}

function testFindUpcoming() {
  console.log('\n=== Test 2: findUpcomingDueDates ===')

  // Si hoy es 2026-05-15, debería ver F29 día 20 (5 días) y NO ver cotizaciones (ya pasó)
  // Cotizaciones día 10 ya pasó hace 5 días (incluida por defecto si <= 7)
  const today = new Date(2026, 4, 15) // viernes
  const upcoming = findUpcomingDueDates(today, { includePastDays: 7 })
  console.log(`From ${fmt(today)} (mes 5):`)
  for (const a of upcoming) {
    console.log(`  ${a.code} ${fmt(a.dueDate)} (${a.daysUntil > 0 ? '+' : ''}${a.daysUntil} días)`)
  }

  // F29 día 20 → daysUntil = 5
  const f29 = upcoming.find((a) => a.code === 'F29' && fmt(a.dueDate) === '2026-05-20')
  if (!f29) {
    console.log(`[FAIL] F29 día 20 no encontrado`)
    return false
  }
  if (f29.daysUntil !== 5) {
    console.log(`[FAIL] F29 daysUntil esperado 5, obtuvo ${f29.daysUntil}`)
    return false
  }
  console.log(`[OK] F29 2026-05-20 con daysUntil=5`)

  // Cotizaciones día 10 era domingo, se movió a lunes 11 → daysUntil = -4
  const cot = upcoming.find((a) => a.code === 'COTIZACIONES' && fmt(a.dueDate) === '2026-05-11')
  if (!cot) {
    console.log(`[FAIL] COTIZACIONES 2026-05-11 no encontrado`)
    return false
  }
  if (cot.daysUntil !== -4) {
    console.log(`[FAIL] COTIZACIONES daysUntil esperado -4, obtuvo ${cot.daysUntil}`)
    return false
  }
  console.log(`[OK] COTIZACIONES rolled to 2026-05-11 (lunes) con daysUntil=-4`)
  return true
}

async function ensureCompanyEmail() {
  const c = await prisma.company.findUnique({ where: { id: COMPANY_ID } })
  if (!c) {
    console.log('[WARN] Company dev-test-company no existe, smoke test no puede continuar')
    return false
  }
  if (!c.email) {
    await prisma.company.update({
      where: { id: COMPANY_ID },
      data: { email: 'test@contachile.local' },
    })
    console.log('[OK] Email asignado a la company de prueba')
  }
  return true
}

async function testDailyWorkerAndDedup() {
  console.log('\n=== Test 3: processDailyAlerts + dedup ===')

  if (!(await ensureCompanyEmail())) return false

  // Limpiar alertas previas para empezar limpio
  await prisma.alertSent.deleteMany({})

  const realToday = new Date()
  console.log(`(Hoy real del sistema: ${fmt(realToday)})`)

  const stats1 = await processDailyAlerts(realToday)
  console.log(`Run 1: ${JSON.stringify(stats1)}`)

  // Run 2 — todas las alertas registradas en Run 1 deben ahora skipear
  const stats2 = await processDailyAlerts(realToday)
  console.log(`Run 2: ${JSON.stringify(stats2)}`)

  if (stats2.alertsRegistered !== 0) {
    console.log(`[FAIL] Run 2 debería registrar 0 alertas nuevas, obtuvo ${stats2.alertsRegistered}`)
    return false
  }
  if (stats2.skipped !== stats1.alertsRegistered) {
    console.log(
      `[FAIL] Run 2 debería skipear ${stats1.alertsRegistered} (= alertsRegistered de Run 1), obtuvo ${stats2.skipped}`
    )
    return false
  }
  if (stats1.alertsRegistered === 0) {
    console.log('[INFO] No había vencimientos con daysUntil ∈ {5,1} hoy. Dedup no testeado en este run.')
  } else {
    console.log(`[OK] Dedup funcionó: Run 1 registró ${stats1.alertsRegistered}, Run 2 skipped ${stats2.skipped}`)
  }
  return true
}

async function main() {
  try {
    console.log('===== Smoke test: Alertas =====\n')
    const r1 = testWeekendRollover()
    const r2 = testFindUpcoming()
    const r3 = await testDailyWorkerAndDedup()

    console.log('\n===== Resultado =====')
    console.log(`Test 1 (weekend rollover):       ${r1 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 2 (findUpcomingDueDates):   ${r2 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 3 (worker + dedup):         ${r3 ? 'PASS' : 'FAIL'}`)

    process.exit(r1 && r2 && r3 ? 0 : 1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
