import PDFDocument from 'pdfkit'

interface QuotePdfInput {
  quote: {
    number: number
    date: Date
    validUntil?: Date | null
    receiverRut: string
    receiverName: string
    receiverEmail?: string | null
    receiverAddress?: string | null
    totalNet: number
    totalTax: number
    totalAmount: number
    paymentMethod: string
    notes?: string | null
    status: string
    items: Array<{
      description: string
      quantity: number
      unitPrice: number
      totalPrice: number
    }>
  }
  company: {
    rut: string
    name: string
    address?: string | null
    commune?: string | null
    phone?: string | null
    email?: string | null
    giro?: string | null
  }
}

function fmtCLP(n: number): string {
  return `$ ${n.toLocaleString('es-CL')}`
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString('es-CL', { day: '2-digit', month: 'long', year: 'numeric' })
}

export function generateQuotePdf(input: QuotePdfInput): Promise<Buffer> {
  const { quote, company } = input
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const chunks: Buffer[] = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text(company.name, { align: 'left' })
    doc.fontSize(9).font('Helvetica')
    doc.text(`RUT: ${company.rut}`)
    if (company.giro) doc.text(`Giro: ${company.giro}`)
    if (company.address) {
      doc.text(`${company.address}${company.commune ? ', ' + company.commune : ''}`)
    }
    if (company.phone) doc.text(`Teléfono: ${company.phone}`)
    if (company.email) doc.text(`Email: ${company.email}`)
    doc.moveDown()

    // Title
    doc.fontSize(16).font('Helvetica-Bold').text(`COTIZACIÓN N° ${quote.number}`, { align: 'center' })
    doc.fontSize(9).font('Helvetica').fillColor('#666')
    doc.text(`Estado: ${quote.status}`, { align: 'center' })
    doc.fillColor('black')
    doc.moveDown()

    // Meta box
    const metaY = doc.y
    doc.rect(50, metaY, 495, 60).stroke()
    doc.fontSize(10).font('Helvetica')
    doc.text(`Fecha emisión: ${fmtDate(quote.date)}`, 60, metaY + 8)
    if (quote.validUntil) {
      doc.text(`Válido hasta: ${fmtDate(quote.validUntil)}`, 60, metaY + 24)
    }
    doc.text(`Forma de pago: ${quote.paymentMethod}`, 60, metaY + 40)
    doc.y = metaY + 70
    doc.moveDown(0.5)

    // Cliente
    doc.fontSize(10).font('Helvetica-Bold').text('CLIENTE')
    doc.font('Helvetica').fontSize(9)
    doc.text(`Nombre: ${quote.receiverName}`)
    doc.text(`RUT: ${quote.receiverRut}`)
    if (quote.receiverEmail) doc.text(`Email: ${quote.receiverEmail}`)
    if (quote.receiverAddress) doc.text(`Dirección: ${quote.receiverAddress}`)
    doc.moveDown()

    // Items table header
    doc.fontSize(10).font('Helvetica-Bold')
    const tableTop = doc.y
    const cols = [50, 300, 360, 430, 510]
    doc.rect(50, tableTop, 495, 18).fill('#f3f4f6').stroke()
    doc.fillColor('black').fontSize(9)
    doc.text('Descripción', cols[0] + 5, tableTop + 5)
    doc.text('Cant.', cols[1], tableTop + 5, { width: 50, align: 'right' })
    doc.text('Precio Unit.', cols[2], tableTop + 5, { width: 60, align: 'right' })
    doc.text('Total', cols[3], tableTop + 5, { width: 75, align: 'right' })

    doc.y = tableTop + 20
    doc.font('Helvetica').fontSize(9)
    for (const item of quote.items) {
      const rowY = doc.y
      doc.text(item.description, cols[0] + 5, rowY, { width: cols[1] - cols[0] - 10 })
      const afterDesc = doc.y
      doc.text(String(item.quantity), cols[1], rowY, { width: 50, align: 'right' })
      doc.text(fmtCLP(item.unitPrice), cols[2], rowY, { width: 60, align: 'right' })
      doc.text(fmtCLP(item.totalPrice), cols[3], rowY, { width: 75, align: 'right' })
      doc.y = Math.max(afterDesc, rowY + 12) + 2
    }

    doc.moveDown()

    // Totales
    const totY = doc.y
    doc.font('Helvetica').fontSize(10)
    doc.text('Neto:', 380, totY, { width: 80, align: 'right' })
    doc.text(fmtCLP(quote.totalNet), 460, totY, { width: 80, align: 'right' })
    doc.text('IVA (19%):', 380, totY + 16, { width: 80, align: 'right' })
    doc.text(fmtCLP(quote.totalTax), 460, totY + 16, { width: 80, align: 'right' })
    doc.font('Helvetica-Bold').fontSize(11)
    doc.text('TOTAL:', 380, totY + 36, { width: 80, align: 'right' })
    doc.text(fmtCLP(quote.totalAmount), 460, totY + 36, { width: 80, align: 'right' })
    doc.y = totY + 60

    if (quote.notes) {
      doc.font('Helvetica').fontSize(9).fillColor('#444')
      doc.text('Notas:', 50, doc.y)
      doc.text(quote.notes, 50, doc.y, { width: 495 })
      doc.fillColor('black')
      doc.moveDown()
    }

    doc.moveDown(2)

    // Disclaimer
    doc.fontSize(8).font('Helvetica-Oblique').fillColor('#666')
    doc.text(
      'Esta cotización no constituye documento tributario electrónico. ' +
        'Al aceptar, se procederá a la emisión de la factura electrónica correspondiente.',
      50,
      doc.y,
      { width: 495, align: 'center' }
    )

    doc.end()
  })
}
