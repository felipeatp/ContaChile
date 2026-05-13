"use client"

import { useState } from "react"
import Link from "next/link"
import { useDocuments } from "@/hooks/use-documents"
import { DocumentTable } from "@/components/documents/document-table"
import { Button } from "@/components/ui/button"

export default function DocumentsPage() {
  const [status, setStatus] = useState<string | undefined>(undefined)
  const { data, isLoading } = useDocuments({ status, page: 1, limit: 20 })

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Documentos</h1>
        <Link href="/emit">
          <Button>Emitir DTE</Button>
        </Link>
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
