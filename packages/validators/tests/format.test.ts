import { describe, it, expect } from 'vitest'
import { formatCLP, parseCLP, formatPercent } from '../src/format'

describe('formatCLP', () => {
  it('formatea entero positivo con punto miles y prefijo $', () => {
    expect(formatCLP(1847293)).toBe('$ 1.847.293')
  })

  it('formatea cero', () => {
    expect(formatCLP(0)).toBe('$ 0')
  })

  it('formatea negativo con guion antes del prefijo', () => {
    expect(formatCLP(-119000)).toBe('-$ 119.000')
  })

  it('redondea decimales (CLP no usa centavos)', () => {
    expect(formatCLP(1234.7)).toBe('$ 1.235')
  })

  it('null/undefined -> "$ 0"', () => {
    expect(formatCLP(null)).toBe('$ 0')
    expect(formatCLP(undefined)).toBe('$ 0')
  })

  it('soporta NaN -> "$ 0"', () => {
    expect(formatCLP(NaN)).toBe('$ 0')
  })

  it('Infinity -> "$ 0"', () => {
    expect(formatCLP(Infinity)).toBe('$ 0')
    expect(formatCLP(-Infinity)).toBe('$ 0')
  })
})

describe('parseCLP', () => {
  it('parsea "$ 1.847.293" -> 1847293', () => {
    expect(parseCLP('$ 1.847.293')).toBe(1847293)
  })

  it('parsea "$1.000.000" sin espacio', () => {
    expect(parseCLP('$1.000.000')).toBe(1000000)
  })

  it('parsea solo dígitos', () => {
    expect(parseCLP('100000')).toBe(100000)
  })

  it('parsea con espacios sobrantes', () => {
    expect(parseCLP('  $ 119.000  ')).toBe(119000)
  })

  it('parsea negativo "-$ 50.000"', () => {
    expect(parseCLP('-$ 50.000')).toBe(-50000)
  })

  it('string vacío -> 0', () => {
    expect(parseCLP('')).toBe(0)
    expect(parseCLP('   ')).toBe(0)
  })

  it('texto no numérico -> 0', () => {
    expect(parseCLP('abc')).toBe(0)
  })
})

describe('formatPercent', () => {
  it('formatea 0.123 -> "12,3 %" (es-CL coma decimal)', () => {
    expect(formatPercent(0.123)).toBe('12,3 %')
  })

  it('formatea entero 1 -> "100,0 %"', () => {
    expect(formatPercent(1)).toBe('100,0 %')
  })

  it('soporta dígitos custom', () => {
    expect(formatPercent(0.12345, 2)).toBe('12,35 %')
  })

  it('null -> "0,0 %"', () => {
    expect(formatPercent(null)).toBe('0,0 %')
  })

  it('NaN -> "0,0 %"', () => {
    expect(formatPercent(NaN)).toBe('0,0 %')
  })

  it('Infinity -> "0,0 %"', () => {
    expect(formatPercent(Infinity)).toBe('0,0 %')
    expect(formatPercent(-Infinity)).toBe('0,0 %')
  })
})
