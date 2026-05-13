import { describe, it, expect } from 'vitest'
import { generateGuiaDespacho52 } from '../../src/generators/guia-despacho-52'
import { DocumentData } from '../../src/types'

const baseDoc: DocumentData = {
  type: 52,
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
  items: [{ description: 'Producto A', quantity: 2, unitPrice: 50000 }],
  paymentMethod: 'CONTADO',
  emittedAt: '2026-05-13',
  transport: {
    patente: 'AB-CD-12',
    rutTransporter: '98765432-1',
    direction: 'Norte',
    commune: 'Santiago',
    city: 'Santiago',
  },
}

describe('generateGuiaDespacho52', () => {
  it('produces XML with correct encoding declaration', () => {
    const xml = generateGuiaDespacho52(baseDoc)
    expect(xml).toContain('encoding="ISO-8859-1"')
  })

  it('includes TipoDTE 52', () => {
    const xml = generateGuiaDespacho52(baseDoc)
    expect(xml).toContain('<TipoDTE>52</TipoDTE>')
  })

  it('includes transport section', () => {
    const xml = generateGuiaDespacho52(baseDoc)
    expect(xml).toContain('<Transporte>')
    expect(xml).toContain('<Patente>AB-CD-12</Patente>')
    expect(xml).toContain('<RUTTrans>98765432-1</RUTTrans>')
    expect(xml).toContain('<DirDest>Calle Falsa 456</DirDest>')
    expect(xml).toContain('<CmnaDest>Las Condes</CmnaDest>')
    expect(xml).toContain('<CiudadDest>Santiago</CiudadDest>')
    expect(xml).toContain('</Transporte>')
  })

  it('includes correct totals', () => {
    const xml = generateGuiaDespacho52(baseDoc)
    expect(xml).toContain('<MntNeto>100000</MntNeto>')
    expect(xml).toContain('<TasaIVA>19</TasaIVA>')
    expect(xml).toContain('<IVA>19000</IVA>')
    expect(xml).toContain('<MntTotal>119000</MntTotal>')
  })
})
