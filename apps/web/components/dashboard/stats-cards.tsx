"use client"

import { Stat } from "@/components/ui/stat"
import { AnimatedFigure } from "@/components/ui/animated-figure"
import { FileCheck, FileClock, FileX, FileText } from "lucide-react"
import { DocumentStats } from "@/types"

interface StatsCardsProps {
  stats: DocumentStats
}

export function StatsCards({ stats }: StatsCardsProps) {
  const cards = [
    {
      label: "Emitidos hoy",
      value: stats.emittedToday,
      icon: <FileText className="h-4 w-4" />,
      tone: "default" as const,
    },
    {
      label: "Pendientes SII",
      value: stats.byStatus.pending,
      icon: <FileClock className="h-4 w-4" />,
      tone: "warning" as const,
    },
    {
      label: "Aceptados",
      value: stats.byStatus.accepted,
      icon: <FileCheck className="h-4 w-4" />,
      tone: "positive" as const,
    },
    {
      label: "Rechazados",
      value: stats.byStatus.rejected + stats.byStatus.failed,
      icon: <FileX className="h-4 w-4" />,
      tone: "negative" as const,
    },
  ]

  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
      {cards.map((stat) => (
        <Stat
          key={stat.label}
          label={stat.label}
          value={
            <AnimatedFigure
              value={stat.value}
              format={(n) => String(Math.round(n)).padStart(2, "0")}
            />
          }
          tone={stat.tone}
          icon={stat.icon}
        />
      ))}
    </div>
  )
}
