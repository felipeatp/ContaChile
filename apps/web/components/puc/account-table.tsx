'use client'

import { useState } from 'react'
import { useAccounts, useUpdateAccount, useDeleteAccount, Account } from '@/hooks/use-accounts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Pencil, Trash2, Lock, Search } from 'lucide-react'
import { cn } from '@/lib/utils'

const typeColors: Record<Account['type'], string> = {
  ACTIVO: 'bg-blue-50 text-blue-700',
  PASIVO: 'bg-red-50 text-red-700',
  PATRIMONIO: 'bg-purple-50 text-purple-700',
  INGRESO: 'bg-green-50 text-green-700',
  GASTO: 'bg-orange-50 text-orange-700',
  COSTO: 'bg-yellow-50 text-yellow-700',
}

export function AccountTable({ onEdit }: { onEdit: (account: Account) => void }) {
  const [filterType, setFilterType] = useState<string>('')
  const [search, setSearch] = useState('')
  const { data: accounts, isLoading } = useAccounts(filterType || undefined)
  const update = useUpdateAccount()
  const del = useDeleteAccount()

  const filtered = accounts?.filter((a) => {
    const q = search.toLowerCase()
    return !q || a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
  })

  if (isLoading) return <p className="text-sm text-muted-foreground">Cargando...</p>

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar por código o nombre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        >
          <option value="">Todos los tipos</option>
          <option value="ACTIVO">Activos</option>
          <option value="PASIVO">Pasivos</option>
          <option value="PATRIMONIO">Patrimonio</option>
          <option value="INGRESO">Ingresos</option>
          <option value="GASTO">Gastos</option>
          <option value="COSTO">Costos</option>
        </select>
      </div>

      <div className="rounded-md border">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted">
            <tr>
              <th className="px-4 py-3 text-left font-medium">Código</th>
              <th className="px-4 py-3 text-left font-medium">Nombre</th>
              <th className="px-4 py-3 text-left font-medium">Tipo</th>
              <th className="px-4 py-3 text-left font-medium">Descripción</th>
              <th className="px-4 py-3 text-right font-medium">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered?.map((account) => (
              <tr
                key={account.id}
                className={cn('border-b last:border-0', !account.isActive && 'opacity-50')}
              >
                <td className="px-4 py-3 font-mono">{account.code}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {account.name}
                    {account.isSystem && <Lock className="h-3 w-3 text-muted-foreground" />}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Badge className={cn('text-xs', typeColors[account.type])}>{account.type}</Badge>
                </td>
                <td className="px-4 py-3 text-muted-foreground">{account.description || '-'}</td>
                <td className="px-4 py-3 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEdit(account)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    {!account.isSystem && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => del.mutate(account.id)}
                        disabled={del.isPending}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
