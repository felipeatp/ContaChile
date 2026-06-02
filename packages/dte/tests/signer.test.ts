import { describe, it, expect } from 'vitest'
import { firmarDTE, extractPrivateKeyFromPfx } from '../src/signer'
import forge from 'node-forge'

function generateTestKeyPair(): { privateKeyPem: string; publicKeyPem: string } {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048 })
  return {
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
    publicKeyPem: forge.pki.publicKeyToPem(keys.publicKey),
  }
}

function sha1Base64(data: string): string {
  const md = forge.md.sha1.create()
  md.update(data, 'utf8')
  return forge.util.encode64(md.digest().bytes())
}

describe('firmarDTE', () => {
  it('agrega elemento Signature dentro de Documento', () => {
    const xml = '<?xml version="1.0" encoding="ISO-8859-1"?><DTE><Documento ID="T1"></Documento></DTE>'
    const { privateKeyPem } = generateTestKeyPair()
    const signed = firmarDTE(xml, privateKeyPem)
    expect(signed).toContain('<Signature')
    expect(signed).toContain('</Signature>')
    expect(signed).toContain('<Documento ID="T1"><Signature')
  })

  it('incluye SignedInfo con Reference al ID del Documento', () => {
    const xml = '<?xml version="1.0" encoding="ISO-8859-1"?><DTE><Documento ID="T1"></Documento></DTE>'
    const { privateKeyPem } = generateTestKeyPair()
    const signed = firmarDTE(xml, privateKeyPem)
    expect(signed).toContain('<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">')
    expect(signed).toContain('URI="#T1"')
    expect(signed).toContain('<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"')
    expect(signed).toContain('<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"')
  })

  it('produce un SignatureValue no vacío', () => {
    const xml = '<?xml version="1.0" encoding="ISO-8859-1"?><DTE><Documento ID="T1"></Documento></DTE>'
    const { privateKeyPem } = generateTestKeyPair()
    const signed = firmarDTE(xml, privateKeyPem)
    const match = signed.match(/<SignatureValue>([^<]+)<\/SignatureValue>/)
    expect(match).not.toBeNull()
    expect(match![1].length).toBeGreaterThan(0)
  })

  it('DigestValue embebido coincide con SHA-1 del bloque Documento original', () => {
    const content = '<monto>100000</monto>'
    const xml = `<?xml version="1.0"?><DTE><Documento ID="F1">${content}</Documento></DTE>`
    const { privateKeyPem } = generateTestKeyPair()
    const signed = firmarDTE(xml, privateKeyPem)

    // Extraer DigestValue del XML firmado
    const digestMatch = signed.match(/<DigestValue>([^<]+)<\/DigestValue>/)
    expect(digestMatch).not.toBeNull()
    const embeddedDigest = digestMatch![1]

    // El DigestValue debe ser el SHA-1 del bloque Documento ANTES de la firma
    const expectedDigest = sha1Base64(`<Documento ID="F1">${content}</Documento>`)
    expect(embeddedDigest).toBe(expectedDigest)
  })

  it('tampering: modificar el contenido produce un DigestValue distinto — el fraude es detectable', () => {
    const originalContent = '<monto>100000</monto>'
    const tamperedContent = '<monto>999999</monto>'
    const xml = `<?xml version="1.0"?><DTE><Documento ID="F1">${originalContent}</Documento></DTE>`
    const { privateKeyPem } = generateTestKeyPair()
    const signed = firmarDTE(xml, privateKeyPem)

    // DigestValue embebido en el XML firmado
    const embeddedDigest = signed.match(/<DigestValue>([^<]+)<\/DigestValue>/)![1]

    // SHA-1 del contenido alterado — diferente al embebido
    const tamperedDigest = sha1Base64(`<Documento ID="F1">${tamperedContent}</Documento>`)

    expect(tamperedDigest).not.toBe(embeddedDigest)
  })

  it('lanza error si no hay elemento Documento en el XML', () => {
    const xml = '<?xml version="1.0"?><DTE><OtroElemento></OtroElemento></DTE>'
    const { privateKeyPem } = generateTestKeyPair()
    expect(() => firmarDTE(xml, privateKeyPem)).toThrow('No Documento element found in XML')
  })

  it('lanza error con PEM de clave privada inválido', () => {
    const xml = '<?xml version="1.0"?><DTE><Documento ID="T1"></Documento></DTE>'
    expect(() => firmarDTE(xml, 'esto-no-es-un-pem-valido')).toThrow()
  })
})

describe('extractPrivateKeyFromPfx', () => {
  it('lanza error con base64 inválido', () => {
    expect(() => extractPrivateKeyFromPfx('!!!base64-invalido!!!', 'password')).toThrow()
  })

  it('extrae la clave privada de un PFX válido generado con la contraseña correcta', () => {
    // Generar un PFX real con node-forge para validar la función end-to-end
    const keys = forge.pki.rsa.generateKeyPair({ bits: 512 }) // 512 bits para velocidad en tests
    const cert = forge.pki.createCertificate()
    cert.publicKey = keys.publicKey
    cert.serialNumber = '01'
    cert.validity.notBefore = new Date()
    cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    const attrs = [{ name: 'commonName', value: 'test' }]
    cert.setSubject(attrs)
    cert.setIssuer(attrs)
    cert.sign(keys.privateKey)

    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'correct-password')
    const pfxBase64 = forge.util.encode64(forge.asn1.toDer(p12Asn1).bytes())

    const extractedPem = extractPrivateKeyFromPfx(pfxBase64, 'correct-password')
    expect(extractedPem).toContain('-----BEGIN RSA PRIVATE KEY-----')
  })

  it('lanza error con contraseña incorrecta en PFX válido', () => {
    const keys = forge.pki.rsa.generateKeyPair({ bits: 512 })
    const cert = forge.pki.createCertificate()
    cert.publicKey = keys.publicKey
    cert.serialNumber = '01'
    cert.validity.notBefore = new Date()
    cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    const attrs = [{ name: 'commonName', value: 'test' }]
    cert.setSubject(attrs)
    cert.setIssuer(attrs)
    cert.sign(keys.privateKey)

    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'correct-password')
    const pfxBase64 = forge.util.encode64(forge.asn1.toDer(p12Asn1).bytes())

    expect(() => extractPrivateKeyFromPfx(pfxBase64, 'wrong-password')).toThrow()
  })
})
