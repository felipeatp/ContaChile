import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { DocumentTable } from "@/components/documents/document-table"
import { DocumentsResponse } from "@/types"
import Link from "next/link"
import { Button } from "@/components/ui/button"

async function getStats() {
  try {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const res = await fetch(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/documents?limit=1000`, {
      cache: 'no-store',
    })
    const json = (await res.json()) as DocumentsResponse
    const docs = json?.documents || []

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
  const stats = await getStats()

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Dashboard</h1>
        <Link href="/emit">
          <Button>Emitir DTE</Button>
        </Link>
      </div>

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
