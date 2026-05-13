import { describe, it, expect } from 'vitest'
import { validateBusinessRules } from '../../src/validators/business'
import { DocumentData } from '../../src/types'

const baseDoc: DocumentData = {
  type: 33,
  folio: 1,
  company: {
    rut: '76.354.771-K',
    name: 'Test SpA',
    address: 'Av. Providencia 123',
    commune: 'Providencia',
    city: 'Santiago',
    economicActivity: '620100',
    cert: 'fake-cert',
  },
  receiver: {
    rut: '12.345.678-5',
    name: 'Cliente',
    address: 'Calle 456',
    commune: 'Las Condes',
    city: 'Santiago',
  },
  items: [{ description: 'Servicio', quantity: 1, unitPrice: 100000 }],
  paymentMethod: 'CONTADO',
  emittedAt: '2026-05-01',
}

describe('validateBusinessRules', () => {
  it('passes for valid document', () => {
    const result = validateBusinessRules(baseDoc)
    expect(result.valid).toBe(true)
  })

  it('fails for invalid RUT emisor', () => {
    const result = validateBusinessRules({
      ...baseDoc,
      company: { ...baseDoc.company, rut: '11.111.111-2' },
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('RUT emisor inválido')
  })

  it('fails for invalid RUT receptor', () => {
    const result = validateBusinessRules({
      ...baseDoc,
      receiver: { ...baseDoc.receiver, rut: '11.111.111-2' },
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('RUT receptor inválido')
  })

  it('fails for future date', () => {
    const result = validateBusinessRules({
      ...baseDoc,
      emittedAt: '2099-01-15',
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Fecha de emisión no puede ser futura')
  })

  it('fails for date older than 30 days', () => {
    const result = validateBusinessRules({
      ...baseDoc,
      emittedAt: '2020-01-15',
    })
    expect(result.valid).toBe(false)
    expect(result.errors).toContain('Fecha de emisión no puede ser mayor a 30 días pasada')
  })
})
