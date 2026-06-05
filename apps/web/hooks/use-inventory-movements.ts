import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Product } from "@/hooks/use-inventory-products"

export interface Movement {
  id: string
  type: "IN" | "OUT"
  quantity: number
  unitCost: number
  reason: string
  reference?: string | null
  notes?: string | null
  createdAt: string
  balance: number
  value: number
}

export interface KardexData {
  product: Product
  movements: Movement[]
}

export interface MovementInput {
  productId: string
  type: "IN" | "OUT"
  quantity: number
  reason: string
  unitCost?: number
  notes?: string
}

async function fetchKardex(productId: string): Promise<KardexData> {
  const res = await fetch(`/api/inventory/movements/${productId}`)
  if (!res.ok) throw new Error("Error al cargar los movimientos")
  return res.json()
}

export function useInventoryMovements(productId: string) {
  return useQuery({
    queryKey: ["inventory-movements", productId],
    queryFn: () => fetchKardex(productId),
    enabled: Boolean(productId),
  })
}

export function useCreateMovement() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: MovementInput) => {
      const res = await fetch("/api/inventory/movements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Error al registrar movimiento")
      }
      return res.json()
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["inventory-movements", variables.productId] })
      queryClient.invalidateQueries({ queryKey: ["inventory-products"] })
    },
  })
}
