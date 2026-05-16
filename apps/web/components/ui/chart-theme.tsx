"use client"

import * as React from "react"

/**
 * Tema compartido para Recharts:
 * - Paleta CSS-var based para que dark mode funcione automáticamente.
 * - Custom tooltip editorial.
 *
 * Recharts no soporta CSS variables como `fill` en SVG directamente, así
 * que exponemos los HSL crudos a través de un hook que lee del DOM.
 * Para simplificar, usamos los strings HSL directamente y aceptamos que
 * el dark mode requiera repintar (lo que ocurre al cambiar tema porque
 * el componente re-renderiza).
 */

export const CHART_PALETTE = {
  primary: "hsl(var(--oxblood))",
  ochre: "hsl(var(--ochre))",
  sage: "hsl(var(--sage))",
  rust: "hsl(var(--rust))",
  muted: "hsl(var(--muted-foreground))",
  ink: "hsl(var(--foreground))",
  paper: "hsl(var(--paper))",
  border: "hsl(var(--border))",
}

interface TooltipPayloadItem {
  name?: string
  value?: number
  color?: string
  payload?: { color?: string; name?: string; value?: number }
}

interface ChartTooltipProps {
  active?: boolean
  payload?: TooltipPayloadItem[]
  label?: string | number
  formatter?: (value: number) => string
  /** Label override for the row (vs the default name) */
  hideLabel?: boolean
}

/**
 * Editorial tooltip: paper background, ink border, eyebrow caps label,
 * mono tabular figures.
 */
export function ChartTooltip({
  active,
  payload,
  label,
  formatter = (n) => n.toLocaleString("es-CL"),
  hideLabel = false,
}: ChartTooltipProps) {
  if (!active || !payload || payload.length === 0) return null

  return (
    <div className="card-editorial bg-card px-3 py-2 text-xs shadow-[0_8px_24px_-8px_hsl(var(--ink)/0.18)] min-w-[8rem]">
      {!hideLabel && label !== undefined && (
        <div className="eyebrow !text-[0.55rem] mb-1.5">{String(label)}</div>
      )}
      <div className="space-y-1">
        {payload.map((item, i) => {
          const name = item.name ?? item.payload?.name ?? ""
          const value = item.value ?? item.payload?.value ?? 0
          const color = item.color ?? item.payload?.color ?? "currentColor"
          return (
            <div key={i} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span
                  className="block h-1.5 w-1.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-muted-foreground">{name || "Valor"}</span>
              </div>
              <span className="font-mono font-semibold tabular text-foreground">
                {formatter(Number(value))}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

/**
 * Custom legend para PieChart con eyebrow caps + valores en mono.
 *
 * Usar: <Legend content={<ChartLegend />} />
 */
export function ChartLegend({
  payload,
}: {
  payload?: Array<{ value?: string; color?: string; payload?: { value?: number } }>
}) {
  if (!payload) return null
  return (
    <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-3 text-xs">
      {payload.map((p, i) => (
        <div key={i} className="flex items-center gap-1.5">
          <span
            className="block h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: p.color }}
          />
          <span className="text-muted-foreground">{p.value}</span>
          {p.payload?.value !== undefined && (
            <span className="font-mono tabular text-foreground/80">
              {p.payload.value}
            </span>
          )}
        </div>
      ))}
    </div>
  )
}
