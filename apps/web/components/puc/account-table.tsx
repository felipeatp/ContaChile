'use client'

import { useState } from 'react'
import { useAccounts, useDeleteAccount, Account } from '@/hooks/use-accounts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Pencil, Trash2, Lock, Search, Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const typeStyles: Record<Account['type'], { bg: string; text: string }> = {
  ACTIVO: { bg: 'bg-primary/10', text: 'text-primary' },
  PASIVO: { bg: 'bg-rust/10', text: 'text-rust' },
  PATRIMONIO: { bg: 'bg-foreground/10', text: 'text-foreground' },
  INGRESO: { bg: 'bg-sage/15', text: 'text-sage' },
  GASTO: { bg: 'bg-ochre/15', text: 'text-ochre' },
  COSTO: { bg: 'bg-ochre/10', text: 'text-ochre' },
}

export function AccountTable({ onEdit }: { onEdit: (account: Account) => void }) {
  const [filterType, setFilterType] = useState<string>('')
  const [search, setSearch] = useState('')
  const { data: accounts, isLoading } = useAccounts(filterType || undefined)
  const del = useDeleteAccount()

  const filtered = accounts?.filter((a) => {
    const q = search.toLowerCase()
    return !q || a.code.toLowerCase().includes(q) || a.name.toLowerCase().includes(q)
  })

  return (
    <section>
      <div className="flex items-end justify-between mb-4">
        <div>
          <span className="eyebrow block mb-1">I · Catálogo</span>
          <h3 className="font-display text-2xl font-semibold tracking-tightest">
            Cuentas registradas
          </h3>
        </div>
        <span className="text-xs text-muted-foreground/60 font-mono tabular">
          {filtered?.length ?? 0} de {accounts?.length ?? 0}
        </span>
      </div>

      <div className="card-editorial p-5 mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground/60" />
          <Input
            placeholder="Buscar por código o nombre…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <select
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
          className="h-10 px-3 text-sm min-w-[180px]"
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

      <div className="card-editorial overflow-hidden">
        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !filtered || filtered.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-display text-lg text-muted-foreground mb-1">
              Sin cuentas que coincidan
            </p>
            <p className="text-xs text-muted-foreground/70">
              Ajusta los filtros o crea una nueva cuenta.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-editorial">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Nombre</th>
                  <th>Tipo</th>
                  <th>Descripción</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((account) => {
                  const t = typeStyles[account.type]
                  return (
                    <tr
                      key={account.id}
                      className={cn(!account.isActive && 'opacity-50')}
                    >
                      <td className="font-mono">{account.code}</td>
                      <td>
                        <div className="flex items-center gap-2">
                          {account.name}
                          {account.isSystem && (
                            <Lock className="h-3 w-3 text-muted-foreground/60" />
                          )}
                        </div>
                      </td>
                      <td>
                        <span
                          className={cn(
                            'text-[0.6rem] uppercase tracking-eyebrow font-semibold rounded-sm px-1.5 py-0.5',
                            t.bg,
                            t.text
                          )}
                        >
                          {account.type}
                        </span>
                      </td>
                      <td className="text-muted-foreground text-sm">
                        {account.description || '—'}
                      </td>
                      <td className="text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button variant="ghost" size="sm" onClick={() => onEdit(account)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {!account.isSystem && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => del.mutate(account.id)}
                              disabled={del.isPending}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  )
}
