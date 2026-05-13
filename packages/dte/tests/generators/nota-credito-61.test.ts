import { describe, it, expect } from 'vitest'
import { generateNotaCredito61 } from '../../src/generators/nota-credito-61'
import { DocumentData } from '../../src/types'

const baseDoc: DocumentData = {
  type: 61,
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
  items: [{ description: 'Devolución servicio', quantity: 1, unitPrice: 100000 }],
  paymentMethod: 'CONTADO',
  emittedAt: '2026-05-13',
  references: [
    {
      type: 33,
      folio: 42,
      date: '2026-05-10',
      reason: 'Anulación',
    },
  ],
}

describe('generateNotaCredito61', () => {
  it('produces XML with correct encoding declaration', () => {
    const xml = generateNotaCredito61(baseDoc)
    expect(xml).toContain('encoding="ISO-8859-1"')
  })

  it('includes TipoDTE 61', () => {
    const xml = generateNotaCredito61(baseDoc)
    expect(xml).toContain('<TipoDTE>61</TipoDTE>')
  })

  it('includes reference to original document', () => {
    const xml = generateNotaCredito61(baseDoc)
    expect(xml).toContain('<Referencia>')
    expect(xml).toContain('<TpoDocRef>33</TpoDocRef>')
    expect(xml).toContain('<FolioRef>42</FolioRef>')
    expect(xml).toContain('<FchRef>2026-05-10</FchRef>')
    expect(xml).toContain('<CodRef>1</CodRef>')
    expect(xml).toContain('</Referencia>')
  })

  it('includes correct totals', () => {
    const xml = generateNotaCredito61(baseDoc)
    expect(xml).toContain('<MntNeto>100000</MntNeto>')
    expect(xml).toContain('<TasaIVA>19</TasaIVA>')
    expect(xml).toContain('<IVA>19000</IVA>')
    expect(xml).toContain('<MntTotal>119000</MntTotal>')
  })
})
