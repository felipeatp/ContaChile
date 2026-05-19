"use client"

import { useEffect, useState } from "react"
import {
  BankReconciliationReport,
  type BankAccount,
  type BankMovement,
  type BankStatus,
} from "@/components/banking/bank-reconciliation-report"
import { ReconcileModal, type ReconcileAccount } from "@/components/banking/reconcile-modal"

export default function ContadorConciliacionPage() {
  const [accounts, setAccounts] = useState<BankAccount[]>([])
  const [movements, setMovements] = useState<BankMovement[]>([])
  const [chartAccounts, setChartAccounts] = useState<ReconcileAccount[]>([])
  const [statusFilter, setStatusFilter] = useState<BankStatus | "">("PENDING")
  const [loading, setLoading] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [reconcileMovement, setReconcileMovement] = useState<BankMovement | null>(null)

  const loadAccounts = async () => {
    const res = await fetch("/api/bank/accounts")
    const data = await res.json()
    setAccounts(data.accounts || [])
  }

  const loadMovements = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (statusFilter) params.set("status", statusFilter)
      const res = await fetch(`/api/bank/movements?${params}`)
      const data = await res.json()
      setMovements(data.movements || [])
    } finally {
      setLoading(false)
    }
  }

  const loadChartAccounts = async () => {
    const res = await fetch("/api/accounts?active=true")
    const data = await res.json()
    setChartAccounts(data.accounts || [])
  }

  useEffect(() => {
    loadAccounts()
    loadChartAccounts()
  }, [])

  useEffect(() => {
    loadMovements()
  }, [statusFilter])

  const handleSync = async () => {
    setSyncing(true)
    try {
      await Promise.all([
        fetch("/api/bank/accounts/sync", { method: "POST" }),
        fetch("/api/bank/movements/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: "{}",
        }),
      ])
      await Promise.all([loadAccounts(), loadMovements()])
    } finally {
      setSyncing(false)
    }
  }

  const handleAction = async (movId: string, action: "match-auto" | "classify" | "ignore") => {
    setBusyId(movId)
    try {
      const res = await fetch(`/api/bank/movements/${movId}/${action}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "{}",
      })
      const result = await res.json()
      if (action === "match-auto" && !result.matched) {
        alert(`No se encontró match: ${result.reason || "sin candidatos"}`)
      }
      await loadMovements()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const handleChangeMode = async (accountId: string, mode: "REAL" | "SIMULATED" | "DEMO") => {
    const res = await fetch(`/api/bank/accounts/${accountId}/mode`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode }),
    })
    const data = await res.json()
    if (data.error) {
      alert(data.error)
      return
    }
    await loadAccounts()
  }

  const handleReconciled = async (debitId: string, creditId: string, description: string) => {
    if (!reconcileMovement) return
    const res = await fetch(`/api/bank/movements/${reconcileMovement.id}/reconcile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ debitAccountId: debitId, creditAccountId: creditId, description }),
    })
    if (!res.ok) {
      const err = await res.json()
      throw new Error(err.error || "Error al conciliar")
    }
    setReconcileMovement(null)
    await loadMovements()
  }

  return (
    <>
      <BankReconciliationReport
        accounts={accounts}
        movements={movements}
        statusFilter={statusFilter}
        loading={loading}
        syncing={syncing}
        busyId={busyId}
        onStatusChange={setStatusFilter}
        onSync={handleSync}
        onAction={handleAction}
        onReconcile={setReconcileMovement}
        onChangeMode={handleChangeMode}
        canConnectReal={false}
        titlePrefix="Conciliación (Contador)"
      />
      {reconcileMovement && (
        <ReconcileModal
          movement={reconcileMovement}
          accounts={chartAccounts}
          onClose={() => setReconcileMovement(null)}
          onReconciled={handleReconciled}
        />
      )}
    </>
  )
}
