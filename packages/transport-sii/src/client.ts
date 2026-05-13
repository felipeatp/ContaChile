import { SIIConfig, SendResult, StatusResult } from './types'

export class SIIClient {
  private config: SIIConfig

  constructor(config: SIIConfig) {
    this.config = config
  }

  async sendDTE(xmlEnvelope: string): Promise<SendResult> {
    // Stub: simulate network and return fake trackId (real HTTPS in follow-up)
    return { trackId: `STUB-${Date.now()}` }
  }

  async queryStatus(trackId: string): Promise<StatusResult> {
    // Stub: simulate status query (real HTTPS in follow-up)
    return { status: 'PENDING' }
  }
}
