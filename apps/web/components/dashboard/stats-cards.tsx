"use client"

import { Stat } from "@/components/ui/stat"
import { FileCheck, FileClock, FileX, FileText } from "lucide-react"
import { Document } from "@/types"

interface StatsCardsProps {
  documents: Document[]
}

export function StatsCards({ documents }: StatsCardsProps) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const emittedToday = documents.filter(
    (d) => new Date(d.emittedAt) >= today
  ).length
  const pending = documents.filter((d) => d.status === "PENDING").length
  const accepted = documents.filter((d) => d.status === "ACCEPTED").length
  const rejected = documents.filter(
    (d) => d.status === "REJECTED" || d.status === "FAILED"
  ).length

  const stats = [
    {
      label: "Emitidos hoy",
      value: emittedToday,
      icon: <FileText className="h-4 w-4" />,
      tone: "default" as const,
    },
    {
      label: "Pendientes SII",
      value: pending,
      icon: <FileClock className="h-4 w-4" />,
      tone: "warning" as const,
    },
    {
      label: "Aceptados",
      value: accepted,
      icon: <FileCheck className="h-4 w-4" />,
      tone: "positive" as const,
    },
    {
      label: "Rechazados",
      value: rejected,
      icon: <FileX className="h-4 w-4" />,
      tone: "negative" as const,
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {stats.map((stat, i) => (
        <Stat
          key={stat.label}
          label={stat.label}
          value={String(stat.value).padStart(2, "0")}
          tone={stat.tone}
          icon={stat.icon}
          style={{ animationDelay: `${i * 60}ms` }}
          className="animate-fade-up"
        />
      ))}
    </div>
  )
}
