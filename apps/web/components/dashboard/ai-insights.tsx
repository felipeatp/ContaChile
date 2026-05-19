"use client"

import { useQuery } from "@tanstack/react-query"
import {
  Sparkles,
  Loader2,
  Calculator,
  TrendingUp,
  AlertCircle,
  Info,
  Wallet,
  Receipt,
  CreditCard,
  DollarSign,
  PieChart,
  BarChart3,
  TrendingDown,
  ArrowUpRight,
  ArrowDownRight,
  AlertTriangle,
  CheckCircle,
  Clock,
  Calendar,
  FileText,
  Landmark,
  PiggyBank,
  BadgeDollarSign,
  type LucideIcon,
} from "lucide-react"

const iconMap: Record<string, LucideIcon> = {
  Calculator,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  AlertTriangle,
  Info,
  Wallet,
  Receipt,
  CreditCard,
  DollarSign,
  PieChart,
  BarChart3,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle,
  Clock,
  Calendar,
  FileText,
  Landmark,
  PiggyBank,
  BadgeDollarSign,
}

interface Insight {
  text: string
  icon: string
}

export function AIInsights() {
  const { data: insights = [], isLoading } = useQuery<Insight[]>({
    queryKey: ["ai-insights"],
    queryFn: async () => {
      const res = await fetch("/api/ai/insights")
      if (!res.ok) throw new Error("Failed to fetch insights")
      const data = await res.json()
      return data.insights || []
    },
  })

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
        <Loader2 className="h-3 w-3 animate-spin" />
        Consultando analista proactivo...
      </div>
    )
  }

  if (insights.length === 0) return null

  return (
    <section className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
      {insights.map((insight, i) => (
        <InsightCard key={i} insight={insight} />
      ))}
    </section>
  )
}

function InsightCard({ insight }: { insight: Insight }) {
  // Dinámicamente obtener el icono de Lucide
  const IconComponent = iconMap[insight.icon] || Info

  return (
    <div className="group relative overflow-hidden rounded-sm border border-primary/20 bg-primary/5 p-4 transition-all hover:bg-primary/10">
      <div className="flex items-start gap-3">
        <div className="rounded-full bg-primary/10 p-2 text-primary">
          <IconComponent className="h-4 w-4" />
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5">
            <span className="eyebrow !text-[0.6rem] text-primary">IA Insight</span>
            <Sparkles className="h-2.5 w-2.5 text-primary animate-pulse" />
          </div>
          <p className="text-sm font-medium leading-snug text-foreground">
            {insight.text}
          </p>
        </div>
      </div>
    </div>
  )
}
