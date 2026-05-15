import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'

export interface Account {
  id: string
  code: string
  name: string
  type: 'ACTIVO' | 'PASIVO' | 'PATRIMONIO' | 'INGRESO' | 'GASTO' | 'COSTO'
  parentCode?: string
  description?: string
  isActive: boolean
  isSystem: boolean
}

async function fetchAccounts(type?: string): Promise<Account[]> {
  const query = type ? `?type=${type}` : ''
  const res = await fetch(`/api/accounts${query}`)
  if (!res.ok) throw new Error('Error fetching accounts')
  const data = await res.json()
  return data.accounts || []
}

export function useAccounts(type?: string) {
  return useQuery({ queryKey: ['accounts', type], queryFn: () => fetchAccounts(type) })
}

export function useCreateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: Omit<Account, 'id' | 'isSystem' | 'createdAt' | 'updatedAt'> & { isActive?: boolean }) => {
      const res = await fetch('/api/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Error creating account')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

export function useUpdateAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: Partial<Account> }) => {
      const res = await fetch(`/api/accounts/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (!res.ok) throw new Error('Error updating account')
      return res.json()
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  })
}

export function useDeleteAccount() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/accounts/${id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Error deleting account')
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['accounts'] }),
  })
}
