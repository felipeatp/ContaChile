"use client"

import { Card, CardContent } from "@/components/ui/card"
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { CHART_PALETTE, ChartTooltip } from "@/components/ui/chart-theme"
import { Document } from "@/types"

interface StatusChartProps {
  documents: Document[]
}

const COLORS: Record<string, string> = {
  PENDING: CHART_PALETTE.ochre,
  ACCEPTED: CHART_PALETTE.sage,
  REJECTED: CHART_PALETTE.rust,
  FAILED: CHART_PALETTE.rust,
}

const LABELS: Record<string, string> = {
  PENDING: "Pendiente",
  ACCEPTED: "Aceptado",
  REJECTED: "Rechazado",
  FAILED: "Fallido",
}

export function StatusChart({ documents }: StatusChartProps) {
  const byStatus: Record<string, number> = {}
  documents.forEach((doc) => {
    byStatus[doc.status] = (byStatus[doc.status] || 0) + 1
  })

  const data = Object.entries(byStatus).map(([status, value]) => ({
    name: LABELS[status] || status,
    value,
    color: COLORS[status] || CHART_PALETTE.muted,
  }))

  const total = data.reduce((s, d) => s + d.value, 0)
  const accepted = byStatus["ACCEPTED"] || 0
  const acceptedPct = total > 0 ? Math.round((accepted / total) * 100) : 0

  if (data.length === 0) {
    return (
      <Card>
        <CardContent className="p-5">
          <span className="eyebrow">Estado de documentos</span>
          <div className="h-[220px] flex items-center justify-center text-muted-foreground/60 text-sm font-display mt-3">
            Sin datos en el período
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-baseline justify-between mb-3">
          <span className="eyebrow">Estado de documentos</span>
          <span className="text-[0.65rem] font-mono text-muted-foreground tabular">
            {accepted}/{total} aceptados · {acceptedPct}%
          </span>
        </div>

        <div className="relative grid grid-cols-2 gap-4 items-center">
          {/* Donut */}
          <div className="relative h-[180px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  cx="50%"
                  cy="50%"
                  innerRadius={56}
                  outerRadius={82}
                  paddingAngle={1}
                  dataKey="value"
                  startAngle={90}
                  endAngle={-270}
                  stroke={CHART_PALETTE.paper}
                  strokeWidth={2}
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  content={
                    <ChartTooltip
                      hideLabel
                      formatter={(n) => `${n} (${Math.round((n / total) * 100)}%)`}
                    />
                  }
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Big center number */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="font-mono font-bold text-3xl tabular tracking-tightest text-foreground">
                {total}
              </span>
              <span className="eyebrow !text-[0.55rem] mt-1">documentos</span>
            </div>
          </div>

          {/* Custom legend with values */}
          <div className="space-y-2">
            {data
              .sort((a, b) => b.value - a.value)
              .map((d, i) => {
                const pct = total > 0 ? Math.round((d.value / total) * 100) : 0
                return (
                  <div key={i} className="flex items-baseline gap-2">
                    <span
                      className="block h-2 w-2 rounded-full shrink-0"
                      style={{ backgroundColor: d.color }}
                    />
                    <span className="text-xs text-muted-foreground flex-1">{d.name}</span>
                    <span className="font-mono text-xs font-medium tabular text-foreground">
                      {d.value}
                    </span>
                    <span className="font-mono text-[0.65rem] text-muted-foreground/60 tabular w-8 text-right">
                      {pct}%
                    </span>
                  </div>
                )
              })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
