export function firmarDTE(xml: string, certPem: string): string {
  // Stub: append a Signature placeholder (real xmldsig via node-forge in follow-up)
  const signed = xml.replace(
    '</DTE>',
    '<Signature xmlns="http://www.w3.org/2000/09/xmldsig#"><SignatureValue>STUB</SignatureValue></Signature></DTE>'
  )
  return signed
}
