import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DocumentTable } from "@/components/documents/document-table"
import { apiFetch } from "@/lib/api-server"
import { DocumentsResponse } from "@/types"

async function getStats() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const { data } = await apiFetch(`/documents?limit=1000`)
    const docs = (data as DocumentsResponse)?.documents || []

    const todayDocs = docs.filter((d) => new Date(d.emittedAt) >= today)
    const pending = docs.filter((d) => d.status === "PENDING").length
    const accepted = docs.filter((d) => d.status === "ACCEPTED").length

    return {
      emittedToday: todayDocs.length,
      pending,
      accepted,
      recent: docs.slice(0, 5),
    }
  } catch (e) {
    console.warn('[dashboard] getStats failed:', e)
    return {
      emittedToday: 0,
      pending: 0,
      accepted: 0,
      recent: [],
    }
  }
}

export default async function HomePage() {
  console.log('[HomePage] rendering')
  const stats = await getStats()
  console.log('[HomePage] stats:', stats)

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Dashboard</h1>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Emitidos hoy</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.emittedToday}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pendientes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aceptados</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.accepted}</div>
          </CardContent>
        </Card>
      </div>

      <div>
        <h2 className="mb-4 text-xl font-semibold">Documentos recientes</h2>
        <DocumentTable documents={stats.recent} />
      </div>
    </div>
  )
}
