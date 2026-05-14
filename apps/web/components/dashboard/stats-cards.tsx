"use client"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { FileCheck, FileClock, FileX, FileText } from "lucide-react"
import { Document } from "@/types"

interface StatsCardsProps {
  documents: Document[]
}

export function StatsCards({ documents }: StatsCardsProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const emittedToday = documents.filter((d) => new Date(d.emittedAt) >= today).length
  const pending = documents.filter((d) => d.status === "PENDING").length
  const accepted = documents.filter((d) => d.status === "ACCEPTED").length
  const rejected = documents.filter((d) => d.status === "REJECTED" || d.status === "FAILED").length

  const stats = [
    {
      label: "Emitidos hoy",
      value: emittedToday,
      icon: FileText,
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    {
      label: "Pendientes",
      value: pending,
      icon: FileClock,
      color: "text-amber-600",
      bg: "bg-amber-50",
    },
    {
      label: "Aceptados",
      value: accepted,
      icon: FileCheck,
      color: "text-green-600",
      bg: "bg-green-50",
    },
    {
      label: "Rechazados",
      value: rejected,
      icon: FileX,
      color: "text-red-600",
      bg: "bg-red-50",
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat) => {
        const Icon = stat.icon
        return (
          <Card key={stat.label}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.label}</CardTitle>
              <div className={`${stat.bg} p-2 rounded-lg`}>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}
