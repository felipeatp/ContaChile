"use client"

import { Card, CardContent } from "@/components/ui/card"
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ReferenceLine,
} from "recharts"
import { CHART_PALETTE, ChartTooltip } from "@/components/ui/chart-theme"
import { Document } from "@/types"

interface DocumentsChartProps {
  documents: Document[]
}

export function DocumentsChart({ documents }: DocumentsChartProps) {
  const byMonth: Record<string, number> = {}

  documents.forEach((doc) => {
    const date = new Date(doc.emittedAt)
    const key = date.toLocaleString("es-CL", { month: "short", year: "2-digit" })
    byMonth[key] = (byMonth[key] || 0) + 1
  })

  const data = Object.entries(byMonth)
    .sort((a, b) => {
      const months = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"]
      const [ma, ya] = a[0].split(" ")
      const [mb, yb] = b[0].split(" ")
      const yearDiff = parseInt(ya || "0") - parseInt(yb || "0")
      if (yearDiff !== 0) return yearDiff
      return months.indexOf(ma?.toLowerCase() || "") - months.indexOf(mb?.toLowerCase() || "")
    })
    .slice(-6)
    .map(([name, value]) => ({ name, value }))

  const max = data.reduce((m, d) => Math.max(m, d.value), 0)
  const total = data.reduce((s, d) => s + d.value, 0)
  const avg = data.length ? total / data.length : 0
  const peakIdx = data.findIndex((d) => d.value === max)

  if (data.length === 0) {
    return <ChartShell title="Documentos por mes" empty />
  }

  return (
    <ChartShell
      title="Documentos por mes"
      meta={
        <>
          <span>Total {total}</span>
          <span className="text-muted-foreground/40">·</span>
          <span>Promedio {avg.toFixed(1)}/mes</span>
        </>
      }
    >
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={data} margin={{ top: 10, right: 0, left: -20, bottom: 0 }}>
          <CartesianGrid
            stroke={CHART_PALETTE.border}
            strokeDasharray="0"
            vertical={false}
            opacity={0.5}
          />
          <XAxis
            dataKey="name"
            fontSize={10}
            tickLine={false}
            axisLine={{ stroke: CHART_PALETTE.border }}
            tick={{ fill: CHART_PALETTE.muted, fontFamily: "var(--font-mono)" }}
          />
          <YAxis
            fontSize={10}
            allowDecimals={false}
            tickLine={false}
            axisLine={false}
            tick={{ fill: CHART_PALETTE.muted, fontFamily: "var(--font-mono)" }}
            width={32}
          />
          <Tooltip
            content={<ChartTooltip formatter={(n) => `${n} doc${n === 1 ? "" : "s"}.`} />}
            cursor={{ fill: CHART_PALETTE.primary, opacity: 0.06 }}
          />
          <ReferenceLine
            y={avg}
            stroke={CHART_PALETTE.muted}
            strokeDasharray="2 4"
            opacity={0.5}
            label={{
              value: "prom.",
              position: "right",
              fill: CHART_PALETTE.muted,
              fontSize: 9,
              fontFamily: "var(--font-mono)",
            }}
          />
          <Bar dataKey="value" radius={[0, 0, 0, 0]}>
            {data.map((_, i) => (
              <Cell
                key={i}
                fill={i === peakIdx ? CHART_PALETTE.primary : CHART_PALETTE.ink}
                opacity={i === peakIdx ? 1 : 0.7}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </ChartShell>
  )
}

function ChartShell({
  title,
  meta,
  children,
  empty,
}: {
  title: string
  meta?: React.ReactNode
  children?: React.ReactNode
  empty?: boolean
}) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-baseline justify-between mb-3">
          <span className="eyebrow">{title}</span>
          {meta && (
            <div className="flex items-center gap-2 text-[0.65rem] font-mono text-muted-foreground tabular">
              {meta}
            </div>
          )}
        </div>
        {empty ? (
          <div className="h-[220px] flex items-center justify-center text-muted-foreground/60 text-sm font-display">
            Sin datos en el período
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  )
}
