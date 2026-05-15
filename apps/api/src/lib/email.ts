export interface SendDocumentAcceptedParams {
  documentId: string
  folio: number
  type: number
  receiverName: string
  receiverEmail: string
}

export interface EmailService {
  sendDocumentAccepted(params: SendDocumentAcceptedParams): Promise<void>
  sendDocumentEmitted(params: SendDocumentAcceptedParams): Promise<void>
}

export class StubEmailService implements EmailService {
  public calls: Array<{ method: string; params: SendDocumentAcceptedParams }> = []

  async sendDocumentAccepted(params: SendDocumentAcceptedParams): Promise<void> {
    this.calls.push({ method: 'sendDocumentAccepted', params })
  }

  async sendDocumentEmitted(params: SendDocumentAcceptedParams): Promise<void> {
    this.calls.push({ method: 'sendDocumentEmitted', params })
  }
}

export class ResendEmailService implements EmailService {
  private resend: any
  private from: string

  constructor(apiKey: string, fromEmail: string = 'ContaChile <noreply@contachile.cl>') {
    const { Resend } = require('resend')
    this.resend = new Resend(apiKey)
    this.from = fromEmail
  }

  async sendDocumentAccepted(params: SendDocumentAcceptedParams): Promise<void> {
    const tipoLabel = params.type === 33 ? 'Factura Electrónica' : params.type === 39 ? 'Boleta Electrónica' : `DTE tipo ${params.type}`

    await this.resend.emails.send({
      from: this.from,
      to: params.receiverEmail,
      subject: `${tipoLabel} N° ${params.folio} aceptada por el SII`,
      html: `
        <h2>Documento Tributario Electrónico Aceptado</h2>
        <p>Estimado/a <strong>${params.receiverName}</strong>,</p>
        <p>Su ${tipoLabel} N° <strong>${params.folio}</strong> ha sido aceptada exitosamente por el SII.</p>
        <p>Puede descargar el documento desde su portal de ContaChile.</p>
        <hr/>
        <p><small>Este es un correo automático enviado por ContaChile.</small></p>
      `,
    })
  }

  async sendDocumentEmitted(params: SendDocumentAcceptedParams): Promise<void> {
    const tipoLabel = params.type === 33 ? 'Factura Electrónica' : params.type === 39 ? 'Boleta Electrónica' : `DTE tipo ${params.type}`

    await this.resend.emails.send({
      from: this.from,
      to: params.receiverEmail,
      subject: `${tipoLabel} N° ${params.folio} emitida`,
      html: `
        <h2>Documento Tributario Electrónico Emitido</h2>
        <p>Estimado/a <strong>${params.receiverName}</strong>,</p>
        <p>Se ha emitido su ${tipoLabel} N° <strong>${params.folio}</strong>.</p>
        <p>Le notificaremos cuando sea aceptada por el SII.</p>
        <hr/>
        <p><small>Este es un correo automático enviado por ContaChile.</small></p>
      `,
    })
  }
}

export function createEmailService(): EmailService {
  const apiKey = process.env.RESEND_API_KEY
  if (apiKey && apiKey !== 'test-key') {
    return new ResendEmailService(apiKey)
  }
  return new StubEmailService()
}
