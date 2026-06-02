import { describe, it, expect } from 'vitest'
import { calcularIVA, calcularTotal, calcularImpuestoRenta } from '../src/tax'

describe('calcularIVA', () => {
  it('calcula el 19% redondeado hacia abajo', () => {
    expect(calcularIVA(100_000)).toBe(19_000)
    expect(calcularIVA(99_999)).toBe(18_999)
    expect(calcularIVA(1)).toBe(0) // floor(0.19) = 0
  })

  it('retorna 0 para neto = 0', () => {
    expect(calcularIVA(0)).toBe(0)
  })

  it('funciona con montos grandes (millones de CLP)', () => {
    // 1_000_000_000 * 0.19 = 190_000_000 exacto
    expect(calcularIVA(1_000_000_000)).toBe(190_000_000)
  })

  it('retorna valor negativo para neto negativo (nota de crédito)', () => {
    // Math.floor(-1000 * 0.19) = Math.floor(-190) = -190
    expect(calcularIVA(-1_000)).toBe(-190)
  })
})

describe('calcularTotal', () => {
  it('retorna neto + IVA', () => {
    expect(calcularTotal(100_000)).toBe(119_000)
  })

  it('retorna 0 para neto = 0', () => {
    expect(calcularTotal(0)).toBe(0)
  })
})

// UTA = 720_000 CLP
// Tramos:
//   0%:    hasta 15 UTA = 10_800_000
//   4%:    15-30 UTA    = 10_800_000 - 21_600_000
//   8%:    30-50 UTA    = 21_600_000 - 36_000_000
//   13.5%: 50-120 UTA   = 36_000_000 - 86_400_000
//   27%:   > 120 UTA    = > 86_400_000
describe('calcularImpuestoRenta', () => {
  it('retorna 0 para renta = 0', () => {
    expect(calcularImpuestoRenta(0)).toBe(0)
  })

  it('retorna 0 para renta negativa', () => {
    expect(calcularImpuestoRenta(-500_000)).toBe(0)
  })

  it('Tramo 1 (0%): renta 5M — todo exento', () => {
    // 5_000_000 < 10_800_000 → 0%
    expect(calcularImpuestoRenta(5_000_000)).toBe(0)
  })

  it('Tramo 1+2 (0%+4%): renta 15M', () => {
    // 0% sobre 10_800_000 = 0
    // 4% sobre (15_000_000 - 10_800_000) = 4% sobre 4_200_000 = floor(168_000) = 168_000
    expect(calcularImpuestoRenta(15_000_000)).toBe(168_000)
  })

  it('Tramo 2 (4%): renta 25M', () => {
    // 0% sobre 10_800_000 = 0
    // 4% sobre min(14_200_000, 10_800_000) = 4% × 10_800_000 = 432_000
    // 8% sobre (25_000_000 - 21_600_000) = 8% × 3_400_000 = 272_000
    expect(calcularImpuestoRenta(25_000_000)).toBe(704_000)
  })

  it('Tramo 3 (8%): renta 40M', () => {
    // 0%  → 0
    // 4%  sobre 10_800_000 = 432_000
    // 8%  sobre min(18_400_000, 14_400_000) = 8% × 14_400_000 = 1_152_000
    // 13.5% sobre (40_000_000 - 36_000_000) = 13.5% × 4_000_000 = 540_000
    expect(calcularImpuestoRenta(40_000_000)).toBe(2_124_000)
  })

  it('Tramo 3 límite inferior (8%): renta 36M — justo en el inicio del tramo 3', () => {
    // 0%  → 0
    // 4%  × 10_800_000 = 432_000
    // 8%  × 14_400_000 = floor(1_152_000) = 1_152_000
    expect(calcularImpuestoRenta(36_000_000)).toBe(1_584_000)
  })

  it('Tramo 4+5 (13.5%+27%): renta 100M', () => {
    const tax100M = calcularImpuestoRenta(100_000_000)
    const tax80M  = calcularImpuestoRenta(80_000_000)
    expect(tax100M).toBeGreaterThan(tax80M)
    expect(tax100M).toBeGreaterThan(0)
  })

  it('invariante: impuesto es monótono creciente con la renta', () => {
    const rentas = [0, 1_000_000, 10_000_000, 20_000_000, 40_000_000, 80_000_000, 120_000_000]
    for (let i = 1; i < rentas.length; i++) {
      expect(calcularImpuestoRenta(rentas[i])).toBeGreaterThanOrEqual(
        calcularImpuestoRenta(rentas[i - 1])
      )
    }
  })
})
