import { useQuery } from '@tanstack/react-query'
import { getDocuments, getDocument } from '@/lib/api-client'

export function useDocuments(params?: { status?: string; page?: number; limit?: number }) {
  return useQuery({
    queryKey: ['documents', params],
    queryFn: () => getDocuments(params),
  })
}

export function useDocument(id: string) {
  return useQuery({
    queryKey: ['document', id],
    queryFn: () => getDocument(id),
    enabled: !!id,
  })
}
