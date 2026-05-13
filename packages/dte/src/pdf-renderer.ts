import PDFDocument from 'pdfkit'

function extractTag(xml: string, tag: string): string {
  const open = '<' + tag + '>'
  const close = '</' + tag + '>'
  const start = xml.indexOf(open)
  if (start === -1) return ''
  const end = xml.indexOf(close, start)
  if (end === -1) return ''
  return xml.slice(start + open.length, end)
}

function extractDetails(xml: string): Array<{ nro: string; name: string; qty: string; price: string; total: string }> {
  const details: Array<{ nro: string; name: string; qty: string; price: string; total: string }> = []
  let pos = 0
  while (true) {
    const start = xml.indexOf('<Detalle>', pos)
    if (start === -1) break
    const end = xml.indexOf('</Detalle>', start)
    if (end === -1) break
    const block = xml.slice(start + 9, end)
    details.push({
      nro: extractTag(block, 'NroLinDet'),
      name: extractTag(block, 'NmbItem'),
      qty: extractTag(block, 'QtyItem'),
      price: extractTag(block, 'PrcItem'),
      total: extractTag(block, 'MontoItem'),
    })
    pos = end + 10
  }
  return details
}

export function renderPDF(xml: string): Promise<Buffer> {
  return new Promise((resolve) => {
    const doc = new PDFDocument({ margin: 50, size: 'A4' })
    const chunks: Buffer[] = []
    doc.on('data', (chunk) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))

  const tipoDte = extractTag(xml, 'TipoDTE')
  const folio = extractTag(xml, 'Folio')
  const fchEmis = extractTag(xml, 'FchEmis')
  const rutEmisor = extractTag(xml, 'RUTEmisor')
  const rznSoc = extractTag(xml, 'RznSoc')
  const dirOrigen = extractTag(xml, 'DirOrigen')
  const cmnaOrigen = extractTag(xml, 'CmnaOrigen')
  const ciudadOrigen = extractTag(xml, 'CiudadOrigen')
  const rutRecep = extractTag(xml, 'RUTRecep')
  const rznSocRecep = extractTag(xml, 'RznSocRecep')
  const dirRecep = extractTag(xml, 'DirRecep')
  const cmnaRecep = extractTag(xml, 'CmnaRecep')
  const ciudadRecep = extractTag(xml, 'CiudadRecep')
  const mntNeto = extractTag(xml, 'MntNeto')
  const iva = extractTag(xml, 'IVA')
  const mntTotal = extractTag(xml, 'MntTotal')
  const details = extractDetails(xml)

  const docNames: Record<string, string> = {
    '33': 'FACTURA ELECTRÓNICA',
    '34': 'FACTURA NO AFECTA O EXENTA ELECTRÓNICA',
    '39': 'BOLETA ELECTRÓNICA',
    '41': 'BOLETA NO AFECTA O EXENTA ELECTRÓNICA',
    '43': 'LIQUIDACIÓN-FACTURA ELECTRÓNICA',
    '46': 'FACTURA DE COMPRA ELECTRÓNICA',
    '52': 'GUÍA DE DESPACHO ELECTRÓNICA',
    '56': 'NOTA DE DÉBITO ELECTRÓNICA',
    '61': 'NOTA DE CRÉDITO ELECTRÓNICA',
  }

  doc.fontSize(18).text(docNames[tipoDte] || 'DOCUMENTO TRIBUTARIO ELECTRÓNICO', 50, 50)
  doc.fontSize(12).text('RUT Emisor: ' + rutEmisor, 50, 80)
  doc.text(rznSoc)
  if (dirOrigen) doc.text(dirOrigen)
  if (cmnaOrigen) doc.text(cmnaOrigen + (ciudadOrigen ? ', ' + ciudadOrigen : ''))

  doc.moveDown()
  doc.text('Folio: ' + folio)
  doc.text('Fecha Emisión: ' + fchEmis)

  doc.moveDown()
  doc.fontSize(14).text('Receptor')
  doc.fontSize(12)
  doc.text('RUT: ' + rutRecep)
  doc.text(rznSocRecep)
  if (dirRecep) doc.text(dirRecep)
  if (cmnaRecep) doc.text(cmnaRecep + (ciudadRecep ? ', ' + ciudadRecep : ''))

  doc.moveDown()
  doc.fontSize(14).text('Detalle')
  doc.fontSize(12)
  details.forEach((item) => {
    doc.text(
      item.nro +
        '. ' +
        item.name +
        ' — ' +
        item.qty +
        ' x $' +
        Number(item.price).toLocaleString('es-CL') +
        ' = $' +
        Number(item.total).toLocaleString('es-CL'),
    )
  })

  doc.moveDown()
  doc.fontSize(14).text('Totales')
  doc.fontSize(12)
  doc.text('Neto: $' + Number(mntNeto).toLocaleString('es-CL'))
  doc.text('IVA (19%): $' + Number(iva).toLocaleString('es-CL'))
  doc.text('Total: $' + Number(mntTotal).toLocaleString('es-CL'))

    doc.end()
  })
}
