"use client"

import { useEffect, useState } from "react"
import { JournalReport, type JournalEntry } from "@/components/accounting/journal-report"
import { JournalEntryModal } from "@/components/accounting/journal-entry-modal"
import { ManualEntryForm, type ManualEntryAccount } from "@/components/accounting/manual-entry-form"

export default function LibroDiarioPage() {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [from, setFrom] = useState("")
  const [to, setTo] = useState("")
  const [source, setSource] = useState<"" | "manual" | "dte" | "purchase">("")
  const [formOpen, setFormOpen] = useState(false)
  const [detailEntry, setDetailEntry] = useState<JournalEntry | null>(null)
  const [accounts, setAccounts] = useState<ManualEntryAccount[]>([])

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

  const fetchAccounts = async () => {
    const res = await fetch("/api/accounts?active=true")
    const data = await res.json()
    setAccounts(data.accounts || [])
  }

  useEffect(() => {
    fetchAccounts()
  }, [])

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
        onNewEntry={() => setFormOpen(true)}
      />
      {detailEntry && <JournalEntryModal entry={detailEntry} onClose={() => setDetailEntry(null)} />}
      {formOpen && (
        <ManualEntryForm
          accounts={accounts}
          onClose={() => setFormOpen(false)}
          onSaved={() => {
            setFormOpen(false)
            fetchEntries()
          }}
        />
      )}
    </>
  )
}
