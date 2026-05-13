import { describe, it, expect } from 'vitest'
import { generateFactura34 } from '../../src/generators/factura-34'
import { DocumentData } from '../../src/types'

const baseDoc: DocumentData = {
  type: 34,
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

describe('generateFactura34', () => {
  it('produces XML with correct encoding declaration', () => {
    const xml = generateFactura34(baseDoc)
    expect(xml).toContain('encoding="ISO-8859-1"')
  })

  it('includes TipoDTE 34', () => {
    const xml = generateFactura34(baseDoc)
    expect(xml).toContain('<TipoDTE>34</TipoDTE>')
  })

  it('includes exenta totals without IVA', () => {
    const xml = generateFactura34(baseDoc)
    expect(xml).toContain('<MntExe>100000</MntExe>')
    expect(xml).toContain('<MntTotal>100000</MntTotal>')
    expect(xml).not.toContain('<MntNeto>')
    expect(xml).not.toContain('<TasaIVA>')
    expect(xml).not.toContain('<IVA>')
  })
})
