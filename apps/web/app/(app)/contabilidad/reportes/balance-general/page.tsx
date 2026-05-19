"use client"

import { useEffect, useState } from "react"
import { BalanceSheetReport, type BalanceSheetData } from "@/components/accounting/balance-sheet-report"

export default function BalanceGeneralPage() {
  const [asOf, setAsOf] = useState(new Date().toISOString().slice(0, 10))
  const [data, setData] = useState<BalanceSheetData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/accounting/reports/balance-sheet?asOf=${asOf}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [asOf])

  return (
    <BalanceSheetReport
      data={data}
      asOf={asOf}
      loading={loading}
      error={error}
      onAsOfChange={setAsOf}
      onPrint={() => window.print()}
    />
  )
}
