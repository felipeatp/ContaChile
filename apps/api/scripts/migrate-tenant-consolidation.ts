/**
 * Migración: consolidar tenants en el userId Clerk del usuario.
 *
 * SOURCES → TARGET:
 *   - null                              ┐
 *   - dev-test-company                  ├──→ user_3DfMSMelgwyaXK1rTCds0t2LpDk
 *   - cmp4x4utb0000hsrsz3eb6vfy         ┘
 *
 * También crea (o upserta) un Company con id=TARGET, RUT 76.123.456-7,
 * nombre "Empresa de Prueba SpA" (copia los campos de cmp4x4utb0000…
 * antes de borrarlo).
 *
 * Atómico: todo dentro de una transacción Prisma.
 *
 * Run:
 *   $env:DATABASE_URL="postgresql://contachile:contachile@localhost:5432/contachile"
 *   apps/api/node_modules/.bin/tsx.CMD apps/api/scripts/migrate-tenant-consolidation.ts
 */
import { prisma } from '@contachile/db'

const TARGET = 'user_3DfMSMelgwyaXK1rTCds0t2LpDk'
const SOURCES = ['dev-test-company', 'cmp4x4utb0000hsrsz3eb6vfy']

async function main() {
  console.log(`Target: ${TARGET}`)
  console.log(`Sources: null, ${SOURCES.join(', ')}`)
  console.log('')

  // Capturar datos de la "Empresa de Prueba SpA" antes de borrar
  const sourceCompany = await prisma.company.findUnique({
    where: { id: 'cmp4x4utb0000hsrsz3eb6vfy' },
  })
  if (!sourceCompany) {
    console.warn('No se encontró cmp4x4utb0000hsrsz3eb6vfy; se creará Company con valores por defecto.')
  }

  // Si el target ya tiene Company, no la pisamos
  const existingTarget = await prisma.company.findUnique({ where: { id: TARGET } })
  if (existingTarget) {
    console.log(`Company id=${TARGET} ya existe; no se sobreescribe.`)
  }

  await prisma.$transaction(async (tx) => {
    // ── 0. Limpiar tablas con uniques que podrían colisionar al migrar ────────
    // AlertSent: cache de dedupe de alertas. Se regenera. Más simple que dedupear.
    const deletedAlerts = await tx.alertSent.deleteMany({
      where: { companyId: { in: [...SOURCES, TARGET] } },
    })
    if (deletedAlerts.count > 0) console.log(`  alertSent: ${deletedAlerts.count} filas borradas (regenerable)`)

    // FolioCounter: unique (companyId, type). Calculamos el max nextFolio por
    // type entre sources+target, luego borramos todos y reinsertamos en target.
    const foliosBefore = await tx.folioCounter.findMany({
      where: { companyId: { in: [...SOURCES, TARGET] } },
    })
    const folioMaxByType = new Map<number, number>()
    for (const f of foliosBefore) {
      const prev = folioMaxByType.get(f.type) ?? 0
      if (f.nextFolio > prev) folioMaxByType.set(f.type, f.nextFolio)
    }
    if (foliosBefore.length > 0) {
      const deletedFolios = await tx.folioCounter.deleteMany({
        where: { companyId: { in: [...SOURCES, TARGET] } },
      })
      console.log(`  folioCounter: ${deletedFolios.count} filas borradas para consolidar`)
      for (const [type, nextFolio] of folioMaxByType) {
        await tx.folioCounter.create({
          data: { companyId: TARGET, type, nextFolio },
        })
      }
      console.log(`  folioCounter: ${folioMaxByType.size} nuevos counters en target (max por type)`)
    }

    // ── 1. Reasignar todos los hijos por companyId ────────────────────────────
    // Tablas con companyId: String (NOT NULL) →  in: [SOURCES]
    const updaters: Array<{ model: string; updater: () => Promise<{ count: number }> }> = [
      { model: 'account',            updater: () => tx.account.updateMany({ where: { companyId: { in: SOURCES } }, data: { companyId: TARGET } }) },
      { model: 'journalEntry',       updater: () => tx.journalEntry.updateMany({ where: { companyId: { in: SOURCES } }, data: { companyId: TARGET } }) },
      { model: 'employee',           updater: () => tx.employee.updateMany({ where: { companyId: { in: SOURCES } }, data: { companyId: TARGET } }) },
      { model: 'payroll',            updater: () => tx.payroll.updateMany({ where: { companyId: { in: SOURCES } }, data: { companyId: TARGET } }) },
      { model: 'honorario',          updater: () => tx.honorario.updateMany({ where: { companyId: { in: SOURCES } }, data: { companyId: TARGET } }) },
      { model: 'bankAccount',        updater: () => tx.bankAccount.updateMany({ where: { companyId: { in: SOURCES } }, data: { companyId: TARGET } }) },
      { model: 'bankMovement',       updater: () => tx.bankMovement.updateMany({ where: { companyId: { in: SOURCES } }, data: { companyId: TARGET } }) },
      { model: 'quote',              updater: () => tx.quote.updateMany({ where: { companyId: { in: SOURCES } }, data: { companyId: TARGET } }) },
      { model: 'purchase',           updater: () => tx.purchase.updateMany({ where: { companyId: { in: SOURCES } }, data: { companyId: TARGET } }) },
      { model: 'product',            updater: () => tx.product.updateMany({ where: { companyId: { in: SOURCES } }, data: { companyId: TARGET } }) },
      { model: 'inventoryMovement',  updater: () => tx.inventoryMovement.updateMany({ where: { companyId: { in: SOURCES } }, data: { companyId: TARGET } }) },
    ]

    for (const { model, updater } of updaters) {
      const res = await updater()
      if (res.count > 0) console.log(`  ${model}: ${res.count} filas reasignadas`)
    }

    // Document.companyId es nullable → manejarlo en dos pasos
    const docsFromSources = await tx.document.updateMany({
      where: { companyId: { in: SOURCES } },
      data: { companyId: TARGET },
    })
    if (docsFromSources.count > 0) console.log(`  document (sources): ${docsFromSources.count} filas reasignadas`)

    // Docs huérfanos con companyId=null: tienen folios duplicados internos
    // (33/2 dos veces). Los borramos en vez de migrar — son data antigua de
    // antes de que se configurara auth. DocumentItem es onDelete:Cascade no
    // configurado en schema, así que limpiamos a mano.
    const nullDocs = await tx.document.findMany({
      where: { companyId: null },
      select: { id: true },
    })
    if (nullDocs.count !== undefined || nullDocs.length > 0) {
      const ids = nullDocs.map(d => d.id)
      const deletedAudit = await tx.auditLog.deleteMany({ where: { documentId: { in: ids } } })
      const deletedItems = await tx.documentItem.deleteMany({ where: { documentId: { in: ids } } })
      const deletedDocs = await tx.document.deleteMany({ where: { id: { in: ids } } })
      if (deletedDocs.count > 0) {
        console.log(`  document (null orphans): ${deletedDocs.count} borrados + ${deletedItems.count} items + ${deletedAudit.count} audit logs`)
      }
    }

    // ── 2. Borrar Company sources (sus hijos ya migraron) ─────────────────────
    for (const src of SOURCES) {
      const c = await tx.company.findUnique({ where: { id: src } })
      if (c) {
        await tx.company.delete({ where: { id: src } })
        console.log(`  company eliminada: ${src} (RUT ${c.rut})`)
      }
    }

    // ── 3. Crear / upsertar Company TARGET con datos de la "real" ─────────────
    const upserted = await tx.company.upsert({
      where: { id: TARGET },
      update: {}, // si ya existe, no pisamos
      create: {
        id: TARGET,
        rut: sourceCompany?.rut ?? '76.123.456-7',
        name: sourceCompany?.name ?? 'Empresa de Prueba SpA',
        giro: sourceCompany?.giro ?? null,
        address: sourceCompany?.address ?? null,
        commune: sourceCompany?.commune ?? null,
        city: sourceCompany?.city ?? null,
        economicActivity: sourceCompany?.economicActivity ?? null,
        phone: sourceCompany?.phone ?? null,
        email: sourceCompany?.email ?? null,
        certEncrypted: sourceCompany?.certEncrypted ?? null,
        certPassword: sourceCompany?.certPassword ?? null,
        siiCertified: sourceCompany?.siiCertified ?? false,
        defaultPaymentMethod: sourceCompany?.defaultPaymentMethod ?? 'CONTADO',
        defaultDocumentType: sourceCompany?.defaultDocumentType ?? 33,
      },
    })
    console.log(`  company target: ${upserted.id} (RUT ${upserted.rut}, "${upserted.name}")`)
  })

  // ── 4. Verificación post-migración ──────────────────────────────────────────
  console.log('\n=== Estado final ===')
  const finalCompanies = await prisma.company.findMany({ select: { id: true, rut: true, name: true } })
  console.log('Companies:')
  finalCompanies.forEach(c => console.log(`  ${c.id} | ${c.rut} | ${c.name}`))

  const finalDocs = await prisma.document.groupBy({ by: ['companyId'], _count: { _all: true } })
  console.log('Documents por companyId:')
  finalDocs.forEach(g => console.log(`  ${g.companyId} → ${g._count._all}`))

  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
