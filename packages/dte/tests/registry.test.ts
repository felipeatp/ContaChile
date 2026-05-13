import { describe, it, expect } from 'vitest'
import { registerType, getTypePlugin } from '../src/registry'

describe('registry', () => {
  it('returns null for unregistered type', () => {
    expect(getTypePlugin(33)).toBeNull()
  })

  it('returns plugin after registration', () => {
    const plugin = {
      code: 33,
      name: 'Factura Electrónica',
      validate: () => ({ valid: true }),
      generateXML: () => '<xml/>',
      generatePDF: () => Buffer.from('pdf'),
      requiredFields: ['receiver', 'items'],
    }
    registerType(plugin)
    expect(getTypePlugin(33)).toBe(plugin)
  })
})
