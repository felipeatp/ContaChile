"use client"

import { useEffect, useState } from "react"
import { TrialBalanceReport, type TrialBalanceData } from "@/components/accounting/trial-balance-report"

export default function BalanceComprobacionPage() {
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10))
  const [data, setData] = useState<TrialBalanceData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/accounting/reports/trial-balance?asOf=${asOf}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [asOf])

  return (
    <TrialBalanceReport
      data={data}
      asOf={asOf}
      loading={loading}
      error={error}
      onAsOfChange={setAsOf}
      onPrint={() => window.print()}
    />
  )
}
