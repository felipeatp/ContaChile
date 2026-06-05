import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export interface Product {
  id: string
  code: string
  name: string
  description?: string | null
  unit: string
  salePrice: number
  costPrice: number
  stock: number
  minStock: number
  affectedIVA: boolean
  isActive: boolean
}

export interface ProductCreateInput {
  code: string
  name: string
  description?: string
  unit: string
  salePrice: number
  costPrice: number
  initialStock: number
  minStock: number
  affectedIVA: boolean
}

export interface ProductUpdateInput {
  code?: string
  name?: string
  description?: string
  unit?: string
  salePrice?: number
  minStock?: number
  affectedIVA?: boolean
}

interface FetchProductsParams {
  active?: boolean
  search?: string
}

async function fetchInventoryProducts(params: FetchProductsParams): Promise<Product[]> {
  const query = new URLSearchParams()
  if (params.active) query.set("active", "true")
  if (params.search) query.set("search", params.search)
  const qs = query.toString()
  const res = await fetch(`/api/inventory/products${qs ? `?${qs}` : ""}`)
  if (!res.ok) throw new Error("Error al cargar productos")
  const data = await res.json()
  return data.products || []
}

export function useInventoryProducts(params: FetchProductsParams = {}) {
  return useQuery({
    queryKey: ["inventory-products", params],
    queryFn: () => fetchInventoryProducts(params),
  })
}

export function useCreateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: ProductCreateInput) => {
      const res = await fetch("/api/inventory/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Error al crear producto")
      }
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory-products"] }),
  })
}

export function useUpdateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: ProductUpdateInput }) => {
      const res = await fetch(`/api/inventory/products/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Error al actualizar producto")
      }
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory-products"] }),
  })
}

export function useDeactivateProduct() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/inventory/products/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Error al desactivar producto")
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["inventory-products"] }),
  })
}
