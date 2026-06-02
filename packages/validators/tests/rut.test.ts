import { describe, it, expect } from 'vitest'
import { validateRUT, formatRUT } from '../src/rut'

describe('validateRUT', () => {
  it('valida un RUT correcto con puntos y guión', () => {
    expect(validateRUT('12.345.678-5')).toBe(true)
  })

  it('valida un RUT correcto sin formato', () => {
    expect(validateRUT('12345678-5')).toBe(true)
  })

  it('rechaza un RUT con dígito verificador incorrecto', () => {
    expect(validateRUT('12.345.678-6')).toBe(false)
  })

  it('rechaza RUT malformado', () => {
    expect(validateRUT('not-a-rut')).toBe(false)
    expect(validateRUT('')).toBe(false)
  })

  it('valida todos los dígitos verificadores posibles (0-9 y K)', () => {
    // Cada RUT fue pre-calculado con el algoritmo mod-11 chileno
    const casesValid = [
      '10010001-0',  // sum=11, 11%11=0 → DV=0
      '10100000-1',  // sum=10 → DV=1
      '10010000-2',  // sum=9  → DV=2
      '10001000-3',  // sum=8  → DV=3
      '10000100-4',  // sum=7  → DV=4
      '12345678-5',  // DV=5 (conocido)
      '10000001-6',  // sum=5  → DV=6
      '00000002-7',  // sum=4  → DV=7
      '10000000-8',  // sum=3  → DV=8
      '00000001-9',  // sum=2  → DV=9
      '8888888-K',   // 7 dígitos, sum=232, 232%11=1 → DV=K
    ]
    for (const rut of casesValid) {
      expect(validateRUT(rut), `${rut} debe ser válido`).toBe(true)
    }
  })

  it('rechaza los mismos RUTs con DV cambiado en 1', () => {
    const casesInvalid = [
      '10010001-1',  // DV correcto es 0
      '10100000-2',  // DV correcto es 1
      '12345678-6',  // DV correcto es 5
      '8888888-0',   // DV correcto es K
    ]
    for (const rut of casesInvalid) {
      expect(validateRUT(rut), `${rut} debe ser inválido`).toBe(false)
    }
  })

  it('acepta DV=K en mayúscula y minúscula', () => {
    expect(validateRUT('8888888-K')).toBe(true)
    expect(validateRUT('8888888-k')).toBe(true)
  })

  it('rechaza RUT con menos de 7 dígitos en el cuerpo', () => {
    expect(validateRUT('123456-5')).toBe(false)
  })

  it('rechaza RUT con letras en el cuerpo', () => {
    expect(validateRUT('1234567A-5')).toBe(false)
  })
})

describe('formatRUT', () => {
  it('formatea RUT con puntos y guión', () => {
    expect(formatRUT('123456785')).toBe('12.345.678-5')
  })

  it('formatea RUT de 7 dígitos', () => {
    expect(formatRUT('8888888K')).toBe('8.888.888-K')
  })
})
