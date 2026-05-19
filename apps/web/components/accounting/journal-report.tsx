"use client"

import { Button } from "@/components/ui/button"
import { Loader2, Plus } from "lucide-react"
import { formatCLP } from "@contachile/validators"
import type { JournalEntry } from "./journal-entry-modal"

export type { JournalEntry, JournalLine } from "./journal-entry-modal"

const SOURCE_TONE: Record<JournalEntry["source"], string> = {
  manual: "bg-secondary text-foreground/80",
  dte: "bg-primary/10 text-primary",
  purchase: "bg-sage/15 text-sage",
}
const SOURCE_LABEL: Record<JournalEntry["source"], string> = {
  manual: "Manual",
  dte: "DTE",
  purchase: "Compra",
}

interface JournalReportProps {
  entries: JournalEntry[]
  loading?: boolean
  from: string
  to: string
  source: "" | "manual" | "dte" | "purchase"
  onFromChange: (from: string) => void
  onToChange: (to: string) => void
  onSourceChange: (source: "" | "manual" | "dte" | "purchase") => void
  onViewEntry: (entry: JournalEntry) => void
  onNewEntry?: () => void
  titlePrefix?: string
}

export function JournalReport({
  entries,
  loading,
  from,
  to,
  source,
  onFromChange,
  onToChange,
  onSourceChange,
  onViewEntry,
  onNewEntry,
  titlePrefix = "Asientos",
}: JournalReportProps) {
  return (
    <div className="space-y-8 animate-fade-up">
      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-3">
            <span className="eyebrow">Contabilidad · Libro Diario</span>
            <span className="h-px w-10 bg-foreground/20" />
            <span className="eyebrow text-muted-foreground/60">
              {entries.length} {entries.length === 1 ? "asiento" : "asientos"}
            </span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
            {titlePrefix}{" "}
            <em className="text-primary not-italic font-medium">cronológicos</em>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Toda partida doble: DTE emitidos, compras registradas y movimientos manuales. Cada asiento debe cuadrar debe = haber.
          </p>
        </div>
        {onNewEntry && (
          <Button onClick={onNewEntry}>
            <Plus className="mr-2 h-4 w-4" /> Nuevo asiento manual
          </Button>
        )}
      </section>

      <section className="card-editorial p-5 flex flex-wrap items-end gap-4">
        <div className="space-y-1.5">
          <label className="text-[0.65rem] font-semibold uppercase tracking-eyebrow text-foreground/70">Desde</label>
          <input
            type="date"
            value={from}
            onChange={(e) => onFromChange(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[0.65rem] font-semibold uppercase tracking-eyebrow text-foreground/70">Hasta</label>
          <input
            type="date"
            value={to}
            onChange={(e) => onToChange(e.target.value)}
          />
        </div>
        <div className="space-y-1.5">
          <label className="text-[0.65rem] font-semibold uppercase tracking-eyebrow text-foreground/70">Fuente</label>
          <select
            value={source}
            onChange={(e) => onSourceChange(e.target.value as "" | "manual" | "dte" | "purchase")}
          >
            <option value="">Todas</option>
            <option value="manual">Manual</option>
            <option value="dte">DTE</option>
            <option value="purchase">Compra</option>
          </select>
        </div>
        {(from || to || source) && (
          <Button variant="ghost" size="sm" onClick={() => { onFromChange(""); onToChange(""); onSourceChange("") }}>
            Limpiar
          </Button>
        )}
      </section>

      <div className="card-editorial overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <div className="p-12 text-center">
            <p className="font-display text-lg text-muted-foreground mb-1">
              Sin asientos en el período
            </p>
            <p className="text-xs text-muted-foreground/70">
              Ajusta los filtros o crea un asiento manual con &ldquo;Nuevo asiento manual&rdquo;.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table-editorial">
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Descripción</th>
                  <th>Referencia</th>
                  <th>Fuente</th>
                  <th data-numeric="true">Total</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((e) => {
                  const total = e.lines.reduce((s, l) => s + l.debit, 0)
                  return (
                    <tr key={e.id}>
                      <td className="font-mono text-xs">{new Date(e.date).toLocaleDateString("es-CL")}</td>
                      <td>{e.description}</td>
                      <td className="font-mono text-xs text-muted-foreground">{e.reference || "—"}</td>
                      <td>
                        <span className={`text-[0.6rem] uppercase tracking-eyebrow font-semibold rounded-sm px-1.5 py-0.5 ${SOURCE_TONE[e.source]}`}>
                          {SOURCE_LABEL[e.source]}
                        </span>
                      </td>
                      <td data-numeric="true" className="font-semibold">{formatCLP(total)}</td>
                      <td className="text-right">
                        <Button variant="ghost" size="sm" onClick={() => onViewEntry(e)}>Ver</Button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
