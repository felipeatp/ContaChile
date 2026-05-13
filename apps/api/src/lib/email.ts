export interface SendDocumentAcceptedParams {
  documentId: string
  folio: number
  type: number
  receiverName: string
  receiverEmail: string
}

export interface EmailService {
  sendDocumentAccepted(params: SendDocumentAcceptedParams): Promise<void>
}

export class StubEmailService implements EmailService {
  public calls: Array<{ method: string; params: SendDocumentAcceptedParams }> = []

  async sendDocumentAccepted(params: SendDocumentAcceptedParams): Promise<void> {
    this.calls.push({ method: 'sendDocumentAccepted', params })
  }
}
