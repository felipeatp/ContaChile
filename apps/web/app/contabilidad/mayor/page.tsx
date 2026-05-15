'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Loader2 } from 'lucide-react'

type Account = { id: string; code: string; name: string; type: string }

type Movement = {
  id: string
  date: string
  description: string
  reference?: string | null
  source: string
  debit: number
  credit: number
  balance: number
}

type LedgerResponse = {
  account: Account
  movements: Movement[]
  totals: { debit: number; credit: number; balance: number }
}

export default function LibroMayorPage() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [accountId, setAccountId] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [data, setData] = useState<LedgerResponse | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/accounts?active=true')
      .then((r) => r.json())
      .then((d) => setAccounts(d.accounts || []))
  }, [])

  useEffect(() => {
    if (!accountId) {
      setData(null)
      return
    }
    setLoading(true)
    const params = new URLSearchParams()
    if (from) params.set('from', from)
    if (to) params.set('to', to)
    fetch(`/api/accounting/ledger/${accountId}?${params}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [accountId, from, to])

  const format = (n: number) => `$${n.toLocaleString('es-CL')}`

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Libro Mayor</h1>
        <p className="text-sm text-muted-foreground">Movimientos por cuenta contable.</p>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Selección</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm min-w-[280px]"
          >
            <option value="">— Selecciona una cuenta —</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.code} — {a.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          />
        </CardContent>
      </Card>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total Debe</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{format(data.totals.debit)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total Haber</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{format(data.totals.credit)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Saldo</CardTitle>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${data.totals.balance < 0 ? 'text-destructive' : ''}`}>
                  {format(data.totals.balance)}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>
                {data.account.code} — {data.account.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {data.movements.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">Sin movimientos en el período.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left py-2 px-3">Fecha</th>
                        <th className="text-left py-2 px-3">Descripción</th>
                        <th className="text-left py-2 px-3">Ref.</th>
                        <th className="text-right py-2 px-3">Debe</th>
                        <th className="text-right py-2 px-3">Haber</th>
                        <th className="text-right py-2 px-3">Saldo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.movements.map((m) => (
                        <tr key={m.id} className="border-b last:border-0">
                          <td className="py-2 px-3">{new Date(m.date).toLocaleDateString('es-CL')}</td>
                          <td className="py-2 px-3">{m.description}</td>
                          <td className="py-2 px-3 font-mono text-xs">{m.reference || '—'}</td>
                          <td className="py-2 px-3 text-right font-mono">{m.debit ? format(m.debit) : '—'}</td>
                          <td className="py-2 px-3 text-right font-mono">{m.credit ? format(m.credit) : '—'}</td>
                          <td className="py-2 px-3 text-right font-mono">{format(m.balance)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      ) : (
        <p className="text-sm text-muted-foreground">Selecciona una cuenta para ver sus movimientos.</p>
      )}
    </div>
  )
}
