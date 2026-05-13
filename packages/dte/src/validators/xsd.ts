import { ValidationResult } from '../types'

const VALID_TYPES = new Set([33, 34, 39, 41, 43, 46, 52, 56, 61])

function extractTag(xml: string, tag: string): string {
  const open = '<' + tag + '>'
  const close = '</' + tag + '>'
  const start = xml.indexOf(open)
  if (start === -1) return ''
  const end = xml.indexOf(close, start)
  if (end === -1) return ''
  return xml.slice(start + open.length, end)
}

function hasTag(xml: string, tag: string): boolean {
  return xml.indexOf('<' + tag + '>') !== -1 || xml.indexOf('<' + tag + ' ') !== -1
}

function extractAttr(xml: string, tag: string, attr: string): string {
  const openStart = xml.indexOf('<' + tag)
  if (openStart === -1) return ''
  const openEnd = xml.indexOf('>', openStart)
  if (openEnd === -1) return ''
  const openTag = xml.slice(openStart, openEnd + 1)
  const attrPrefix = attr + '="'
  const attrStart = openTag.indexOf(attrPrefix)
  if (attrStart === -1) return ''
  const valueStart = attrStart + attrPrefix.length
  const valueEnd = openTag.indexOf('"', valueStart)
  if (valueEnd === -1) return ''
  return openTag.slice(valueStart, valueEnd)
}

export function validateXSD(xml: string): ValidationResult {
  const errors: string[] = []

  // Root element check
  if (!hasTag(xml, 'DTE') || xml.indexOf('xmlns="http://www.sii.cl/SiiDte"') === -1) {
    errors.push('Missing or invalid root <DTE> element')
    return { valid: false, errors }
  }

  // Documento ID
  const docId = extractAttr(xml, 'Documento', 'ID')
  if (!docId) {
    errors.push('Missing Documento ID attribute')
  }

  // Encabezado
  if (!hasTag(xml, 'Encabezado')) {
    errors.push('Missing <Encabezado>')
    return { valid: false, errors }
  }

  const encabezadoStart = xml.indexOf('<Encabezado>')
  const encabezadoEnd = xml.indexOf('</Encabezado>', encabezadoStart)
  if (encabezadoStart === -1 || encabezadoEnd === -1) {
    errors.push('Missing <Encabezado>')
    return { valid: false, errors }
  }
  const encabezado = xml.slice(encabezadoStart, encabezadoEnd + 13)

  // IdDoc
  if (!hasTag(encabezado, 'IdDoc')) {
    errors.push('Missing <IdDoc>')
  } else {
    const tipoDte = extractTag(encabezado, 'TipoDTE')
    if (!tipoDte) {
      errors.push('Missing <TipoDTE>')
    } else if (!VALID_TYPES.has(Number(tipoDte))) {
      errors.push('Invalid TipoDTE: ' + tipoDte)
    }

    if (!extractTag(encabezado, 'Folio')) {
      errors.push('Missing <Folio>')
    }
    if (!extractTag(encabezado, 'FchEmis')) {
      errors.push('Missing <FchEmis>')
    }
  }

  // Emisor
  if (!hasTag(encabezado, 'Emisor')) {
    errors.push('Missing <Emisor>')
  } else {
    const emisorStart = encabezado.indexOf('<Emisor>')
    const emisorEnd = encabezado.indexOf('</Emisor>', emisorStart)
    const emisor = encabezado.slice(emisorStart, emisorEnd + 9)
    if (!extractTag(emisor, 'RUTEmisor')) errors.push('Missing <RUTEmisor>')
    if (!extractTag(emisor, 'RznSoc')) errors.push('Missing <RznSoc>')
    if (!extractTag(emisor, 'DirOrigen')) errors.push('Missing <DirOrigen>')
    if (!extractTag(emisor, 'CmnaOrigen')) errors.push('Missing <CmnaOrigen>')
    if (!extractTag(emisor, 'CiudadOrigen')) errors.push('Missing <CiudadOrigen>')
  }

  // Receptor
  if (!hasTag(encabezado, 'Receptor')) {
    errors.push('Missing <Receptor>')
  } else {
    const receptorStart = encabezado.indexOf('<Receptor>')
    const receptorEnd = encabezado.indexOf('</Receptor>', receptorStart)
    const receptor = encabezado.slice(receptorStart, receptorEnd + 11)
    if (!extractTag(receptor, 'RUTRecep')) errors.push('Missing <RUTRecep>')
    if (!extractTag(receptor, 'RznSocRecep')) errors.push('Missing <RznSocRecep>')
    if (!extractTag(receptor, 'DirRecep')) errors.push('Missing <DirRecep>')
  }

  // Totales
  if (!hasTag(encabezado, 'Totales')) {
    errors.push('Missing <Totales>')
  } else {
    const totalesStart = encabezado.indexOf('<Totales>')
    const totalesEnd = encabezado.indexOf('</Totales>', totalesStart)
    const totales = encabezado.slice(totalesStart, totalesEnd + 10)
    const tipoDte = extractTag(encabezado, 'TipoDTE')
    const taxableTypes = new Set([33, 39, 43, 46, 56, 61])
    const exemptTypes = new Set([34, 41, 52])

    if (tipoDte && taxableTypes.has(Number(tipoDte))) {
      if (!extractTag(totales, 'MntNeto')) errors.push('Missing <MntNeto>')
      if (!extractTag(totales, 'IVA')) errors.push('Missing <IVA>')
      if (!extractTag(totales, 'MntTotal')) errors.push('Missing <MntTotal>')
    } else if (tipoDte && exemptTypes.has(Number(tipoDte))) {
      if (!extractTag(totales, 'MntExe')) errors.push('Missing <MntExe>')
      if (!extractTag(totales, 'MntTotal')) errors.push('Missing <MntTotal>')
    }
  }

  // Detalle
  if (!hasTag(xml, 'Detalle')) {
    errors.push('Missing <Detalle>')
  } else {
    const detalleStart = xml.indexOf('<Detalle>')
    const detalleEnd = xml.indexOf('</Detalle>', detalleStart)
    if (detalleStart !== -1 && detalleEnd !== -1) {
      const detalle = xml.slice(detalleStart, detalleEnd + 10)
      if (!extractTag(detalle, 'NroLinDet')) errors.push('Missing <NroLinDet>')
      if (!extractTag(detalle, 'NmbItem')) errors.push('Missing <NmbItem>')
      if (!extractTag(detalle, 'QtyItem')) errors.push('Missing <QtyItem>')
      if (!extractTag(detalle, 'PrcItem')) errors.push('Missing <PrcItem>')
      if (!extractTag(detalle, 'MontoItem')) errors.push('Missing <MontoItem>')
    }
  }

  // Signature
  if (!hasTag(xml, 'Signature')) {
    errors.push('Missing <Signature> element')
  }

  return { valid: errors.length === 0, errors: errors.length > 0 ? errors : undefined }
}
