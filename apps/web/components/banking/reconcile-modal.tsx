"use client"

import { useState } from "react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Loader2, Sparkles } from "lucide-react"
import { formatCLP } from "@ContAI/validators"

export type ReconcileAccount = { id: string; code: string; name: string; type: string; isActive: boolean }

export type ReconcileSuggestion = {
  clasificacion: string
  codigo_cuenta: string
  tipo: string
  confianza: number
  asiento: { debe: string; haber: string }
  notas?: string
}

export type ReconcileMovement = {
  id: string
  postedAt: string
  amount: number
  type: "CREDIT" | "DEBIT"
  description: string
  counterpartRut?: string | null
  counterpartName?: string | null
  suggestionPayload?: ReconcileSuggestion | null
}

interface ReconcileModalProps {
  movement: ReconcileMovement
  accounts: ReconcileAccount[]
  onClose: () => void
  onReconciled: (debitAccountId: string, creditAccountId: string, description: string) => Promise<void>
}

export function ReconcileModal({ movement, accounts, onClose, onReconciled }: ReconcileModalProps) {
  const sug = movement.suggestionPayload

  const guessFromCode = (code?: string) =>
    accounts.find((a) => a.code === code)?.id ?? ""

  const [debitId, setDebitId] = useState(() => {
    if (sug?.asiento.debe && sug?.codigo_cuenta) {
      return movement.type === "CREDIT" ? "" : guessFromCode(sug.codigo_cuenta)
    }
    return ""
  })
  const [creditId, setCreditId] = useState(() => {
    if (sug?.asiento.haber && sug?.codigo_cuenta) {
      return movement.type === "CREDIT" ? guessFromCode(sug.codigo_cuenta) : ""
    }
    return ""
  })
  const [description, setDescription] = useState(movement.description)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (!debitId || !creditId) {
      setError("Selecciona ambas cuentas")
      return
    }
    if (debitId === creditId) {
      setError("Las cuentas deben ser distintas")
      return
    }
    setError(null)
    setSaving(true)
    try {
      await onReconciled(debitId, creditId, description)
    } catch (err) {
      setError((err as Error).message || "Error al conciliar")
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      eyebrow="Tesorería · Conciliación"
      title="Conciliar movimiento"
      description="Selecciona las cuentas contables que reflejan este movimiento bancario."
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={submit} disabled={saving}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Crear asiento y conciliar"}
          </Button>
        </div>
      }
    >
      <div className="space-y-3">
        <div className="card-editorial bg-secondary/40 p-3 text-sm">
          <div className="eyebrow !text-[0.55rem] mb-1.5">Movimiento</div>
          <div className="font-medium">{movement.description}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {new Date(movement.postedAt).toLocaleDateString("es-CL")} ·{" "}
            <span className={`font-mono tabular ${movement.type === "CREDIT" ? "text-sage" : "text-rust"}`}>
              {movement.type === "CREDIT" ? "+" : "-"}{formatCLP(movement.amount)}
            </span>
            {" · "}{movement.counterpartName || "—"}
          </div>
          {sug && (
            <div className="mt-2 pt-2 border-t border-border/50 text-xs">
              <div className="flex items-center gap-1.5">
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="eyebrow !text-[0.55rem] text-primary">Sugerencia IA</span>
              </div>
              <div className="mt-1 text-foreground/80">
                {sug.clasificacion} ({sug.codigo_cuenta}) — confianza{" "}
                <span className="font-mono tabular">{Math.round(sug.confianza * 100)}%</span>
              </div>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Cuenta Debe</label>
            <select
              value={debitId}
              onChange={(e) => setDebitId(e.target.value)}
              className="mt-1 h-10 w-full px-3 text-sm"
            >
              <option value="">— Seleccionar —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">Cuenta Haber</label>
            <select
              value={creditId}
              onChange={(e) => setCreditId(e.target.value)}
              className="mt-1 h-10 w-full px-3 text-sm"
            >
              <option value="">— Seleccionar —</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>{a.code} — {a.name}</option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium">Descripción del asiento</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 h-10 w-full px-3 text-sm"
          />
        </div>

        {error && (
          <div className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div>
        )}
      </div>
    </Modal>
  )
}
