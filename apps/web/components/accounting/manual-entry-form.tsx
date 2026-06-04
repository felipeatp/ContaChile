"use client"

import { useState } from "react"
import { Modal } from "@/components/ui/modal"
import { Button } from "@/components/ui/button"
import { Loader2, Plus, X } from "lucide-react"
import { formatCLP, parseCLP } from "@contachile/validators"

export type ManualEntryAccount = { id: string; code: string; name: string; isActive: boolean }

interface ManualEntryFormProps {
  accounts: ManualEntryAccount[]
  onClose: () => void
  onSaved: () => void
}

export function ManualEntryForm({ accounts, onClose, onSaved }: ManualEntryFormProps) {
  const [date, setDate] = useState(new Date().toISOString().split("T")[0])
  const [description, setDescription] = useState("")
  const [reference, setReference] = useState("")
  const [lines, setLines] = useState([
    { accountId: "", debit: 0, credit: 0 },
    { accountId: "", debit: 0, credit: 0 },
  ])
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const totalDebit = lines.reduce((s, l) => s + (parseCLP(String(l.debit)) || 0), 0)
  const totalCredit = lines.reduce((s, l) => s + (parseCLP(String(l.credit)) || 0), 0)
  const diff = totalDebit - totalCredit
  const balanced = totalDebit === totalCredit && totalDebit > 0

  const addLine = () => setLines([...lines, { accountId: "", debit: 0, credit: 0 }])
  const removeLine = (i: number) => setLines(lines.filter((_, idx) => idx !== i))
  const updateLine = (
    i: number,
    field: "accountId" | "debit" | "credit",
    value: string | number
  ) => {
    setLines(lines.map((l, idx) => (idx === i ? { ...l, [field]: value } : l)))
  }

  const submit = async () => {
    setError(null)
    if (!balanced) {
      setError("El asiento no cuadra")
      return
    }
    if (!description.trim()) {
      setError("Falta la descripción")
      return
    }
    if (lines.some((l) => !l.accountId)) {
      setError("Selecciona cuenta en todas las líneas")
      return
    }
    if (lines.some((l) => (parseCLP(String(l.debit)) > 0) === (parseCLP(String(l.credit)) > 0))) {
      setError("Cada línea debe tener debe o haber (uno y solo uno)")
      return
    }

    setSaving(true)
    try {
      const res = await fetch("/api/accounting/journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date,
          description,
          reference: reference || undefined,
          lines: lines.map((l) => ({
            accountId: l.accountId,
            debit: parseCLP(String(l.debit)) || 0,
            credit: parseCLP(String(l.credit)) || 0,
          })),
        }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error || "Error al guardar")
        return
      }
      onSaved()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal
      open={true}
      onClose={onClose}
      eyebrow="Contabilidad · Libro Diario"
      title="Nuevo asiento manual"
      description="Cada asiento debe cuadrar: la suma del debe debe ser igual a la del haber."
      size="xl"
      footer={
        <div className="flex justify-between items-center gap-2">
          <Button variant="outline" size="sm" onClick={addLine}>
            <Plus className="mr-1 h-3 w-3" /> Agregar línea
          </Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={submit} disabled={saving || !balanced}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Guardar asiento"}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-sm font-medium">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 h-10 w-full px-3 text-sm"
            />
          </div>
          <div>
            <label className="text-sm font-medium">Referencia (opcional)</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              className="mt-1 h-10 w-full px-3 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="text-sm font-medium">Descripción</label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="mt-1 h-10 w-full px-3 text-sm"
          />
        </div>

        <table className="table-editorial card-editorial">
          <thead>
            <tr>
              <th>Cuenta</th>
              <th data-numeric="true">Debe</th>
              <th data-numeric="true">Haber</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lines.map((l, i) => (
              <tr key={i}>
                <td>
                  <select
                    value={l.accountId}
                    onChange={(e) => updateLine(i, "accountId", e.target.value)}
                    className="h-9 w-full px-2 text-sm"
                  >
                    <option value="">— Seleccionar —</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.code} — {a.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={l.debit}
                    onChange={(e) => updateLine(i, "debit", parseCLP(e.target.value))}
                    className="h-9 w-full px-2 text-sm"
                  />
                </td>
                <td>
                  <input
                    type="number"
                    min={0}
                    value={l.credit}
                    onChange={(e) => updateLine(i, "credit", parseCLP(e.target.value))}
                    className="h-9 w-full px-2 text-sm"
                  />
                </td>
                <td className="text-right">
                  {lines.length > 2 && (
                    <Button variant="ghost" size="sm" onClick={() => removeLine(i)} aria-label="Eliminar línea">
                      <X className="h-4 w-4" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className={balanced ? "text-sage" : "text-ochre"}>
              <td className="font-semibold">
                Totales {balanced ? "· cuadra" : `· diferencia ${formatCLP(Math.abs(diff))}`}
              </td>
              <td data-numeric="true" className="font-semibold">{formatCLP(totalDebit)}</td>
              <td data-numeric="true" className="font-semibold">{formatCLP(totalCredit)}</td>
              <td></td>
            </tr>
          </tfoot>
        </table>

        {error && (
          <div className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">{error}</div>
        )}
      </div>
    </Modal>
  )
}
