"use client"

import { useState, useEffect } from "react"
import { F22Report, type F22Data } from "@/components/tax/f22-report"

export default function ContadorF22Page() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [data, setData] = useState<F22Data | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchF22 = async (y: number) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/f22?year=${y}`)
      if (!res.ok) throw new Error("Error al calcular F22")
      const json = await res.json()
      setData(json)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchF22(year)
  }, [year])

  return (
    <F22Report
      data={data}
      year={year}
      loading={loading}
      error={error}
      onYearChange={setYear}
      onRefresh={() => fetchF22(year)}
      onPrint={() => window.print()}
      titlePrefix="F22 (Contador)"
    />
  )
}
