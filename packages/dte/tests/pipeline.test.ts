import { describe, it, expect } from 'vitest'
import { runPipeline } from '../src/pipeline'
import { registerType } from '../src/registry'
import { DocumentData, DocumentTypePlugin } from '../src/types'
import forge from 'node-forge'

function generateTestKey(): string {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048 })
  return forge.pki.privateKeyToPem(keys.privateKey)
}

const fakePlugin: DocumentTypePlugin = {
  code: 33,
  name: 'Factura',
  validate: () => ({ valid: true }),
  generateXML: () => '<?xml version="1.0"?><DTE><Documento ID="T1"></Documento></DTE>',
  generatePDF: () => Buffer.from('pdf'),
  requiredFields: [],
}

registerType(fakePlugin)

describe('runPipeline', () => {
  it('returns signed XML and PDF', () => {
    const data: DocumentData = {
      type: 33,
      folio: 1,
      company: { rut: '76.354.771-K', name: 'Co', address: 'A', commune: 'C', city: 'S', economicActivity: '1', cert: generateTestKey() },
      receiver: { rut: '12.345.678-5', name: 'Re', address: 'A', commune: 'C', city: 'S' },
      items: [{ description: 'X', quantity: 1, unitPrice: 100 }],
      paymentMethod: 'CONTADO',
      emittedAt: '2026-05-01',
    }
    const result = runPipeline(data)
    expect(result.xml).toContain('<?xml')
    expect(result.xml).toContain('<Signature')
    expect(result.pdf.toString()).toBe('pdf')
  })
})
