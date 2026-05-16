import { DocumentTable } from "@/components/documents/document-table"
import { DocumentsResponse } from "@/types"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { DocumentsChart } from "@/components/dashboard/documents-chart"
import { StatusChart } from "@/components/dashboard/status-chart"
import { UpcomingAlertsBanner } from "@/components/dashboard/upcoming-alerts-banner"
import { RuleOrnament } from "@/components/ui/rule-ornament"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PlusCircle, ArrowUpRight } from "lucide-react"

async function getStats() {
  try {
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/api/documents?limit=1000`,
      { cache: "no-store" }
    )
    const json = (await res.json()) as DocumentsResponse
    const docs = json?.documents || []
    return { documents: docs, recent: docs.slice(0, 5) }
  } catch (e) {
    console.warn("[dashboard] getStats failed:", e)
    return { documents: [], recent: [] }
  }
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
  const { documents, recent } = await getStats()
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
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.05] tracking-tightest text-foreground">
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

      {/* Métricas */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <span className="eyebrow">I · Métricas operativas</span>
          <span className="text-xs text-muted-foreground/60 font-mono">
            {documents.length} documentos en archivo
          </span>
        </div>
        <StatsCards documents={documents} />
      </section>

      <RuleOrnament ornament="diamond" />

      {/* Gráficos */}
      <section>
        <div className="flex items-center justify-between mb-4">
          <span className="eyebrow">II · Tendencias</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <DocumentsChart documents={documents} />
          <StatusChart documents={documents} />
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
