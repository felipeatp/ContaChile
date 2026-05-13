import { describe, it, expect } from 'vitest'
import { generateLiquidacionFactura43 } from '../../src/generators/liquidacion-factura-43'
import { DocumentData } from '../../src/types'

const baseDoc: DocumentData = {
  type: 43,
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
  items: [{ description: 'Servicio de desarrollo web', quantity: 1, unitPrice: 100000 }],
  paymentMethod: 'CONTADO',
  emittedAt: '2026-05-13',
}

describe('generateLiquidacionFactura43', () => {
  it('produces XML with correct encoding declaration', () => {
    const xml = generateLiquidacionFactura43(baseDoc)
    expect(xml).toContain('encoding="ISO-8859-1"')
  })

  it('includes TipoDTE 43', () => {
    const xml = generateLiquidacionFactura43(baseDoc)
    expect(xml).toContain('<TipoDTE>43</TipoDTE>')
  })

  it('includes correct totals', () => {
    const xml = generateLiquidacionFactura43(baseDoc)
    expect(xml).toContain('<MntNeto>100000</MntNeto>')
    expect(xml).toContain('<TasaIVA>19</TasaIVA>')
    expect(xml).toContain('<IVA>19000</IVA>')
    expect(xml).toContain('<MntTotal>119000</MntTotal>')
  })
})
