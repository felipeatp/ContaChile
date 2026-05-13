import { describe, it, expect } from 'vitest'
import { firmarDTE } from '../src/signer'

describe('firmarDTE', () => {
  it('adds Signature element to XML', () => {
    const xml = '<?xml version="1.0" encoding="ISO-8859-1"?><DTE><Documento ID="T1"></Documento></DTE>'
    const signed = firmarDTE(xml, 'fake-pem-cert')
    expect(signed).toContain('<Signature')
    expect(signed).toContain('</Signature>')
  })
})
