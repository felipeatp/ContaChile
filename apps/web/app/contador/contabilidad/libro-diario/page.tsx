"use client"

import { useEffect, useState } from "react"
import { JournalReport, type JournalEntry } from "@/components/accounting/journal-report"
import { JournalEntryModal } from "@/components/accounting/journal-entry-modal"

export default function ContadorLibroDiarioPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [source, setSource] = useState<"" | "manual" | "dte" | "purchase">("")
  const [detailEntry, setDetailEntry] = useState<JournalEntry | null>(null)

  const fetchEntries = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (from) params.set("from", from)
      if (to) params.set("to", to)
      if (source) params.set("source", source)
      const res = await fetch(`/api/accounting/journal?${params}`)
      const data = await res.json()
      setEntries(data.entries || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchEntries()
  }, [from, to, source])

  return (
    <>
      <JournalReport
        entries={entries}
        loading={loading}
        from={from}
        to={to}
        source={source}
        onFromChange={setFrom}
        onToChange={setTo}
        onSourceChange={setSource}
        onViewEntry={setDetailEntry}
      />
      {detailEntry && <JournalEntryModal entry={detailEntry} onClose={() => setDetailEntry(null)} />}
    </>
  )
}
