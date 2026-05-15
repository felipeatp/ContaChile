"use client"

import { useState } from "react"
import Link from "next/link"
import { useDocuments } from "@/hooks/use-documents"
import { DocumentTable } from "@/components/documents/document-table"
import { Button } from "@/components/ui/button"
import { Loader2, Package } from "lucide-react"

export default function DocumentsPage() {
  const [status, setStatus] = useState<string | undefined>(undefined)
  const { data, isLoading } = useDocuments({ status, page: 1, limit: 20 })
  const [envioLoading, setEnvioLoading] = useState(false)

  const handleGenerateEnvio = async () => {
    const pendingWithXml = data?.documents?.filter(
      (d: any) => d.status === "PENDING" && d.xmlContent
    )
    if (!pendingWithXml || pendingWithXml.length === 0) {
      alert("No hay documentos pendientes con XML firmado para enviar")
      return
    }

    setEnvioLoading(true)
    try {
      const res = await fetch("/api/dte/envio", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentIds: pendingWithXml.map((d: any) => d.id) }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        alert(err.error || "Error al generar EnvioDTE")
        setEnvioLoading(false)
        return
      }

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `EnvioDTE-${Date.now()}.xml`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch {
      alert("Error al generar EnvioDTE")
    }
    setEnvioLoading(false)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Documentos</h1>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleGenerateEnvio} disabled={envioLoading}>
            {envioLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Package className="mr-2 h-4 w-4" />}
            Generar EnvioDTE
          </Button>
          <Link href="/emit">
            <Button>Emitir DTE</Button>
          </Link>
        </div>
      </div>

      <div className="flex space-x-2">
        {["Todos", "PENDING", "ACCEPTED", "REJECTED", "FAILED"].map((s) => (
          <Button
            key={s}
            variant={status === s || (s === "Todos" && !status) ? "default" : "outline"}
            size="sm"
            onClick={() => setStatus(s === "Todos" ? undefined : s)}
          >
            {s === "Todos" ? "Todos" : s === "PENDING" ? "Pendientes" : s === "ACCEPTED" ? "Aceptados" : s === "REJECTED" ? "Rechazados" : "Fallidos"}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : (
        <DocumentTable documents={data?.documents || []} />
      )}
    </div>
  )
}
