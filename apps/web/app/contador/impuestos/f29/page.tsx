"use client"

import { useEffect, useState } from "react"
import { F29Report, type F29Data } from "@/components/tax/f29-report"

export default function ContadorF29Page() {
  const [data, setData] = useState<F29Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)

  const fetchData = () => {
    setLoading(true)
    fetch(`/api/f29?year=${year}&month=${month}`)
      .then((res) => res.json())
      .then((json) => {
        setData(json)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchData()
  }, [year, month])

  const handleExportCsv = () => {
    const url = `/api/f29/export?year=${year}&month=${month}`
    const a = document.createElement("a")
    a.href = url
    a.download = `F29_${year}${String(month).padStart(2, "0")}.csv`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <F29Report
      data={data}
      year={year}
      month={month}
      loading={loading}
      onYearChange={setYear}
      onMonthChange={setMonth}
      onRefresh={fetchData}
      onExportCsv={handleExportCsv}
      onPrint={() => window.print()}
    />
  )
}
