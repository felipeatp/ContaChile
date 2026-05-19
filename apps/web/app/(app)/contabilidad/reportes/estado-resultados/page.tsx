"use client"

import { useEffect, useState } from "react"
import { IncomeStatementReport, type IncomeStatementData } from "@/components/accounting/income-statement-report"

function defaultFrom() {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`
}

function defaultTo() {
  const d = new Date()
  const last = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  return last.toISOString().slice(0, 10)
}

export default function EstadoResultadosPage() {
  const [from, setFrom] = useState(defaultFrom())
  const [to, setTo] = useState(defaultTo())
  const [data, setData] = useState<IncomeStatementData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetch(`/api/accounting/reports/income-statement?from=${from}&to=${to}`)
      .then(async (r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`)
        return r.json()
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [from, to])

  return (
    <IncomeStatementReport
      data={data}
      from={from}
      to={to}
      loading={loading}
      error={error}
      onFromChange={setFrom}
      onToChange={setTo}
      onPrint={() => window.print()}
    />
  )
}
