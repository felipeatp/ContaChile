'use client'

import { useEffect, useState } from 'react'
import { Stat } from '@/components/ui/stat'
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

const fmt = (n: number) => `$ ${n.toLocaleString('es-CL')}`

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

  return (
    <div className="space-y-8 animate-fade-up">
      <section>
        <div className="flex items-center gap-3 mb-3">
          <span className="eyebrow">Contabilidad · Mayor</span>
          <span className="h-px w-10 bg-foreground/20" />
          <span className="eyebrow text-muted-foreground/60">Por cuenta</span>
        </div>
        <h2 className="font-display text-3xl md:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
          Libro{' '}
          <em className="text-primary not-italic font-medium">Mayor</em>
        </h2>
        <p className="mt-2 text-sm text-muted-foreground max-w-2xl">
          Movimientos contables agrupados por cuenta. Selecciona una cuenta y un rango de fechas para ver su kardex.
        </p>
      </section>

      <section className="card-editorial p-5">
        <div className="flex items-center justify-between mb-3">
          <span className="eyebrow">Selección</span>
        </div>
        <div className="flex flex-wrap gap-3">
          <select
            value={accountId}
            onChange={(e) => setAccountId(e.target.value)}
            className="h-10 px-3 text-sm min-w-[280px]"
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
            className="h-10 px-3 text-sm"
          />
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="h-10 px-3 text-sm"
          />
        </div>
      </section>

      {loading ? (
        <div className="flex items-center justify-center h-48">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : data ? (
        <>
          <section>
            <div className="flex items-center justify-between mb-4">
              <span className="eyebrow">I · Resumen</span>
              <span className="text-xs text-muted-foreground/60 font-mono">
                {data.account.code} · {data.account.name}
              </span>
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Stat label="Total Debe" value={fmt(data.totals.debit)} tone="default" />
              <Stat label="Total Haber" value={fmt(data.totals.credit)} tone="default" />
              <Stat
                label="Saldo"
                value={fmt(data.totals.balance)}
                tone={data.totals.balance < 0 ? 'negative' : 'accent'}
                caption={data.totals.balance < 0 ? 'Saldo acreedor' : 'Saldo deudor'}
              />
            </div>
          </section>

          <section>
            <div className="flex items-end justify-between mb-4">
              <div>
                <span className="eyebrow block mb-1">II · Kardex</span>
                <h3 className="font-display text-2xl font-semibold tracking-tightest">
                  Movimientos
                </h3>
              </div>
              <span className="text-xs text-muted-foreground/60 font-mono">
                {data.movements.length} líneas
              </span>
            </div>

            <div className="card-editorial overflow-hidden">
              {data.movements.length === 0 ? (
                <div className="p-12 text-center">
                  <p className="font-display text-lg text-muted-foreground mb-1">
                    Sin movimientos en el período
                  </p>
                </div>
              ) : (
                <table className="table-editorial">
                  <thead>
                    <tr>
                      <th>Fecha</th>
                      <th>Descripción</th>
                      <th>Ref.</th>
                      <th data-numeric="true">Debe</th>
                      <th data-numeric="true">Haber</th>
                      <th data-numeric="true">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.movements.map((m) => (
                      <tr key={m.id}>
                        <td className="text-muted-foreground">
                          {new Date(m.date).toLocaleDateString('es-CL')}
                        </td>
                        <td>{m.description}</td>
                        <td className="font-mono text-xs text-muted-foreground">{m.reference || '—'}</td>
                        <td data-numeric="true">{m.debit ? fmt(m.debit) : '—'}</td>
                        <td data-numeric="true">{m.credit ? fmt(m.credit) : '—'}</td>
                        <td data-numeric="true" className="font-semibold">{fmt(m.balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr>
                      <td colSpan={3} className="text-right font-semibold">Totales</td>
                      <td data-numeric="true" className="font-semibold">{fmt(data.totals.debit)}</td>
                      <td data-numeric="true" className="font-semibold">{fmt(data.totals.credit)}</td>
                      <td data-numeric="true" className="font-bold">{fmt(data.totals.balance)}</td>
                    </tr>
                  </tfoot>
                </table>
              )}
            </div>
          </section>
        </>
      ) : (
        <div className="card-editorial p-12 text-center">
          <p className="font-display text-lg text-muted-foreground mb-1">
            Selecciona una cuenta
          </p>
          <p className="text-xs text-muted-foreground/70">
            Elige cualquier cuenta del PUC para ver sus movimientos.
          </p>
        </div>
      )}
    </div>
  )
}
