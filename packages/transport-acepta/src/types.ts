export interface AceptaConfig {
  apiKey: string
  baseURL?: string
}

export interface EmitPayload {
  type: number
  receiver: {
    rut: string
    name: string
    address: string
    commune: string
    city: string
  }
  items: Array<{
    description: string
    quantity: number
    unitPrice: number
  }>
  paymentMethod: string
}

export interface EmitResult {
  documentId: string
}

export interface StatusResult {
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED'
  detail?: string
}
