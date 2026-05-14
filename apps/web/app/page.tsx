import { DocumentTable } from "@/components/documents/document-table"
import { DocumentsResponse } from "@/types"
import { StatsCards } from "@/components/dashboard/stats-cards"
import { DocumentsChart } from "@/components/dashboard/documents-chart"
import { StatusChart } from "@/components/dashboard/status-chart"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { PlusCircle } from "lucide-react"

async function getStats() {
  try {
    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/documents?limit=1000`, {
      cache: 'no-store',
    })
    const json = (await res.json()) as DocumentsResponse
    const docs = json?.documents || []

    return {
      documents: docs,
      recent: docs.slice(0, 5),
    }
  } catch (e) {
    console.warn('[dashboard] getStats failed:', e)
    return {
      documents: [],
      recent: [],
    }
  }
}

export default async function HomePage() {
  const { documents, recent } = await getStats()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Dashboard</h1>
          <p className="text-muted-foreground">Resumen de tu actividad de facturación</p>
        </div>
        <Link href="/emit">
          <Button>
            <PlusCircle className="mr-2 h-4 w-4" />
            Emitir DTE
          </Button>
        </Link>
      </div>

      <StatsCards documents={documents} />

      <div className="grid gap-4 md:grid-cols-2">
        <DocumentsChart documents={documents} />
        <StatusChart documents={documents} />
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold">Documentos recientes</h2>
        <DocumentTable documents={recent} />
      </div>
    </div>
  )
}
