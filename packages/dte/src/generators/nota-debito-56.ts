import { create } from 'xmlbuilder2'
import { DocumentData } from '../types'
import { calcularIVA, calcularTotal } from '@contachile/validators'

function mapReasonToCodRef(reason: string): string {
  const map: Record<string, string> = {
    'Anulación': '1',
    'Corrección': '2',
    'Devolución': '3',
  }
  return map[reason] ?? '1'
}

export function generateNotaDebito56(data: DocumentData): string {
  const neto = data.items.reduce((sum, item) => sum + item.quantity * item.unitPrice, 0)
  const iva = calcularIVA(neto)
  const total = calcularTotal(neto)

  const doc = create({ version: '1.0', encoding: 'ISO-8859-1' })
    .ele('DTE', { version: '1.0', xmlns: 'http://www.sii.cl/SiiDte' })
    .ele('Documento', { ID: `DTE-${data.company.rut.replace(/[^0-9K]/gi, '')}-${data.type}-${data.folio}` })
    .ele('Encabezado')
    .ele('IdDoc')
    .ele('TipoDTE').txt(String(data.type)).up()
    .ele('Folio').txt(String(data.folio)).up()
    .ele('FchEmis').txt(data.emittedAt).up()
    .ele('FmaPago').txt(data.paymentMethod === 'CONTADO' ? '1' : '2').up()
    .up()
    .ele('Emisor')
    .ele('RUTEmisor').txt(data.company.rut).up()
    .ele('RznSoc').txt(data.company.name).up()
    .ele('GiroEmis').txt('Servicios').up()
    .ele('Acteco').txt(data.company.economicActivity).up()
    .ele('DirOrigen').txt(data.company.address).up()
    .ele('CmnaOrigen').txt(data.company.commune).up()
    .ele('CiudadOrigen').txt(data.company.city).up()
    .up()
    .ele('Receptor')
    .ele('RUTRecep').txt(data.receiver.rut).up()
    .ele('RznSocRecep').txt(data.receiver.name).up()
    .ele('GiroRecep').txt('Comercio').up()
    .ele('DirRecep').txt(data.receiver.address).up()
    .ele('CmnaRecep').txt(data.receiver.commune).up()
    .ele('CiudadRecep').txt(data.receiver.city).up()
    .up()
    .ele('Totales')
    .ele('MntNeto').txt(String(neto)).up()
    .ele('TasaIVA').txt('19').up()
    .ele('IVA').txt(String(iva)).up()
    .ele('MntTotal').txt(String(total)).up()
    .up()
    .up()

  data.items.forEach((item, index) => {
    const itemTotal = item.quantity * item.unitPrice
    doc.ele('Detalle')
      .ele('NroLinDet').txt(String(index + 1)).up()
      .ele('NmbItem').txt(item.description).up()
      .ele('QtyItem').txt(String(item.quantity)).up()
      .ele('PrcItem').txt(String(item.unitPrice)).up()
      .ele('MontoItem').txt(String(itemTotal)).up()
      .up()
  })

  data.references?.forEach((ref) => {
    doc.ele('Referencia')
      .ele('TpoDocRef').txt(String(ref.type)).up()
      .ele('FolioRef').txt(String(ref.folio)).up()
      .ele('FchRef').txt(ref.date).up()
      .ele('CodRef').txt(mapReasonToCodRef(ref.reason)).up()
      .up()
  })

  return doc.end({ headless: false })
}
