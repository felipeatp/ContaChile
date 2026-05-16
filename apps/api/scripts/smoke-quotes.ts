/**
 * Smoke test for quotes module.
 *
 * Run: $env:DATABASE_URL="postgresql://contachile:contachile@localhost:5432/contachile"
 *      apps/api/node_modules/.bin/tsx.CMD apps/api/scripts/smoke-quotes.ts
 */

import { PrismaClient } from '../../../packages/db/generated/client'
import { calcularIVA, calcularTotal } from '@contachile/validators'
import { createSalesEntry } from '../src/lib/accounting-entries'
import { generateQuotePdf } from '../src/lib/quote-pdf'

const prisma = new PrismaClient()
const COMPANY_ID = 'dev-test-company'

async function cleanup() {
  await prisma.journalEntry.deleteMany({
    where: { companyId: COMPANY_ID, reference: { startsWith: 'QUOTE-' } },
  })
  // Delete documents from to-invoice (track by trackId prefix QUOTE-)
  // Necesita borrar primero items, audit logs y luego documents
  const quoteDocs = await prisma.document.findMany({
    where: { companyId: COMPANY_ID, trackId: { startsWith: 'QUOTE-' } },
    select: { id: true },
  })
  const docIds = quoteDocs.map((d) => d.id)
  if (docIds.length > 0) {
    await prisma.documentItem.deleteMany({ where: { documentId: { in: docIds } } })
    await prisma.auditLog.deleteMany({ where: { documentId: { in: docIds } } })
    await prisma.document.deleteMany({ where: { id: { in: docIds } } })
  }
  await prisma.quote.deleteMany({
    where: { companyId: COMPANY_ID, number: { in: [9001, 9002] } },
  })
}

async function ensureCompany() {
  const company = await prisma.company.findUnique({ where: { id: COMPANY_ID } })
  if (!company) {
    console.log('[FAIL] Company dev-test-company no existe')
    return null
  }
  return company
}

async function testCreateQuote() {
  console.log('=== Test 1: crear cotización con 2 items ===')
  const items = [
    { description: 'Consultoría Q1', quantity: 1, unitPrice: 500_000 },
    { description: 'Setup inicial', quantity: 2, unitPrice: 150_000 },
  ]
  const neto = items.reduce((s, i) => s + i.quantity * i.unitPrice, 0)
  const tax = calcularIVA(neto)
  const total = calcularTotal(neto)

  const quote = await prisma.quote.create({
    data: {
      companyId: COMPANY_ID,
      number: 9001,
      receiverRut: '76.555.444-3',
      receiverName: 'Cliente Cotización Test',
      receiverEmail: 'cliente@test.cl',
      paymentMethod: 'CONTADO',
      totalNet: neto,
      totalTax: tax,
      totalAmount: total,
      items: {
        create: items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.quantity * i.unitPrice,
        })),
      },
    },
    include: { items: true },
  })
  console.log(`Cotización #${quote.number}: status=${quote.status}, total=${quote.totalAmount}, items=${quote.items.length}`)
  if (quote.status !== 'DRAFT' || quote.items.length !== 2) {
    console.log('[FAIL] datos inesperados')
    return null
  }
  if (quote.totalAmount !== 952_000) { // 800k + 152k IVA = 952k
    console.log(`[FAIL] total esperado 952.000, obtuvo ${quote.totalAmount}`)
    return null
  }
  console.log('[OK] Cotización creada en DRAFT con total $952.000')
  return quote
}

async function testTransitions(quoteId: string) {
  console.log('\n=== Test 2: transiciones DRAFT → SENT → ACCEPTED ===')

  // DRAFT → SENT
  let q = await prisma.quote.update({
    where: { id: quoteId },
    data: { status: 'SENT', sentAt: new Date() },
  })
  if (q.status !== 'SENT') {
    console.log('[FAIL] no transicionó a SENT')
    return false
  }

  // SENT → ACCEPTED
  q = await prisma.quote.update({
    where: { id: quoteId },
    data: { status: 'ACCEPTED', acceptedAt: new Date() },
  })
  if (q.status !== 'ACCEPTED') {
    console.log('[FAIL] no transicionó a ACCEPTED')
    return false
  }
  console.log('[OK] DRAFT → SENT → ACCEPTED')
  return true
}

