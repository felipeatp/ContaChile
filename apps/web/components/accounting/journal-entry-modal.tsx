"use client"

import { Modal } from "@/components/ui/modal"
import { formatCLP } from "@ContAI/validators"

export type JournalLine = {
  id: string
  accountId: string
  debit: number
  credit: number
  description?: string | null
  account: { code: string; name: string }
}

export type JournalEntry = {
  id: string
  date: string
  description: string
  reference?: string | null
  source: "manual" | "dte" | "purchase"
  lines: JournalLine[]
}

interface JournalEntryModalProps {
  entry: JournalEntry
  onClose: () => void
}

export function JournalEntryModal({ entry, onClose }: JournalEntryModalProps) {
  const totalDebit = entry.lines.reduce((s, l) => s + l.debit, 0)
  const totalCredit = entry.lines.reduce((s, l) => s + l.credit, 0)
  return (
    <Modal
      open={true}
      onClose={onClose}
      eyebrow="Contabilidad · Libro Diario"
      title={`Asiento · ${new Date(entry.date).toLocaleDateString("es-CL")}`}
      description={entry.description}
      size="lg"
    >
      {entry.reference && (
        <div className="mb-3 text-xs text-muted-foreground">
          <span className="eyebrow !text-[0.55rem] mr-2">Referencia</span>
          <span className="font-mono">{entry.reference}</span>
        </div>
      )}
      <table className="table-editorial card-editorial">
        <thead>
          <tr>
            <th>Código</th>
            <th>Cuenta</th>
            <th data-numeric="true">Debe</th>
            <th data-numeric="true">Haber</th>
          </tr>
        </thead>
        <tbody>
          {entry.lines.map((l) => (
            <tr key={l.id}>
              <td className="font-mono">{l.account.code}</td>
              <td>{l.account.name}</td>
              <td data-numeric="true">{l.debit ? formatCLP(l.debit) : "—"}</td>
              <td data-numeric="true">{l.credit ? formatCLP(l.credit) : "—"}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr>
            <td colSpan={2} className="text-right font-semibold">Totales</td>
            <td data-numeric="true" className="font-semibold">{formatCLP(totalDebit)}</td>
            <td data-numeric="true" className="font-semibold">{formatCLP(totalCredit)}</td>
          </tr>
        </tfoot>
      </table>
    </Modal>
  )
}
