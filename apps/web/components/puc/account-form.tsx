'use client'

import { useState, useEffect } from 'react'
import { useCreateAccount, useUpdateAccount, Account } from '@/hooks/use-accounts'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Modal } from '@/components/ui/modal'
import { Loader2 } from 'lucide-react'

export function AccountForm({
  open,
  onClose,
  editAccount,
}: {
  open: boolean
  onClose: () => void
  editAccount?: Account
}) {
  const create = useCreateAccount()
  const update = useUpdateAccount()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [type, setType] = useState<Account['type']>('GASTO')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (editAccount) {
      setCode(editAccount.code)
      setName(editAccount.name)
      setType(editAccount.type)
      setDescription(editAccount.description || '')
    } else {
      reset()
    }
  }, [editAccount, open])

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!code.trim() || !name.trim()) return

    if (editAccount) {
      update.mutate(
        { id: editAccount.id, body: { code, name, type, description } },
        { onSuccess: () => { onClose(); reset() } }
      )
    } else {
      create.mutate(
        { code, name, type, description, isActive: true },
        { onSuccess: () => { onClose(); reset() } }
      )
    }
  }

  const reset = () => {
    setCode('')
    setName('')
    setType('GASTO')
    setDescription('')
  }

  const isPending = create.isPending || update.isPending

  return (
    <Modal
      open={open}
      onClose={onClose}
      eyebrow="Contabilidad · Plan de Cuentas"
      title={editAccount ? 'Editar cuenta' : 'Nueva cuenta'}
      description="Las cuentas del PUC base no se pueden eliminar pero sí editar la descripción."
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={isPending}>
            Cancelar
          </Button>
          <Button onClick={() => handleSubmit()} disabled={isPending || !code.trim() || !name.trim()}>
            {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Guardar'}
          </Button>
        </div>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Código</label>
            <Input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Ej: 5115" />
          </div>
          <div>
            <label className="text-sm font-medium">Tipo</label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value as Account['type'])}
              className="mt-1 h-10 w-full px-3 text-sm"
            >
              <option value="ACTIVO">Activo</option>
              <option value="PASIVO">Pasivo</option>
              <option value="PATRIMONIO">Patrimonio</option>
              <option value="INGRESO">Ingreso</option>
              <option value="GASTO">Gasto</option>
              <option value="COSTO">Costo</option>
            </select>
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Nombre</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Ej: Capacitación" />
        </div>
        <div>
          <label className="text-sm font-medium">Descripción</label>
          <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
        </div>
      </form>
    </Modal>
  )
}