async function testToInvoice(quoteId: string) {
  console.log('\n=== Test 3: convertir a factura ===')

  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { items: true },
  })
  if (!quote) return false

  // Folio counter
  const counter = await prisma.folioCounter.findUnique({
    where: { companyId_type: { companyId: COMPANY_ID, type: 33 } },
  })
  const folio = counter ? counter.nextFolio : 1
  if (counter) {
    await prisma.folioCounter.update({
      where: { id: counter.id },
      data: { nextFolio: { increment: 1 } },
    })
  } else {
    await prisma.folioCounter.create({
      data: { companyId: COMPANY_ID, type: 33, nextFolio: 2 },
    })
  }

  const trackId = `QUOTE-${quote.id.slice(-6)}-${Date.now()}`
  const doc = await prisma.document.create({
    data: {
      type: 33,
      folio,
      status: 'PENDING',
      trackId,
      companyId: COMPANY_ID,
      receiverRut: quote.receiverRut,
      receiverName: quote.receiverName,
      receiverEmail: quote.receiverEmail,
      totalNet: quote.totalNet,
      totalTax: quote.totalTax,
      totalAmount: quote.totalAmount,
      paymentMethod: quote.paymentMethod,
      items: {
        create: quote.items.map((i) => ({
          description: i.description,
          quantity: i.quantity,
          unitPrice: i.unitPrice,
          totalPrice: i.totalPrice,
        })),
      },
    },
  })

  await createSalesEntry(doc, { warn: (d, m) => console.log('[WARN]', m, JSON.stringify(d)) })

  const updatedQuote = await prisma.quote.update({
    where: { id: quote.id },
    data: { status: 'INVOICED', invoicedAt: new Date(), invoicedDocumentId: doc.id },
  })

  console.log(`Document creado folio=${doc.folio}, type=${doc.type}`)
  console.log(`Quote.status=${updatedQuote.status}, invoicedDocumentId=${updatedQuote.invoicedDocumentId}`)

  if (updatedQuote.status !== 'INVOICED' || updatedQuote.invoicedDocumentId !== doc.id) {
    console.log('[FAIL] quote no quedó marcada INVOICED')
    return false
  }
  if (doc.totalAmount !== quote.totalAmount) {
    console.log('[FAIL] totales no coinciden entre quote y document')
    return false
  }

  // Verificar asiento creado
  const entries = await prisma.journalEntry.findMany({
    where: { companyId: COMPANY_ID, sourceId: doc.id },
    include: { lines: true },
  })
  if (entries.length === 0) {
    console.log('[FAIL] no se creó asiento contable')
    return false
  }
  const totalD = entries[0].lines.reduce((s, l) => s + l.debit, 0)
  console.log(`[OK] Document creado + JournalEntry (3 líneas, D=${totalD})`)
  return true
}

async function testPdf(quoteId: string, companyId: string) {
  console.log('\n=== Test 4: generar PDF ===')
  const quote = await prisma.quote.findUnique({
    where: { id: quoteId },
    include: { items: true },
  })
  const company = await prisma.company.findUnique({ where: { id: companyId } })
  if (!quote || !company) return false

  const pdf = await generateQuotePdf({ quote, company })
  if (!Buffer.isBuffer(pdf) || pdf.length < 1000) {
    console.log(`[FAIL] PDF inválido (length=${pdf.length})`)
    return false
  }
  console.log(`[OK] PDF generado (${pdf.length} bytes)`)
  return true
}

async function main() {
  try {
    console.log('===== Smoke test: Cotizaciones =====\n')
    await cleanup()
    const company = await ensureCompany()
    if (!company) process.exit(1)

    const quote = await testCreateQuote()
    if (!quote) {
      await cleanup()
      process.exit(1)
    }

    const r2 = await testTransitions(quote.id)
    const r3 = r2 ? await testToInvoice(quote.id) : false
    const r4 = await testPdf(quote.id, COMPANY_ID)

    await cleanup()

    console.log('\n===== Resultado =====')
    console.log(`Test 1 (crear quote):       PASS`)
    console.log(`Test 2 (transiciones):      ${r2 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 3 (to-invoice):        ${r3 ? 'PASS' : 'FAIL'}`)
    console.log(`Test 4 (PDF):               ${r4 ? 'PASS' : 'FAIL'}`)

    process.exit(r2 && r3 && r4 ? 0 : 1)
  } finally {
    await prisma.$disconnect()
  }
}

main()
