"use client"

import { useEffect, useState } from "react"
import { LedgerReport, type LedgerAccount, type LedgerData } from "@/components/accounting/ledger-report"

export default function ContadorLibroMayorPage() {
  const [accounts, setAccounts] = useState<LedgerAccount[]>([])
  const [accountId, setAccountId] = useState("")
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [data, setData] = useState<LedgerData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch("/api/accounts?active=true")
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
    if (from) params.set("from", from)
    if (to) params.set("to", to)
    fetch(`/api/accounting/ledger/${accountId}?${params}`)
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false))
  }, [accountId, from, to])

  return (
    <LedgerReport
      accounts={accounts}
      data={data}
      accountId={accountId}
      from={from}
      to={to}
      loading={loading}
      onAccountChange={setAccountId}
      onFromChange={setFrom}
      onToChange={setTo}
    />
  )
}
