import { AceptaConfig, EmitPayload, EmitResult, StatusResult } from './types'

export class AceptaClient {
  private config: AceptaConfig

  constructor(config: AceptaConfig) {
    this.config = { baseURL: 'https://api.acepta.com', ...config }
  }

  async emitDocument(payload: EmitPayload): Promise<EmitResult> {
    // Stub: simulate network and return fake documentId (real HTTPS in follow-up)
    return { documentId: `ACEPTA-${Date.now()}` }
  }

  async queryStatus(documentId: string): Promise<StatusResult> {
    // Stub: simulate status query (real HTTPS in follow-up)
    return { status: 'PENDING' }
  }
}
