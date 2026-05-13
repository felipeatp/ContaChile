import { describe, it, expect } from 'vitest'
import { runPipeline } from '../src/pipeline'
import { registerType } from '../src/registry'
import { DocumentData, DocumentTypePlugin } from '../src/types'
import forge from 'node-forge'

function generateTestKey(): string {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048 })
  return forge.pki.privateKeyToPem(keys.privateKey)
}

function fakeXML(): string {
  return `<?xml version="1.0" encoding="ISO-8859-1"?>
<DTE version="1.0" xmlns="http://www.sii.cl/SiiDte">
  <Documento ID="T1">
    <Encabezado>
      <IdDoc><TipoDTE>33</TipoDTE><Folio>1</Folio><FchEmis>2024-01-15</FchEmis></IdDoc>
      <Emisor><RUTEmisor>76.354.771-K</RUTEmisor><RznSoc>Co</RznSoc><DirOrigen>A</DirOrigen><CmnaOrigen>C</CmnaOrigen><CiudadOrigen>S</CiudadOrigen></Emisor>
      <Receptor><RUTRecep>12.345.678-5</RUTRecep><RznSocRecep>Re</RznSocRecep><DirRecep>A</DirRecep></Receptor>
      <Totales><MntNeto>100</MntNeto><IVA>19</IVA><MntTotal>119</MntTotal></Totales>
    </Encabezado>
    <Detalle><NroLinDet>1</NroLinDet><NmbItem>X</NmbItem><QtyItem>1</QtyItem><PrcItem>100</PrcItem><MontoItem>100</MontoItem></Detalle>
  </Documento>
</DTE>`
}

const fakePlugin: DocumentTypePlugin = {
  code: 33,
  name: 'Factura',
  validate: () => ({ valid: true }),
  generateXML: fakeXML,
  generatePDF: async () => Buffer.from('pdf'),
  requiredFields: [],
}

registerType(fakePlugin)

const invalidPlugin: DocumentTypePlugin = {
  code: 99,
  name: 'Invalid',
  validate: () => ({ valid: true }),
  generateXML: () => '<?xml version="1.0"?><DTE><Documento ID="T2"></Documento></DTE>',
  generatePDF: async () => Buffer.from('pdf'),
  requiredFields: [],
}

registerType(invalidPlugin)

describe('runPipeline', () => {
  it('returns signed XML and PDF', async () => {
    const data: DocumentData = {
      type: 33,
      folio: 1,
      company: { rut: '76.354.771-K', name: 'Co', address: 'A', commune: 'C', city: 'S', economicActivity: '1', cert: generateTestKey() },
      receiver: { rut: '12.345.678-5', name: 'Re', address: 'A', commune: 'C', city: 'S' },
      items: [{ description: 'X', quantity: 1, unitPrice: 100 }],
      paymentMethod: 'CONTADO',
      emittedAt: '2026-05-01',
    }
    const result = await runPipeline(data)
    expect(result.xml).toContain('<?xml')
    expect(result.xml).toContain('<Signature')
    expect(result.pdf.toString()).toBe('pdf')
  })

  it('throws when XSD validation fails', async () => {
    const data: DocumentData = {
      type: 99,
      folio: 1,
      company: { rut: '76.354.771-K', name: 'Co', address: 'A', commune: 'C', city: 'S', economicActivity: '1', cert: generateTestKey() },
      receiver: { rut: '12.345.678-5', name: 'Re', address: 'A', commune: 'C', city: 'S' },
      items: [{ description: 'X', quantity: 1, unitPrice: 100 }],
      paymentMethod: 'CONTADO',
      emittedAt: '2026-05-01',
    }
    await expect(runPipeline(data)).rejects.toThrow('XSD validation failed')
  })
})
