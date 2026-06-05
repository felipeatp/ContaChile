import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export type Status = 'DRAFT' | 'SENT' | 'ACCEPTED' | 'REJECTED' | 'INVOICED' | 'EXPIRED'

export interface QuoteItem {
  description: string
  quantity: number
  unitPrice: number
  totalPrice: number
}

export interface Quote {
  id: string
  number: number
  date: string
  validUntil?: string | null
  receiverRut: string
  receiverName: string
  receiverEmail?: string | null
  totalNet: number
  totalTax: number
  totalAmount: number
  paymentMethod: string
  notes?: string | null
  status: Status
  invoicedDocumentId?: string | null
  rejectionReason?: string | null
  items: QuoteItem[]
}

export interface QuoteInput {
  number: number
  receiverRut: string
  receiverName: string
  receiverEmail?: string
  validUntil?: string
  paymentMethod: string
  notes?: string
  items: Array<{
    description: string
    quantity: number
    unitPrice: number
  }>
}

export interface QuotesParams {
  status?: Status
}

export interface ToInvoiceResult {
  document?: { folio: number; [key: string]: unknown }
  [key: string]: unknown
}

async function fetchQuotes(params?: QuotesParams): Promise<Quote[]> {
  const query = new URLSearchParams()
  if (params?.status) query.set('status', params.status)
  const qs = query.toString()
  const res = await fetch(`/api/quotes${qs ? `?${qs}` : ''}`)
  if (!res.ok) throw new Error("Error al cargar cotizaciones")
  const data = await res.json()
  return data.quotes || []
}

export function useQuotes(params?: QuotesParams) {
  return useQuery({
    queryKey: ["quotes", params],
    queryFn: () => fetchQuotes(params),
  })
}

export function useCreateQuote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: QuoteInput) => {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Error al crear cotización")
      }
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quotes"] }),
  })
}

export function useQuoteAction() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({
      id,
      action,
      body = {},
    }: {
      id: string
      action: 'send' | 'accept' | 'reject' | 'to-invoice'
      body?: Record<string, unknown>
    }) => {
      const res = await fetch(`/api/quotes/${id}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data: ToInvoiceResult = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error((data as { error?: string }).error || "Error al ejecutar acción")
      }
      return data
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quotes"] }),
  })
}

export function useDeleteQuote() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/quotes/${id}`, { method: 'DELETE' })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Error al eliminar cotización")
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["quotes"] }),
  })
}
