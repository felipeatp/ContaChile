import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export interface Purchase {
  id: string
  type: number
  folio: number
  issuerRut: string
  issuerName: string
  date: string
  netAmount: number
  taxAmount: number
  totalAmount: number
  category: string | null
}

export interface PurchaseInput {
  type: number
  folio: number
  issuerRut: string
  issuerName: string
  date: string
  netAmount: number
  taxAmount: number
  totalAmount: number
  category?: string
}

async function fetchPurchases(): Promise<Purchase[]> {
  const res = await fetch("/api/purchases")
  if (!res.ok) throw new Error("Error al cargar compras")
  const data = await res.json()
  return data.purchases || []
}

export function usePurchases() {
  return useQuery({ queryKey: ["purchases"], queryFn: fetchPurchases })
}

export function useCreatePurchase() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: PurchaseInput) => {
      const res = await fetch("/api/purchases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Error al registrar compra")
      }
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchases"] }),
  })
}

export function useImportPurchaseXml() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (xmlContent: string) => {
      const res = await fetch("/api/purchases/import-xml", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ xmlContent }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Error al importar XML")
      }
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["purchases"] }),
  })
}
