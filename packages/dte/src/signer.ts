import forge from 'node-forge'

function extractDocumentoBlock(xml: string): { id: string; full: string; content: string } | null {
  const match = xml.match(/<Documento\s+ID="([^"]+)"\s*>(.*?)<\/Documento>/s)
  if (!match) return null
  return { id: match[1], full: match[0], content: match[2] }
}

function computeSha1Base64(data: string): string {
  const md = forge.md.sha1.create()
  md.update(data, 'utf8')
  return forge.util.encode64(md.digest().bytes())
}

function signRsaSha1(data: string, privateKeyPem: string): string {
  const privateKey = forge.pki.privateKeyFromPem(privateKeyPem)
  const md = forge.md.sha1.create()
  md.update(data, 'utf8')
  const signature = privateKey.sign(md)
  return forge.util.encode64(signature)
}

export function firmarDTE(xml: string, certPem: string): string {
  const docBlock = extractDocumentoBlock(xml)
  if (!docBlock) {
    throw new Error('No Documento element found in XML')
  }

  const documentoForDigest = `<Documento ID="${docBlock.id}">${docBlock.content}</Documento>`
  const digestValue = computeSha1Base64(documentoForDigest)

  const signedInfo = `<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#"><CanonicalizationMethod Algorithm="http://www.w3.org/TR/2001/REC-xml-c14n-20010315"></CanonicalizationMethod><SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"></SignatureMethod><Reference URI="#${docBlock.id}"><Transforms><Transform Algorithm="http://www.w3.org/2000/09/xmldsig#enveloped-signature"></Transform></Transforms><DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"></DigestMethod><DigestValue>${digestValue}</DigestValue></Reference></SignedInfo>`

  const signatureValue = signRsaSha1(signedInfo, certPem)

  const signatureBlock = `<Signature xmlns="http://www.w3.org/2000/09/xmldsig#">${signedInfo}<SignatureValue>${signatureValue}</SignatureValue></Signature>`

  const signedDocumento = `<Documento ID="${docBlock.id}">${docBlock.content}${signatureBlock}</Documento>`

  return xml.replace(docBlock.full, signedDocumento)
}
