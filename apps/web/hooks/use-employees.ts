import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query"

export type ContractType = "INDEFINIDO" | "PLAZO_FIJO" | "HONORARIOS"
export type AfpCode = "CAPITAL" | "CUPRUM" | "HABITAT" | "MODELO" | "PLANVITAL" | "PROVIDA" | "UNO"
export type HealthPlan = "FONASA" | "ISAPRE"

export interface Employee {
  id: string
  rut: string
  name: string
  email?: string | null
  position: string
  startDate: string
  endDate?: string | null
  contractType: ContractType
  workHours: number
  baseSalary: number
  afp: AfpCode
  healthPlan: HealthPlan
  healthAmount?: number | null
  isActive: boolean
}

export interface EmployeeInput {
  rut: string
  name: string
  email?: string
  position: string
  startDate: string
  contractType: ContractType
  workHours: number
  baseSalary: number
  afp: AfpCode
  healthPlan: HealthPlan
  healthAmount?: number
}

async function fetchEmployees(activeOnly: boolean): Promise<Employee[]> {
  const params = new URLSearchParams()
  if (activeOnly) params.set("active", "true")
  const res = await fetch(`/api/employees?${params}`)
  if (!res.ok) throw new Error("Error al cargar los trabajadores")
  const data = await res.json()
  return data.employees || []
}

export function useEmployees(activeOnly = true) {
  return useQuery({
    queryKey: ["employees", { activeOnly }],
    queryFn: () => fetchEmployees(activeOnly),
  })
}

export function useCreateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: EmployeeInput) => {
      const res = await fetch("/api/employees", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || "Error al registrar el trabajador")
      }
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] }),
  })
}

export function useUpdateEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<EmployeeInput> }) => {
      const res = await fetch(`/api/employees/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || "Error al actualizar el trabajador")
      }
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] }),
  })
}

export function useDeleteEmployee() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/employees/${id}`, { method: "DELETE" })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error((err as { error?: string }).error || "Error al desactivar el trabajador")
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["employees"] }),
  })
}
