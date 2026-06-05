import { DocumentTable } from "@/components/documents/document-table"
import { DocumentsResponse, DocumentStats } from "@/types"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { DocumentsChart } from "@/components/dashboard/documents-chart"
import { StatusChart } from "@/components/dashboard/status-chart"
import { UpcomingAlertsBanner } from "@/components/dashboard/upcoming-alerts-banner"
import { AIInsights } from "@/components/dashboard/ai-insights"
import { RuleOrnament } from "@/components/ui/rule-ornament"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PlusCircle, ArrowUpRight } from "lucide-react"
import { apiFetch } from "@/lib/api-server"

const EMPTY_STATS: DocumentStats = {
  total: 0,
  emittedToday: 0,
  byStatus: { pending: 0, accepted: 0, rejected: 0, failed: 0 },
  monthly: [],
  yoy: { current: 0, previous: 0, deltaPct: 0 },
}

async function getDashboardData(): Promise<{ stats: DocumentStats; recent: DocumentsResponse["documents"] }> {
  const [statsRes, recentRes] = await Promise.all([
    apiFetch("/documents/stats", { method: "GET" }),
    apiFetch("/documents?limit=5", { method: "GET" }),
  ])
  const stats = (statsRes.status < 400 && statsRes.data ? statsRes.data : EMPTY_STATS) as DocumentStats
  const recent = (recentRes.status < 400 && recentRes.data?.documents ? recentRes.data.documents : []) as DocumentsResponse["documents"]
  return { stats, recent }
}

const MONTHS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
]

export default async function DashboardPage() {
  const { stats, recent } = await getDashboardData()
  const today = new Date()
  const periodLabel = `${MONTHS_ES[today.getMonth()]} ${today.getFullYear()}`

  return (
    <div className="space-y-10 animate-fade-up">
      {/* Masthead — editorial intro */}
      <section className="relative">
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-3">
              <span className="eyebrow">Período · {periodLabel}</span>
              <span className="h-px w-10 bg-foreground/20" />
              <span className="eyebrow text-muted-foreground/60">
                Actualizado al{" "}
                {today.toLocaleDateString("es-CL", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            </div>
            <h2 className="font-display text-xl md:text-2xl lg:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
              Estado de tu{" "}
              <em className="font-display font-medium not-italic text-primary">
                operación tributaria
              </em>
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl text-sm leading-relaxed">
              Resumen consolidado de emisión, aceptación SII y vencimientos
              próximos. Una sola página, lectura en menos de un minuto.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/emit">
              <Button size="lg">
                <PlusCircle className="mr-2 h-4 w-4" />
                Emitir DTE
              </Button>
            </Link>
            <Link href="/ventas/cotizaciones">
              <Button size="lg" variant="outline">
                Cotizar
                <ArrowUpRight className="ml-1.5 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      <UpcomingAlertsBanner />
      <AIInsights />

      {/* Métricas */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <span className="eyebrow">I · Métricas operativas</span>
          <span className="text-xs text-muted-foreground/60 font-mono">
            {stats.total} documentos en archivo
          </span>
        </div>
        <StatsCards stats={stats} />
      </section>

      <RuleOrnament ornament="diamond" />

      {/* Gráficos */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <span className="eyebrow">II · Tendencias</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <DocumentsChart stats={stats} />
          <StatusChart stats={stats} />
        </div>
      </section>

      <RuleOrnament ornament="diamond" />

      {/* Documentos recientes */}
      <section>
        <div className="flex items-end justify-between mb-4">
          <div>
            <span className="eyebrow block mb-1">III · Última hora</span>
            <h3 className="font-display text-2xl font-semibold tracking-tightest text-foreground">
              Documentos recientes
            </h3>
          </div>
          <Link
            href="/documents"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            Ver todos
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
        <DocumentTable documents={recent} />
      </section>
    </div>
  )
}
