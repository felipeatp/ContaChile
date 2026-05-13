import { describe, it, expect } from 'vitest'
import { validateRUT, formatRUT } from '../src/rut'

describe('validateRUT', () => {
  it('validates a correct RUT', () => {
    expect(validateRUT('12.345.678-5')).toBe(true)
    expect(validateRUT('12345678-5')).toBe(true)
  })

  it('rejects an invalid RUT', () => {
    expect(validateRUT('12.345.678-6')).toBe(false)
  })

  it('rejects malformed RUT', () => {
    expect(validateRUT('not-a-rut')).toBe(false)
    expect(validateRUT('')).toBe(false)
  })
})

describe('formatRUT', () => {
  it('formats RUT with dots and dash', () => {
    expect(formatRUT('123456785')).toBe('12.345.678-5')
  })
})
