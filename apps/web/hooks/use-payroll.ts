import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export interface PayrollEmployee {
  rut: string
  name: string
  position: string
  afp: string
}

export interface Payroll {
  id: string
  year: number
  month: number
  bruto: number
  afp: number
  salud: number
  cesantia: number
  impuesto: number
  liquido: number
  status: "DRAFT" | "APPROVED" | "PAID"
  employee: PayrollEmployee
}

export interface PayrollTotals {
  bruto: number
  afp: number
  salud: number
  cesantia: number
  impuesto: number
  liquido: number
}

export interface PayrollResponse {
  payrolls: Payroll[]
  totals: PayrollTotals
}

export interface PayrollParams {
  year: number
  month: number
}

export interface GeneratePayrollResult {
  generated: number
  skipped: number
}

async function fetchPayroll(params: PayrollParams): Promise<PayrollResponse> {
  const res = await fetch(`/api/payroll/${params.year}/${params.month}`)
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error || "Error al cargar las liquidaciones")
  }
  return res.json()
}

export function usePayroll(params: PayrollParams) {
  return useQuery({
    queryKey: ["payroll", params],
    queryFn: () => fetchPayroll(params),
  })
}

export function useGeneratePayroll() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (params: PayrollParams): Promise<GeneratePayrollResult> => {
      const res = await fetch("/api/payroll/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(params),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Error al generar las liquidaciones")
      }
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payroll"] }),
  })
}

export function useApprovePayroll() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string): Promise<void> => {
      const res = await fetch(`/api/payroll/item/${id}/approve`, {
        method: "POST",
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || "Error al aprobar la liquidación")
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["payroll"] }),
  })
}
