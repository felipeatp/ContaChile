"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts"
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

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-medium">Documentos por mes</CardTitle>
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
        <CardTitle className="text-sm font-medium">Documentos por mes</CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={200}>
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" fontSize={12} />
            <YAxis fontSize={12} allowDecimals={false} />
            <Tooltip />
            <Bar dataKey="value" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  )
}
