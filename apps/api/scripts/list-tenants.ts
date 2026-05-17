/**
 * Lista companyIds con conteo de documents, purchases y employees.
 * Para diagnosticar mismatches de tenant en chats.
 *
 * Run:
 *   $env:DATABASE_URL="postgresql://contachile:contachile@localhost:5432/contachile"
 *   apps/api/node_modules/.bin/tsx.CMD apps/api/scripts/list-tenants.ts
 */
import { prisma } from '@contachile/db'

async function main() {
  const docs = await prisma.document.groupBy({
    by: ['companyId'],
    _count: { _all: true },
    _min: { emittedAt: true },
    _max: { emittedAt: true },
  })
  const purchases = await prisma.purchase.groupBy({
    by: ['companyId'],
    _count: { _all: true },
  })
  const employees = await prisma.employee.groupBy({
    by: ['companyId'],
    _count: { _all: true },
  })
  const companies = await prisma.company.findMany({
    select: { id: true, rut: true, name: true },
  })

  console.log('\n=== Companies ===')
  companies.forEach(c => console.log(`  ${c.id}  |  ${c.rut}  |  ${c.name}`))

  console.log('\n=== Documents por companyId ===')
  docs
    .sort((a, b) => b._count._all - a._count._all)
    .forEach(g => console.log(
      `  ${g.companyId}  |  ${g._count._all} docs  |  ` +
      `${g._min.emittedAt?.toISOString().slice(0,10)} → ${g._max.emittedAt?.toISOString().slice(0,10)}`
    ))

  console.log('\n=== Purchases por companyId ===')
  purchases.forEach(g => console.log(`  ${g.companyId}  |  ${g._count._all} purchases`))

  console.log('\n=== Employees por companyId ===')
  employees.forEach(g => console.log(`  ${g.companyId}  |  ${g._count._all} employees`))

  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
