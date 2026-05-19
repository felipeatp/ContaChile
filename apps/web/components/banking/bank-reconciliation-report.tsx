"use client"

import { Button } from "@/components/ui/button"
import { Loader2, RefreshCcw, Sparkles, Link as LinkIcon, Eye, Trash2, Landmark } from "lucide-react"
import { formatCLP } from "@contachile/validators"
import { ConnectBankButton } from "./connect-bank-button"

export type BankStatus = "PENDING" | "SUGGESTED" | "MATCHED_DTE" | "MATCHED_PURCHASE" | "RECONCILED" | "IGNORED"

export type BankAccountMode = "REAL" | "SIMULATED" | "DEMO"

export type BankAccount = {
  id: string
  externalId: string
  institution: string
  holderName: string
  holderId: string
  currency: string
  mode: BankAccountMode
  lastSyncAt?: string | null
}

export type BankSuggestion = {
  clasificacion: string
  codigo_cuenta: string
  tipo: string
  confianza: number
  asiento: { debe: string; haber: string }
  notas?: string
}

export type BankMovement = {
  id: string
  postedAt: string
  amount: number
  type: "CREDIT" | "DEBIT"
  description: string
  counterpartRut?: string | null
  counterpartName?: string | null
  status: BankStatus
  suggestionPayload?: BankSuggestion | null
}

const STATUS_LABEL: Record<BankStatus, string> = {
  PENDING: "Pendiente",
  SUGGESTED: "Sugerido por IA",
  MATCHED_DTE: "Coincide con DTE",
  MATCHED_PURCHASE: "Coincide con Compra",
  RECONCILED: "Conciliado",
  IGNORED: "Ignorado",
}

const STATUS_COLOR: Record<BankStatus, string> = {
  PENDING: "bg-yellow-100 text-yellow-800",
  SUGGESTED: "bg-blue-100 text-blue-800",
  MATCHED_DTE: "bg-green-100 text-green-800",
  MATCHED_PURCHASE: "bg-green-100 text-green-800",
  RECONCILED: "bg-gray-200 text-gray-800",
  IGNORED: "bg-muted text-muted-foreground",
}

const MODE_LABEL: Record<BankAccountMode, string> = {
  REAL: "Real",
  SIMULATED: "Simulado",
  DEMO: "Demo",
}

const MODE_COLOR: Record<BankAccountMode, string> = {
  REAL: "bg-emerald-100 text-emerald-800 border-emerald-200",
  SIMULATED: "bg-amber-100 text-amber-800 border-amber-200",
  DEMO: "bg-purple-100 text-purple-800 border-purple-200",
}

interface BankReconciliationReportProps {
  accounts: BankAccount[]
  movements: BankMovement[]
  statusFilter: BankStatus | ""
  loading?: boolean
  syncing?: boolean
  busyId?: string | null
  onStatusChange: (status: BankStatus | "") => void
  onSync: () => void
  onAction: (movId: string, action: "match-auto" | "classify" | "ignore") => void
  onReconcile: (movement: BankMovement) => void
  onConnectBank?: (linkToken: string) => void
  onChangeMode?: (accountId: string, mode: BankAccountMode) => void
  titlePrefix?: string
  canConnectReal?: boolean
}

