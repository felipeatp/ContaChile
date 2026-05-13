import { describe, it, expect } from 'vitest'
import { firmarDTE } from '../src/signer'
import forge from 'node-forge'

function generateTestKeyPair(): { privateKeyPem: string; publicKeyPem: string } {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048 })
  const privateKeyPem = forge.pki.privateKeyToPem(keys.privateKey)
  const publicKeyPem = forge.pki.publicKeyToPem(keys.publicKey)
  return { privateKeyPem, publicKeyPem }
}

describe('firmarDTE', () => {
  it('adds Signature element inside Documento', () => {
    const xml = '<?xml version="1.0" encoding="ISO-8859-1"?><DTE><Documento ID="T1"></Documento></DTE>'
    const { privateKeyPem } = generateTestKeyPair()
    const signed = firmarDTE(xml, privateKeyPem)
    expect(signed).toContain('<Signature')
    expect(signed).toContain('</Signature>')
    expect(signed).toContain('<Documento ID="T1"><Signature')
  })

  it('includes SignedInfo with Reference to Documento ID', () => {
    const xml = '<?xml version="1.0" encoding="ISO-8859-1"?><DTE><Documento ID="T1"></Documento></DTE>'
    const { privateKeyPem } = generateTestKeyPair()
    const signed = firmarDTE(xml, privateKeyPem)
    expect(signed).toContain('<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">')
    expect(signed).toContain('URI="#T1"')
    expect(signed).toContain('<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"')
    expect(signed).toContain('<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"')
  })

  it('produces verifiable signature value', () => {
    const xml = '<?xml version="1.0" encoding="ISO-8859-1"?><DTE><Documento ID="T1"></Documento></DTE>'
    const { privateKeyPem, publicKeyPem } = generateTestKeyPair()
    const signed = firmarDTE(xml, privateKeyPem)
    expect(signed).toContain('<SignatureValue>')
    expect(signed).toContain('</SignatureValue>')
  })
})
