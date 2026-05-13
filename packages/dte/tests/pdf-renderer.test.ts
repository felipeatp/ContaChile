import { describe, it, expect } from 'vitest'
import { renderPDF } from '../src/pdf-renderer'

describe('renderPDF', () => {
  const sampleXml = `<?xml version="1.0" encoding="ISO-8859-1"?>
<DTE version="1.0" xmlns="http://www.sii.cl/SiiDte">
  <Documento ID="DTE-76192083-1-33-1">
    <Encabezado>
      <IdDoc>
        <TipoDTE>33</TipoDTE>
        <Folio>1</Folio>
        <FchEmis>2026-05-13</FchEmis>
      </IdDoc>
      <Emisor>
        <RUTEmisor>76192083-1</RUTEmisor>
        <RznSoc>Empresa SpA</RznSoc>
        <DirOrigen>Av. Principal 123</DirOrigen>
        <CmnaOrigen>Santiago</CmnaOrigen>
        <CiudadOrigen>Santiago</CiudadOrigen>
      </Emisor>
      <Receptor>
        <RUTRecep>12345678-5</RUTRecep>
        <RznSocRecep>Cliente Ejemplo</RznSocRecep>
        <DirRecep>Calle 456</DirRecep>
      </Receptor>
      <Totales>
        <MntNeto>100000</MntNeto>
        <IVA>19000</IVA>
        <MntTotal>119000</MntTotal>
      </Totales>
    </Encabezado>
    <Detalle>
      <NroLinDet>1</NroLinDet>
      <NmbItem>Servicio de consultoria</NmbItem>
      <QtyItem>1</QtyItem>
      <PrcItem>100000</PrcItem>
      <MontoItem>100000</MontoItem>
    </Detalle>
  </Documento>
</DTE>`

  it('returns a non-empty Buffer', async () => {
    const pdf = await renderPDF(sampleXml)
    expect(Buffer.isBuffer(pdf)).toBe(true)
    expect(pdf.length).toBeGreaterThan(0)
  })

  it('produces a valid PDF header', async () => {
    const pdf = await renderPDF(sampleXml)
    expect(pdf.toString('ascii', 0, 4)).toBe('%PDF')
  })

  it('produces a PDF larger than header-only', async () => {
    const pdf = await renderPDF(sampleXml)
    expect(pdf.length).toBeGreaterThan(100)
  })
})
