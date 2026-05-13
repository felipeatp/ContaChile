import { describe, it, expect } from 'vitest'
import { generateNotaDebito56 } from '../../src/generators/nota-debito-56'
import { DocumentData } from '../../src/types'

const baseDoc: DocumentData = {
  type: 56,
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
  items: [{ description: 'Cargo adicional', quantity: 1, unitPrice: 50000 }],
  paymentMethod: 'CONTADO',
  emittedAt: '2026-05-13',
  references: [
    {
      type: 33,
      folio: 42,
      date: '2026-05-10',
      reason: 'Corrección',
    },
  ],
}

describe('generateNotaDebito56', () => {
  it('produces XML with correct encoding declaration', () => {
    const xml = generateNotaDebito56(baseDoc)
    expect(xml).toContain('encoding="ISO-8859-1"')
  })

  it('includes TipoDTE 56', () => {
    const xml = generateNotaDebito56(baseDoc)
    expect(xml).toContain('<TipoDTE>56</TipoDTE>')
  })

  it('includes reference to original document', () => {
    const xml = generateNotaDebito56(baseDoc)
    expect(xml).toContain('<Referencia>')
    expect(xml).toContain('<TpoDocRef>33</TpoDocRef>')
    expect(xml).toContain('<FolioRef>42</FolioRef>')
    expect(xml).toContain('<FchRef>2026-05-10</FchRef>')
    expect(xml).toContain('<CodRef>2</CodRef>')
    expect(xml).toContain('</Referencia>')
  })

  it('includes correct totals', () => {
    const xml = generateNotaDebito56(baseDoc)
    expect(xml).toContain('<MntNeto>50000</MntNeto>')
    expect(xml).toContain('<TasaIVA>19</TasaIVA>')
    expect(xml).toContain('<IVA>9500</IVA>')
    expect(xml).toContain('<MntTotal>59500</MntTotal>')
  })
})
