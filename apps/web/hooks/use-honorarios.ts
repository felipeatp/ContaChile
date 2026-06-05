import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export type HonorarioType = "ISSUED" | "RECEIVED"
export type HonorarioStatus = "PENDING" | "PAID"

export interface Honorario {
  id: string
  type: HonorarioType
  number: number
  date: string
  counterpartRut: string
  counterpartName: string
  description?: string | null
  grossAmount: number
  retentionAmount: number
  netAmount: number
  status: HonorarioStatus
}

export interface HonorarioTotals {
  issuedGross: number
  issuedRetention: number
  issuedNet: number
  receivedGross: number
  receivedRetention: number
  receivedNet: number
}

export interface HonorariosResponse {
  honorarios: Honorario[]
  totals: HonorarioTotals
}

export interface HonorarioFilters {
  type?: HonorarioType | ""
  year: number
  month?: number
}

export interface HonorarioInput {
  type: HonorarioType
  number: number
  date: string
  counterpartRut: string
  counterpartName: string
  description?: string
  grossAmount: number
}

export interface HonorarioPatchInput {
  status?: HonorarioStatus
  description?: string
}

const EMPTY_TOTALS: HonorarioTotals = {
  issuedGross: 0,
  issuedRetention: 0,
  issuedNet: 0,
  receivedGross: 0,
  receivedRetention: 0,
  receivedNet: 0,
}

async function fetchHonorarios(filters: HonorarioFilters): Promise<HonorariosResponse> {
  const params = new URLSearchParams()
  if (filters.type) params.set("type", filters.type)
  params.set("year", String(filters.year))
  if (filters.month && filters.month > 0) params.set("month", String(filters.month))
  const res = await fetch(`/api/honorarios?${params}`)
  if (!res.ok) throw new Error("Error al cargar honorarios")
  const data = await res.json()
  return {
    honorarios: data.honorarios ?? [],
    totals: data.totals ?? EMPTY_TOTALS,
  }
}

export function useHonorarios(filters: HonorarioFilters) {
  return useQuery({
    queryKey: ["honorarios", filters],
    queryFn: () => fetchHonorarios(filters),
  })
}

export function useCreateHonorario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: HonorarioInput) => {
      const res = await fetch("/api/honorarios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Error al registrar la boleta")
      }
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["honorarios"] }),
  })
}

export function useDeleteHonorario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/honorarios/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Error al eliminar la boleta")
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["honorarios"] }),
  })
}

export function useUpdateHonorario() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: HonorarioPatchInput }) => {
      const res = await fetch(`/api/honorarios/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Error al actualizar la boleta")
      }
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["honorarios"] }),
  })
}
