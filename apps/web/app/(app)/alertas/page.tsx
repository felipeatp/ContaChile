"use client"

import { useEffect, useState } from "react"
import { AlertDashboard, type UpcomingAlert, type HistoryAlert } from "@/components/alerts/alert-dashboard"

export default function AlertasPage() {
  const [upcoming, setUpcoming] = useState<UpcomingAlert[]>([])
  const [history, setHistory] = useState<HistoryAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      fetch("/api/alerts/upcoming?daysAhead=90").then(async (r) => {
        if (!r.ok) throw new Error("Failed to fetch upcoming alerts")
        const data = await r.json()
        return data.alerts || []
      }),
      fetch("/api/alerts/history").then(async (r) => {
        if (!r.ok) throw new Error("Failed to fetch alert history")
        const data = await r.json()
        return data.alerts || []
      }),
    ])
      .then(([upcomingData, historyData]) => {
        setUpcoming(upcomingData)
        setHistory(historyData)
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false))
  }, [])

  return (
    <AlertDashboard
      upcoming={upcoming}
      history={history}
      loading={loading}
      error={error}
    />
  )
}
