export interface Document {
  id: string
  type: number
  folio: number
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'FAILED'
  trackId: string | null
  xmlUrl: string | null
  pdfUrl: string | null
  receiverRut: string
  receiverName: string
  receiverEmail: string | null
  totalNet: number
  totalTax: number
  totalAmount: number
  paymentMethod: string
  emittedAt: string
  acceptedAt: string | null
  rejectedAt: string | null
  rejectionReason: string | null
  items?: DocumentItem[]
}

export interface DocumentItem {
  id: string
  documentId: string
  description: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface DocumentsResponse {
  documents: Document[]
  total: number
  page: number
  limit: number
  totalPages: number
}

export interface EmitDocumentResponse {
  id: string
  type: number
  folio: number
  status: string
  trackId: string | null
  createdAt: string
}
