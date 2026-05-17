/**
 * Inspecciona el estado actual antes de migrar tenant.
 * Solo lectura.
 */
import { prisma } from '@contachile/db'

async function main() {
  const companies = await prisma.company.findMany()
  console.log('\n=== Companies ===')
  companies.forEach(c => console.log(JSON.stringify(c, null, 2)))

  console.log('\n=== Documents companyId distinct (con detalles) ===')
  const docs = await prisma.document.groupBy({
    by: ['companyId'],
    _count: { _all: true },
  })
  for (const g of docs) {
    console.log(`\n  companyId: ${g.companyId} (${g._count._all} docs)`)
    const sample = await prisma.document.findMany({
      where: { companyId: g.companyId },
      select: { id: true, type: true, folio: true, receiverName: true, totalAmount: true, status: true, emittedAt: true },
      take: 3,
      orderBy: { emittedAt: 'desc' },
    })
    sample.forEach(d => console.log(`    ${d.type}/${d.folio} ${d.receiverName} $${d.totalAmount} ${d.status} ${d.emittedAt.toISOString().slice(0,10)}`))
  }

  console.log('\n=== Otras tablas con companyId distinct ===')
  for (const model of ['purchase', 'employee', 'payroll', 'journalEntry', 'account', 'bankAccount', 'bankMovement', 'honorario', 'quote', 'product', 'folioCounter', 'alertSent'] as const) {
    // @ts-ignore
    const groups = await (prisma as any)[model].groupBy({ by: ['companyId'], _count: { _all: true } })
    if (groups.length === 0) continue
    console.log(`  ${model}:`)
    groups.forEach((g: any) => console.log(`    ${g.companyId} → ${g._count._all}`))
  }

  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
