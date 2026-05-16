'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Modal } from '@/components/ui/modal'
import { Button } from '@/components/ui/button'
import { Loader2, RefreshCcw, Sparkles, Link as LinkIcon, X, Eye, Trash2 } from 'lucide-react'

type Status = 'PENDING' | 'SUGGESTED' | 'MATCHED_DTE' | 'MATCHED_PURCHASE' | 'RECONCILED' | 'IGNORED'

type BankAccount = {
  id: string
  externalId: string
  institution: string
  holderName: string
  holderId: string
  currency: string
  lastSyncAt?: string | null
}

type Suggestion = {
  clasificacion: string
  codigo_cuenta: string
  tipo: string
  confianza: number
  asiento: { debe: string; haber: string }
  notas?: string
}

type Movement = {
  id: string
  postedAt: string
  amount: number
  type: 'CREDIT' | 'DEBIT'
  description: string
  counterpartRut?: string | null
  counterpartName?: string | null
  status: Status
  suggestionPayload?: Suggestion | null
  matchedDocumentId?: string | null
  matchedPurchaseId?: string | null
  journalEntryId?: string | null
  bankAccount: { institution: string }
}

type Account = { id: string; code: string; name: string; type: string; isActive: boolean }

const STATUS_LABEL: Record<Status, string> = {
  PENDING: 'Pendiente',
  SUGGESTED: 'Sugerido por IA',
  MATCHED_DTE: 'Coincide con DTE',
  MATCHED_PURCHASE: 'Coincide con Compra',
  RECONCILED: 'Conciliado',
  IGNORED: 'Ignorado',
}

const STATUS_COLOR: Record<Status, string> = {
  PENDING: 'bg-yellow-100 text-yellow-800',
  SUGGESTED: 'bg-blue-100 text-blue-800',
  MATCHED_DTE: 'bg-green-100 text-green-800',
  MATCHED_PURCHASE: 'bg-green-100 text-green-800',
  RECONCILED: 'bg-gray-200 text-gray-800',
  IGNORED: 'bg-muted text-muted-foreground',
}

