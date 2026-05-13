export interface ValidationResult {
  valid: boolean
  errors?: string[]
}

export interface DocumentData {
  type: number
  folio: number
  company: {
    rut: string
    name: string
    address: string
    commune: string
    city: string
    economicActivity: string
    cert: string // PEM
  }
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
  paymentMethod: 'CONTADO' | 'CREDITO'
  emittedAt: string // YYYY-MM-DD
  references?: Array<{
    type: number
    folio: number
    date: string
    reason: string
  }>
  transport?: {
    patente: string
    rutTransporter: string
    direction: string
    commune: string
    city: string
  }
}

export interface DocumentTypePlugin {
  code: number
  name: string
  validate(data: unknown): ValidationResult
  generateXML(data: DocumentData): string
  generatePDF(xml: string): Buffer
  requiredFields: string[]
}
