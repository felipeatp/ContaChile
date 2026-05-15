import PDFDocument from 'pdfkit'

interface PayrollPdfInput {
  payroll: {
    year: number
    month: number
    bruto: number
    horasExtras: number
    bonos: number
    afp: number
    salud: number
    cesantia: number
    baseImponible: number
    impuesto: number
    otrosDesc: number
    liquido: number
    status: string
  }
  employee: {
    rut: string
    name: string
    position: string
    afp: string
    healthPlan: string
    startDate: Date
    contractType: string
  }
  company: {
    rut: string
    name: string
    address?: string | null
    commune?: string | null
  }
}

const MONTHS = [
  '', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

function fmtCLP(n: number): string {
  return `$ ${n.toLocaleString('es-CL')}`
}

export function generatePayrollPdf(input: PayrollPdfInput): Promise<Buffer> {
  const { payroll, employee, company } = input
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const chunks: Buffer[] = []
    doc.on('data', (c) => chunks.push(c))
    doc.on('end', () => resolve(Buffer.concat(chunks)))

    // Header
    doc.fontSize(16).font('Helvetica-Bold').text(company.name, { align: 'left' })
    doc.fontSize(10).font('Helvetica').text(`RUT: ${company.rut}`)
    if (company.address) {
      doc.text(`${company.address}${company.commune ? ', ' + company.commune : ''}`)
    }
    doc.moveDown()

    doc.fontSize(14).font('Helvetica-Bold').text('LIQUIDACIÓN DE SUELDO', { align: 'center' })
    doc.fontSize(11).font('Helvetica').text(
      `${MONTHS[payroll.month].toUpperCase()} ${payroll.year}`,
      { align: 'center' }
    )
    doc.moveDown()

    // Employee info
    doc.fontSize(10).font('Helvetica-Bold').text('TRABAJADOR')
    doc.font('Helvetica')
    doc.text(`Nombre: ${employee.name}`)
    doc.text(`RUT: ${employee.rut}`)
    doc.text(`Cargo: ${employee.position}`)
    doc.text(`Tipo contrato: ${employee.contractType}`)
    doc.text(`AFP: ${employee.afp}`)
    doc.text(`Sistema salud: ${employee.healthPlan}`)
    doc.text(`Fecha ingreso: ${employee.startDate.toISOString().slice(0, 10)}`)
    doc.moveDown()

    // Haberes table
    doc.fontSize(11).font('Helvetica-Bold').text('HABERES')
    doc.moveDown(0.3)
    doc.font('Helvetica').fontSize(10)
    drawRow(doc, 'Sueldo base', fmtCLP(payroll.bruto - payroll.horasExtras - payroll.bonos))
    if (payroll.horasExtras > 0) drawRow(doc, 'Horas extras', fmtCLP(payroll.horasExtras))
    if (payroll.bonos > 0) drawRow(doc, 'Bonos', fmtCLP(payroll.bonos))
    doc.font('Helvetica-Bold')
    drawRow(doc, 'Total Haberes', fmtCLP(payroll.bruto))
    doc.moveDown()

    // Descuentos table
    doc.font('Helvetica-Bold').text('DESCUENTOS')
    doc.moveDown(0.3)
    doc.font('Helvetica')
    drawRow(doc, `Cotización AFP (${employee.afp})`, fmtCLP(payroll.afp))
    drawRow(doc, `Salud (${employee.healthPlan})`, fmtCLP(payroll.salud))
    if (payroll.cesantia > 0) drawRow(doc, 'Seguro cesantía', fmtCLP(payroll.cesantia))
    if (payroll.impuesto > 0) drawRow(doc, 'Impuesto único 2ª categoría', fmtCLP(payroll.impuesto))
    if (payroll.otrosDesc > 0) drawRow(doc, 'Otros descuentos', fmtCLP(payroll.otrosDesc))
    const totalDescuentos = payroll.afp + payroll.salud + payroll.cesantia + payroll.impuesto + payroll.otrosDesc
    doc.font('Helvetica-Bold')
    drawRow(doc, 'Total Descuentos', fmtCLP(totalDescuentos))
    doc.moveDown()

    // Base imponible
    doc.font('Helvetica').fontSize(9)
    doc.text(`Base imponible para impuesto: ${fmtCLP(payroll.baseImponible)}`, { align: 'right' })
    doc.moveDown()

    // Líquido a pagar
    doc.rect(50, doc.y, 495, 25).fill('#f3f4f6').stroke()
    doc.fillColor('black').fontSize(13).font('Helvetica-Bold')
    doc.text('LÍQUIDO A PAGAR', 60, doc.y - 18)
    doc.text(fmtCLP(payroll.liquido), 60, doc.y - 13, { align: 'right', width: 475 })
    doc.moveDown(2)

    // Status
    doc.font('Helvetica').fontSize(9).fillColor('#666')
    doc.text(`Estado: ${payroll.status}`, { align: 'left' })
    doc.moveDown(3)

    // Firmas
    doc.fillColor('black').fontSize(10)
    const sigY = doc.y
    doc.moveTo(70, sigY).lineTo(220, sigY).stroke()
    doc.moveTo(370, sigY).lineTo(520, sigY).stroke()
    doc.text('Firma empleador', 70, sigY + 5, { width: 150, align: 'center' })
    doc.text('Firma trabajador', 370, sigY + 5, { width: 150, align: 'center' })

    doc.end()
  })
}

function drawRow(doc: typeof PDFDocument.prototype, label: string, value: string) {
  const y = doc.y
  doc.text(label, 60, y, { width: 350 })
  doc.text(value, 60, y, { width: 475, align: 'right' })
  doc.moveDown(0.4)
}
