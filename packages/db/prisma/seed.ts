import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Seeding database...')

  // Clean existing sample data
  await prisma.documentItem.deleteMany({})
  await prisma.auditLog.deleteMany({})
  await prisma.document.deleteMany({})
  console.log('Cleaned existing documents')

  // Create test company
  const company = await prisma.company.upsert({
    where: { rut: '76.123.456-7' },
    update: {},
    create: {
      rut: '76.123.456-7',
      name: 'Empresa de Prueba SpA',
      siiCertified: false,
    },
  })
  console.log('Company:', company.name)

  // Create folio counters for common document types
  const types = [33, 34, 39, 41, 43, 46, 52, 56, 61]
  for (const type of types) {
    await prisma.folioCounter.upsert({
      where: { companyId_type: { companyId: company.id, type } },
      update: {},
      create: {
        companyId: company.id,
        type,
        nextFolio: 1,
      },
    })
  }
  console.log('Folio counters created for types:', types.join(', '))

  // Create sample documents
  const sampleDocs = [
    {
      type: 33,
      folio: 1,
      status: 'ACCEPTED' as const,
      trackId: 'SII-1234567890',
      receiverRut: '76.543.210-2',
      receiverName: 'Cliente A SpA',
      receiverEmail: 'cliente@ejemplo.cl',
      totalNet: 100000,
      totalTax: 19000,
      totalAmount: 119000,
      paymentMethod: 'CONTADO',
      items: [
        { description: 'Servicio de consultoría', quantity: 1, unitPrice: 100000, totalPrice: 100000 },
      ],
      auditLogs: [{ action: 'EMIT', payload: { source: 'direct' } }],
    },
    {
      type: 33,
      folio: 2,
      status: 'PENDING' as const,
      trackId: 'SII-1234567891',
      receiverRut: '77.777.777-7',
      receiverName: 'Cliente B Ltda',
      totalNet: 50000,
      totalTax: 9500,
      totalAmount: 59500,
      paymentMethod: 'CREDITO',
      items: [
        { description: 'Producto A', quantity: 5, unitPrice: 10000, totalPrice: 50000 },
      ],
      auditLogs: [{ action: 'EMIT', payload: { source: 'direct' } }],
    },
    {
      type: 39,
      folio: 1,
      status: 'ACCEPTED' as const,
      trackId: 'SII-1234567892',
      receiverRut: '66.666.666-6',
      receiverName: 'Consumidor Final',
      totalNet: 25000,
      totalTax: 4750,
      totalAmount: 29750,
      paymentMethod: 'CONTADO',
      items: [
        { description: 'Producto B', quantity: 2, unitPrice: 12500, totalPrice: 25000 },
      ],
      auditLogs: [{ action: 'EMIT', payload: { source: 'direct' } }],
    },
  ]

  for (const doc of sampleDocs) {
    await prisma.document.create({
      data: {
        ...doc,
        items: { create: doc.items },
        auditLogs: { create: doc.auditLogs },
      },
    })
  }
  console.log('Sample documents created:', sampleDocs.length)

  console.log('Seed completed successfully!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
