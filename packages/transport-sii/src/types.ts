export interface SIIConfig {
  baseURL: string
  env: 'test' | 'production'
}

export interface SendResult {
  trackId: string
}

export interface StatusResult {
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  detail?: string
}
