'use client'

import { useState } from 'react'
import { AccountTable } from '@/components/puc/account-table'
import { AccountForm } from '@/components/puc/account-form'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { Account } from '@/hooks/use-accounts'

export default function PucPage() {
  const [formOpen, setFormOpen] = useState(false)
  const [editAccount, setEditAccount] = useState<Account | undefined>()

  const handleEdit = (account: Account) => {
    setEditAccount(account)
    setFormOpen(true)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Plan de Cuentas</h1>
          <p className="text-sm text-muted-foreground">Gestiona el PUC de tu empresa.</p>
        </div>
        <Button onClick={() => { setEditAccount(undefined); setFormOpen(true) }}>
          <Plus className="mr-2 h-4 w-4" /> Nueva cuenta
        </Button>
      </div>

      <AccountTable onEdit={handleEdit} />
      <AccountForm open={formOpen} onClose={() => setFormOpen(false)} editAccount={editAccount} />
    </div>
  )
}
