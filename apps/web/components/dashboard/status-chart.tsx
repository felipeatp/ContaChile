"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts"
import { Document } from "@/types"

interface StatusChartProps {
  documents: Document[]
}

const COLORS = {
  PENDING: "hsl(45, 93%, 47%)",   // amber
  ACCEPTED: "hsl(142, 71%, 45%)",  // green
  REJECTED: "hsl(0, 84%, 60%)",    // red
  FAILED: "hsl(0, 72%, 51%)",      // darker red
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
    color: COLORS[status as keyof typeof COLORS] || "#8884d8",
  }))

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Estado de documentos</CardTitle>
        </CardHeader>
        <CardContent className="h-[200px] flex items-center justify-center text-muted-foreground text-sm">
          Sin datos
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Estado de documentos</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={50}
              outerRadius={80}
              paddingAngle={4}
              dataKey="value"
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip />
            <Legend fontSize={12} />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
