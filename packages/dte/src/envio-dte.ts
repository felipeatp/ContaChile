import { create } from 'xmlbuilder2'
import { firmarDTE } from './signer'

export interface EnvioDTEData {
  companyRut: string
  companyName: string
  resolutionDate: string // YYYY-MM-DD
  resolutionNumber: number // 0 for test
  dteXmls: string[] // signed DTE XML strings
  privateKeyPem: string
}

function computeSha1Base64(data: string): string {
  // Re-import from signer or use inline
  const forge = require('node-forge')
  const md = forge.md.sha1.create()
  md.update(data, 'utf8')
  return forge.util.encode64(md.digest().bytes())
}

function signRsaSha1(data: string, privateKeyPem: string): string {
  const forge = require('node-forge')
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem)
  const md = forge.md.sha1.create()
  md.update(data, 'utf8')
  const signature = privateKey.sign(md)
  return forge.util.encode64(signature)
}

export function buildEnvioDTE(data: EnvioDTEData): string {
  const setId = `SetDoc-${Date.now()}`
  const timestamp = new Date().toISOString()

  // Build SetDTE inner content (without wrapper for digest)
  let dteContent = ''
  for (const xml of data.dteXmls) {
    // Extract the DTE element from each XML
    const match = xml.match(/<DTE[^>]*>.*?<\/DTE>/s)
    if (match) {
      dteContent += match[0]
    }
  }

  const caratula = `<Caratula version="1.0"><RutEmisor>${data.companyRut}</RutEmisor><RutEnvia>${data.companyRut}</RutEnvia><RutReceptor>60803000-K</RutReceptor><FchResol>${data.resolutionDate}</FchResol><NroResol>${data.resolutionNumber}</NroResol><TmstFirmaEnv>${timestamp}</TmstFirmaEnv></Caratula>`

  const setDTEForDigest = `<SetDTE ID="${setId}">${caratula}${dteContent}</SetDTE>`

  const digestValue = computeSha1Base64(setDTEForDigest)

  const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod><Reference URI="#${setId}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`

  const signatureValue = signRsaSha1(signedInfo, data.privateKeyPem)

  const signatureBlock = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signatureValue}</SignatureValue></Signature>`

  const envio = create({ version: '1.0', encoding: 'ISO-8859-1' })
    .ele('EnvioDTE', {
      xmlns: 'http://www.sii.cl/SiiDte',
      'xmlns:xsi': 'http://www.w3.org/2001/XMLSchema-instance',
      'xsi:schemaLocation': 'http://www.sii.cl/SiiDte EnvioDTE_v10.xsd',
      version: '1.0',
    })
    .ele('SetDTE', { ID: setId })
    .ele('Caratula', { version: '1.0' })
    .ele('RutEmisor').txt(data.companyRut).up()
    .ele('RutEnvia').txt(data.companyRut).up()
    .ele('RutReceptor').txt('60803000-K').up()
    .ele('FchResol').txt(data.resolutionDate).up()
    .ele('NroResol').txt(String(data.resolutionNumber)).up()
    .ele('TmstFirmaEnv').txt(timestamp).up()
    .up()

  for (const xml of data.dteXmls) {
    const match = xml.match(/<DTE[^>]*>.*?<\/DTE>/s)
    if (match) {
      // Parse the DTE element and append it
      // xmlbuilder2 doesn't have a clean way to import raw XML,
      // so we'll build the string manually and insert
    }
  }

  // Since xmlbuilder2 is cumbersome for inserting raw XML,
  // let's build the entire thing as a string
  const setDTEContent = `<SetDTE ID="${setId}">${caratula}${dteContent}</SetDTE>`

  const xmlString = `<?xml version="1.0" encoding="ISO-8859-1"?>
<EnvioDTE xmlns="http://www.sii.cl/SiiDte" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:schemaLocation="http://www.sii.cl/SiiDte EnvioDTE_v10.xsd" version="1.0">
${setDTEContent}
${signatureBlock}
</EnvioDTE>`

  return xmlString.trim()
}
