import { FastifyInstance } from 'fastify'
import { prisma } from '@contachile/db'
import { renderPDF } from '@contachile/dte'

export default async function (fastify: FastifyInstance) {
  fastify.get('/documents/:id/pdf', async (request, reply) => {
    const { id } = request.params as { id: string }

    const doc = await prisma.document.findUnique({
      where: { id },
      include: { items: true },
    })

    if (!doc) {
      return reply.code(404).send({ error: 'Document not found' })
    }

    // Build minimal XML for PDF rendering
    const xml = `
      <DTE>
        <Documento>
          <Encabezado>
            <IdDoc>
              <TipoDTE>${doc.type}</TipoDTE>
              <Folio>${doc.folio}</Folio>
              <FchEmis>${doc.emittedAt.toISOString().split('T')[0]}</FchEmis>
            </IdDoc>
            <Emisor>
              <RUTEmisor>76.123.456-7</RUTEmisor>
              <RznSoc>Empresa de Prueba SpA</RznSoc>
              <DirOrigen>Santiago</DirOrigen>
              <CmnaOrigen>Santiago</CmnaOrigen>
              <CiudadOrigen>Santiago</CiudadOrigen>
            </Emisor>
            <Receptor>
              <RUTRecep>${doc.receiverRut}</RUTRecep>
              <RznSocRecep>${doc.receiverName}</RznSocRecep>
              <DirRecep>Dirección</DirRecep>
              <CmnaRecep>Santiago</CmnaRecep>
              <CiudadRecep>Santiago</CiudadRecep>
            </Receptor>
            <Totales>
              <MntNeto>${doc.totalNet}</MntNeto>
              <IVA>${doc.totalTax}</IVA>
              <MntTotal>${doc.totalAmount}</MntTotal>
            </Totales>
          </Encabezado>
          ${doc.items
            .map(
              (item, i) => `
          <Detalle>
            <NroLinDet>${i + 1}</NroLinDet>
            <NmbItem>${item.description}</NmbItem>
            <QtyItem>${item.quantity}</QtyItem>
            <PrcItem>${item.unitPrice}</PrcItem>
            <MontoItem>${item.totalPrice}</MontoItem>
          </Detalle>`,
            )
            .join('')}
        </Documento>
      </DTE>
    `.trim()

    const pdf = await renderPDF(xml)

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `inline; filename="dte-${doc.type}-${doc.folio}.pdf"`)
      .send(pdf)
  })
}