export function BankReconciliationReport({
  accounts,
  movements,
  statusFilter,
  loading,
  syncing,
  busyId,
  onStatusChange,
  onSync,
  onAction,
  onReconcile,
  onConnectBank,
  onChangeMode,
  titlePrefix = "Conciliación",
  canConnectReal = false,
}: BankReconciliationReportProps) {
  return (
    <div className="space-y-8 animate-fade-up">
      <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
        <div className="max-w-2xl">
          <div className="flex items-center gap-3 mb-3">
            <span className="eyebrow">Tesorería · Conciliación</span>
            <span className="h-px w-10 bg-foreground/20" />
            <span className="eyebrow text-muted-foreground/60">
              {movements.length} movimientos
            </span>
          </div>
          <h2 className="font-display text-3xl md:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
            {titlePrefix}{" "}
            <em className="text-primary not-italic font-medium">bancaria</em>
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sincroniza movimientos desde el banco, busca match automático con DTEs/Compras o pídele a la IA que sugiera un asiento.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {canConnectReal && onConnectBank && (
            <ConnectBankButton onSuccess={onConnectBank} />
          )}
          <Button onClick={onSync} disabled={syncing}>
            {syncing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCcw className="mr-2 h-4 w-4" />}
            Sincronizar
          </Button>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <span className="eyebrow">I · Cuentas bancarias</span>
        </div>
        <div className="card-editorial p-5">
          {accounts.length === 0 ? (
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                Aún no hay cuentas. Haz clic en &ldquo;Sincronizar&rdquo; para generar datos simulados, o usa &ldquo;Conectar banco real&rdquo; para vincular tu cuenta.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {accounts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between border-b border-border/60 last:border-0 pb-2 last:pb-0 text-sm"
                >
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-medium">{a.institution}</div>
                      <div className="text-xs text-muted-foreground font-mono">
                        {a.holderName} · {a.holderId} · {a.currency}
                      </div>
                    </div>
                    <span className={`text-[0.65rem] rounded px-1.5 py-0.5 border ${MODE_COLOR[a.mode]}`}>
                      {MODE_LABEL[a.mode]}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {onChangeMode && (
                      <select
                        value={a.mode}
                        onChange={(e) => onChangeMode(a.id, e.target.value as BankAccountMode)}
                        className="h-7 text-xs px-2"
                        title="Cambiar modo"
                      >
                        <option value="REAL">Real</option>
                        <option value="SIMULATED">Simulado</option>
                        <option value="DEMO">Demo</option>
                      </select>
                    )}
                    <div className="text-[0.65rem] font-mono text-muted-foreground/60 tabular">
                      Sync: {a.lastSyncAt ? new Date(a.lastSyncAt).toLocaleString("es-CL") : "nunca"}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="flex items-end justify-between mb-3">
          <div>
            <span className="eyebrow block mb-1">II · Movimientos</span>
            <h3 className="font-display text-2xl font-semibold tracking-tightest">
              Cartola bancaria
            </h3>
          </div>
          <select
            value={statusFilter}
            onChange={(e) => onStatusChange(e.target.value as BankStatus | "")}
            className="h-9 px-3 text-sm"
          >
            <option value="">Todos</option>
            <option value="PENDING">Pendientes</option>
            <option value="SUGGESTED">Sugeridos</option>
            <option value="MATCHED_DTE">Match DTE</option>
            <option value="MATCHED_PURCHASE">Match Compra</option>
            <option value="RECONCILED">Conciliados</option>
            <option value="IGNORED">Ignorados</option>
          </select>
        </div>

        <div className="card-editorial overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : movements.length === 0 ? (
            <div className="p-12 text-center">
              <p className="font-display text-lg text-muted-foreground mb-1">
                Sin movimientos en este filtro
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="table-editorial">
                <thead>
                  <tr>
                    <th>Fecha</th>
                    <th>Descripción</th>
                    <th>Contraparte</th>
                    <th data-numeric="true">Monto</th>
                    <th>Estado</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td className="text-muted-foreground">{new Date(m.postedAt).toLocaleDateString("es-CL")}</td>
                      <td>
                        <div>{m.description}</div>
                        {m.suggestionPayload && (
                          <div className="text-xs text-blue-700">
                            💡 {m.suggestionPayload.clasificacion} ({m.suggestionPayload.codigo_cuenta}) — conf. {Math.round((m.suggestionPayload.confianza || 0) * 100)}%
                          </div>
                        )}
                      </td>
                      <td className="py-2 px-3">
                        <div className="text-xs">{m.counterpartName || "—"}</div>
                        <div className="text-xs text-muted-foreground font-mono">{m.counterpartRut || ""}</div>
                      </td>
                      <td className={`py-2 px-3 text-right font-mono ${m.type === "CREDIT" ? "text-green-600" : "text-destructive"}`}>
                        {m.type === "CREDIT" ? "+" : "-"}{formatCLP(m.amount)}
                      </td>
                      <td className="py-2 px-3">
                        <span className={`text-xs rounded px-2 py-0.5 ${STATUS_COLOR[m.status]}`}>
                          {STATUS_LABEL[m.status]}
                        </span>
                      </td>
                      <td className="py-2 px-3">
                        <div className="flex gap-1 justify-end">
                          {(m.status === "PENDING" || m.status === "SUGGESTED") && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busyId === m.id}
                                onClick={() => onAction(m.id, "match-auto")}
                                title="Buscar match con DTE/Compra"
                              >
                                <LinkIcon className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busyId === m.id}
                                onClick={() => onAction(m.id, "classify")}
                                title="Sugerir con IA"
                              >
                                <Sparkles className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => onReconcile(m)}
                                title="Conciliar"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busyId === m.id}
                                onClick={() => onAction(m.id, "ignore")}
                                title="Ignorar"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  )
}
