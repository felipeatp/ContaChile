import { useMutation } from '@tanstack/react-query'
import { emitDocument, emitBridgeDocument } from '@/lib/api-client'

export function useEmitDocument() {
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: unknown; idempotencyKey?: string }) =>
      emitDocument(body, idempotencyKey),
  })
}

export function useEmitBridgeDocument() {
  return useMutation({
    mutationFn: ({ body, idempotencyKey }: { body: unknown; idempotencyKey?: string }) =>
      emitBridgeDocument(body, idempotencyKey),
  })
}
