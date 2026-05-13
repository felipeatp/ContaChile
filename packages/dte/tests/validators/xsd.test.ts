import { describe, it, expect } from 'vitest'
import { validateXSD } from '../../src/validators/xsd'
import { generateFactura33 } from '../../src/generators/factura-33'
import { generateFactura34 } from '../../src/generators/factura-34'
import { generateBoleta39 } from '../../src/generators/boleta-39'
import { generateNotaCredito61 } from '../../src/generators/nota-credito-61'
import { DocumentData } from '../../src/types'

const baseDoc: DocumentData = {
  type: 33,
  folio: 1,
  company: {
    rut: '76354771-K',
    name: 'Mi Empresa SpA',
    address: 'Av. Providencia 123',
    commune: 'Providencia',
    city: 'Santiago',
    economicActivity: '620100',
    cert: 'fake',
  },
  receiver: {
    rut: '12345678-9',
    name: 'Cliente Ejemplo Ltda',
    address: 'Calle Falsa 456',
    commune: 'Las Condes',
    city: 'Santiago',
  },
  items: [{ description: 'Servicio', quantity: 1, unitPrice: 100000 }],
  paymentMethod: 'CONTADO',
  emittedAt: '2024-01-15',
}

function addSignature(xml: string): string {
  return xml.replace(
    '</DTE>',
    '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignatureValue>STUB</SignatureValue></Signature></DTE>'
  )
}

describe('validateXSD', () => {
  it('passes for valid Factura 33 XML', () => {
    const xml = addSignature(generateFactura33(baseDoc))
    const result = validateXSD(xml)
    expect(result.valid).toBe(true)
    expect(result.errors).toBeUndefined()
  })

  it('fails when root element is not DTE', () => {
    const xml = '<?xml version="1.0"?><FakeRoot></FakeRoot>'
    const result = validateXSD(xml)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing or invalid root <DTE> element')
  })

  it('fails when Documento ID is missing', () => {
    const xml = '<?xml version="1.0"?><DTE version="1.0" xmlns="http://www.sii.cl/SiiDte"><Documento></Documento></DTE>'
    const result = validateXSD(xml)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing Documento ID attribute')
  })

  it('fails when Encabezado is missing', () => {
    const xml = '<?xml version="1.0"?><DTE version="1.0" xmlns="http://www.sii.cl/SiiDte"><Documento ID="T1"></Documento></DTE>'
    const result = validateXSD(xml)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing <Encabezado>')
  })

  it('fails when TipoDTE is invalid', () => {
    const xml = addSignature(generateFactura33({ ...baseDoc, type: 99 }))
    const result = validateXSD(xml)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Invalid TipoDTE: 99')
  })

  it('fails when Emisor fields are missing', () => {
    const xml = addSignature(generateFactura33(baseDoc)).replace('<RUTEmisor>', '<RUTEmisorX>')
    const result = validateXSD(xml)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing <RUTEmisor>')
  })

  it('fails when Signature is missing', () => {
    const xml = generateFactura33(baseDoc)
    const result = validateXSD(xml)
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Missing <Signature> element')
  })

  it('passes for valid Factura 34 XML', () => {
    const xml = addSignature(generateFactura34({ ...baseDoc, type: 34 }))
    const result = validateXSD(xml)
    expect(result.valid).toBe(true)
  })

  it('passes for valid Boleta 39 XML', () => {
    const xml = addSignature(generateBoleta39({ ...baseDoc, type: 39 }))
    const result = validateXSD(xml)
    expect(result.valid).toBe(true)
  })

  it('passes for valid Nota de Crédito 61 XML', () => {
    const xml = addSignature(generateNotaCredito61({ ...baseDoc, type: 61, references: [{ folio: 1, type: 33, date: '2024-01-15', reason: 'Anulación' }] }))
    const result = validateXSD(xml)
    expect(result.valid).toBe(true)
  })
})
