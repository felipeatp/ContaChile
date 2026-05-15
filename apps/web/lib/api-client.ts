import { DocumentsResponse, Document, EmitDocumentResponse } from '@/types'

async function apiClient<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(init?.headers || {}),
    },
  })

  const data = await res.json().catch(() => null)

  if (!res.ok) {
    throw new Error(data?.error || `HTTP ${res.status}`)
  }

  return data as T
}

export function getDocuments(params?: { status?: string; page?: number; limit?: number; from?: string; to?: string; type?: number; search?: string }): Promise<DocumentsResponse> {
  const search = new URLSearchParams()
  if (params?.status) search.set('status', params.status)
  if (params?.page) search.set('page', String(params.page))
  if (params?.limit) search.set('limit', String(params.limit))
  if (params?.from) search.set('from', params.from)
  if (params?.to) search.set('to', params.to)
  if (params?.type) search.set('type', String(params.type))
  if (params?.search) search.set('search', params.search)
  const query = search.toString()
  return apiClient(`/documents${query ? `?${query}` : ''}`)
}

export function getDocument(id: string): Promise<Document> {
  return apiClient(`/documents/${id}`)
}

export function emitDocument(body: unknown, idempotencyKey?: string): Promise<EmitDocumentResponse> {
  const headers: Record<string, string> = {}
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey
  return apiClient('/dte/emit', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  })
}

export function emitBridgeDocument(body: unknown, idempotencyKey?: string): Promise<EmitDocumentResponse> {
  const headers: Record<string, string> = {}
  if (idempotencyKey) headers['idempotency-key'] = idempotencyKey
  return apiClient('/dte/emit-bridge', {
    method: 'POST',
    body: JSON.stringify(body),
    headers,
  })
}