export default function ConciliacionPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [movements, setMovements] = useState<Movement[]>([])
  const [chartAccounts, setChartAccounts] = useState<Account[]>([])
  const [statusFilter, setStatusFilter] = useState<Status | ''>('PENDING')
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reconcileMovement, setReconcileMovement] = useState<Movement | null>(null)

  const loadAccounts = async () => {
    const res = await fetch('/api/bank/accounts')
    const data = await res.json()
    setAccounts(data.accounts || [])
  }

  const loadMovements = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set('status', statusFilter)
      const res = await fetch(`/api/bank/movements?${params}`)
      const data = await res.json()
      setMovements(data.movements || [])
    } finally {
      setLoading(false)
    }
  }

  const loadChartAccounts = async () => {
    const res = await fetch('/api/accounts?active=true')
    const data = await res.json()
    setChartAccounts(data.accounts || [])
  }

  useEffect(() => {
    loadAccounts()
    loadChartAccounts()
  }, [])

  useEffect(() => {
    loadMovements()
  }, [statusFilter])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await fetch('/api/bank/accounts/sync', { method: 'POST' })
      await fetch('/api/bank/movements/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      await loadAccounts()
      await loadMovements()
    } finally {
      setSyncing(false)
    }
  }

  const handleAction = async (movId: string, action: 'match-auto' | 'classify' | 'ignore') => {
    setBusyId(movId)
    try {
      const res = await fetch(`/api/bank/movements/${movId}/${action}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: '{}',
      })
      const result = await res.json()
      if (action === 'match-auto' && !result.matched) {
        alert(`No se encontró match: ${result.reason || 'sin candidatos'}`)
      }
      await loadMovements()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const format = (n: number) => `$${n.toLocaleString('es-CL')}`

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Conciliación Bancaria</h1>
          <p className="text-sm text-muted-foreground">Sincroniza movimientos y concilia con asientos del libro diario.</p>
        </div>
        <Button onClick={handleSync} disabled={syncing}>
          {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
          Sincronizar
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Cuentas bancarias</CardTitle>
        </CardHeader>
        <CardContent>
          {accounts.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no hay cuentas. Haz clic en "Sincronizar" para conectar.</p>
          ) : (
            <div className="space-y-2">
              {accounts.map((a) => (
                <div key={a.id} className="flex items-center justify-between rounded border p-3 text-sm">
                  <div>
                    <div className="font-medium">{a.institution}</div>
                    <div className="text-xs text-muted-foreground">
                      {a.holderName} • {a.holderId} • {a.currency}
                    </div>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Última sync: {a.lastSyncAt ? new Date(a.lastSyncAt).toLocaleString('es-CL') : 'nunca'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-sm">Movimientos</CardTitle>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as Status | '')}
            className="h-9 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="">Todos</option>
            <option value="PENDING">Pendientes</option>
            <option value="SUGGESTED">Sugeridos</option>
            <option value="MATCHED_DTE">Match DTE</option>
            <option value="MATCHED_PURCHASE">Match Compra</option>
            <option value="RECONCILED">Conciliados</option>
            <option value="IGNORED">Ignorados</option>
          </select>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : movements.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">Sin movimientos en este filtro.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3">Fecha</th>
                    <th className="text-left py-2 px-3">Descripción</th>
                    <th className="text-left py-2 px-3">Contraparte</th>
                    <th className="text-right py-2 px-3">Monto</th>
                    <th className="text-left py-2 px-3">Estado</th>
                    <th className="py-2 px-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id} className="border-b last:border-0">
                      <td className="py-2 px-3">{new Date(m.postedAt).toLocaleDateString('es-CL')}</td>
                      <td className="py-2 px-3">
                        <div>{m.description}</div>
                        {m.suggestionPayload && (
                          <div className="text-xs text-blue-700">
                            💡 {m.suggestionPayload.clasificacion} ({m.suggestionPayload.codigo_cuenta}) — conf. {Math.round((m.suggestionPayload.confianza || 0) * 100)}%
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="text-xs">{m.counterpartName || '—'}</div>
                        <div className="text-xs text-muted-foreground font-mono">{m.counterpartRut || ''}</div>
                      </td>
                      <td className={`py-2 px-3 text-right font-mono ${m.type === 'CREDIT' ? 'text-green-600' : 'text-destructive'}`}>
                        {m.type === 'CREDIT' ? '+' : '-'}{format(m.amount)}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`text-xs rounded px-2 py-0.5 ${STATUS_COLOR[m.status]}`}>
                          {STATUS_LABEL[m.status]}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex gap-1 justify-end">
                          {(m.status === 'PENDING' || m.status === 'SUGGESTED') && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busyId === m.id}
                                onClick={() => handleAction(m.id, 'match-auto')}
                                title="Buscar match con DTE/Compra"
                              >
                                <LinkIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busyId === m.id}
                                onClick={() => handleAction(m.id, 'classify')}
                                title="Sugerir con IA"
                              >
                                <Sparkles className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => setReconcileMovement(m)}
                                title="Conciliar"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busyId === m.id}
                                onClick={() => handleAction(m.id, 'ignore')}
                                title="Ignorar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {reconcileMovement && (
        <ReconcileModal
          movement={reconcileMovement}
          accounts={chartAccounts}
          onClose={() => setReconcileMovement(null)}
          onReconciled={() => {
            setReconcileMovement(null)
            loadMovements()
          }}
        />
      )}
    </div>
  )
}

function ReconcileModal({
  movement,
  accounts,
  onClose,
  onReconciled,
}: {
  movement: Movement
  accounts: Account[]
  onClose: () => void
  onReconciled: () => void
}) {
  const sug = movement.suggestionPayload

  // Si hay sugerencia, intentar pre-llenar
  const guessFromCode = (code?: string) =>
    accounts.find((a) => a.code === code)?.id ?? ''

  const [debitId, setDebitId] = useState(() => {
    if (sug?.asiento.debe && sug?.codigo_cuenta) {
      return movement.type === 'CREDIT' ? '' : guessFromCode(sug.codigo_cuenta)
    }
    return ''
  })
  const [creditId, setCreditId] = useState(() => {
    if (sug?.asiento.haber && sug?.codigo_cuenta) {
      return movement.type === 'CREDIT' ? guessFromCode(sug.codigo_cuenta) : ''
    }
    return ''
  })
  const [description, setDescription] = useState(movement.description)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!debitId || !creditId) {
      setError('Selecciona ambas cuentas')
      return
    }
    if (debitId === creditId) {
      setError('Las cuentas deben ser distintas')
      return
    }
    setError(null)
    setSaving(true)
    try {
      const res = await fetch(`/api/bank/movements/${movement.id}/reconcile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ debitAccountId: debitId, creditAccountId: creditId, description }),
      })
      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Error al conciliar')
        return
      }
      onReconciled()
    } finally {
      setSaving(false)
    }
  }

  const format = (n: number) => `$${n.toLocaleString('es-CL')}`

  return (
    <Modal
      open={true}
      onClose={onClose}
      eyebrow="Tesorería · Conciliación"
      title="Conciliar movimiento"
      description="Selecciona las cuentas contables que reflejan este movimiento bancario."
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Crear asiento y conciliar'}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="card-editorial bg-secondary/40 p-3 text-sm">
          <div className="eyebrow !text-[0.55rem] mb-1.5">Movimiento</div>
          <div className="font-medium">{movement.description}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {new Date(movement.postedAt).toLocaleDateString('es-CL')} ·{' '}
            <span className={`font-mono tabular ${movement.type === 'CREDIT' ? 'text-sage' : 'text-rust'}`}>
              {movement.type === 'CREDIT' ? '+' : '-'}{format(movement.amount)}
            </span>
            {' · '}{movement.counterpartName || '—'}
          </div>
          {sug && (
            <div className="mt-2 pt-2 border-t border-border/50 text-xs">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="eyebrow !text-[0.55rem] text-primary">Sugerencia IA</span>
              </div>
              <div className="mt-1 text-foreground/80">
                {sug.clasificacion} ({sug.codigo_cuenta}) — confianza{' '}
                <span className="font-mono tabular">{Math.round(sug.confianza * 100)}%</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Cuenta Debe</label>
            <select
              value={debitId}
              onChange={(e) => setDebitId(e.target.value)}
              className="mt-1 h-10 w-full px-3 text-sm"
            >
              <option value="">— Seleccionar —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Cuenta Haber</label>
            <select
              value={creditId}
              onChange={(e) => setCreditId(e.target.value)}
              className="mt-1 h-10 w-full px-3 text-sm"
            >
              <option value="">— Seleccionar —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Descripción del asiento</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 h-10 w-full px-3 text-sm"
          />
        </div>

        {error && (
          <div className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div>
        )}
      </div>
    </Modal>
  )
}
