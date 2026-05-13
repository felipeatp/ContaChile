import { describe, it, expect } from 'vitest'
import { calcularIVA, calcularTotal } from '../src/tax'

describe('calcularIVA', () => {
  it('calculates 19% IVA rounded down', () => {
    expect(calcularIVA(100000)).toBe(19000)
    expect(calcularIVA(99999)).toBe(18999)
    expect(calcularIVA(1)).toBe(0)
  })
})

describe('calcularTotal', () => {
  it('returns neto + IVA', () => {
    expect(calcularTotal(100000)).toBe(119000)
  })
})
