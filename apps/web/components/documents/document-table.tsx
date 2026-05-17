"use client"

import Link from "next/link"
import { Document } from "@/types"
import { StatusBadge } from "./status-badge"
import { Button } from "@/components/ui/button"
import { FileCode2, Download } from "lucide-react"

interface DocumentTableProps {
  documents: Document[]
}

function handleDownloadXML(doc: Document) {
  fetch(`/api/documents/${doc.id}/xml`)
    .then((res) => {
      if (!res.ok) throw new Error("Error al descargar XML")
      return res.blob()
    })
    .then((blob) => {
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `DTE-${doc.type}-${doc.folio}.xml`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    })
    .catch(() => alert("Error al descargar el XML"))
}

function handleDownloadPDF(doc: Document) {
  fetch(`/api/documents/${doc.id}/pdf`)
    .then((res) => {
      if (!res.ok) throw new Error("Error al descargar PDF")
      return res.blob()
    })
    .then((blob) => {
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `dte-${doc.type}-${doc.folio}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    })
    .catch(() => alert("Error al descargar el PDF"))
}

export function DocumentTable({ documents }: DocumentTableProps) {
  if (documents.length === 0) {
    return (
      <div className="card-editorial p-12 text-center">
        <p className="font-display text-lg text-muted-foreground mb-1">
          Sin documentos
        </p>
        <p className="text-xs text-muted-foreground/70">
          Ajusta los filtros o emite tu primer DTE.
        </p>
      </div>
    )
  }

  return (
    <div className="card-editorial overflow-hidden">
      <div className="overflow-x-auto">
        <table className="table-editorial">
          <thead>
            <tr>
              <th>Folio</th>
              <th>Tipo</th>
              <th>Receptor</th>
              <th data-numeric="true">Total</th>
              <th>Estado</th>
              <th>Fecha</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {documents.map((doc) => (
              <tr key={doc.id}>
                <td className="font-mono">
                  <Link
                    href={`/documents/${doc.id}`}
                    className="font-medium underline-offset-4 hover:underline"
                  >
                    {doc.folio}
                  </Link>
                </td>
                <td className="text-muted-foreground">{doc.type}</td>
                <td>{doc.receiverName}</td>
                <td data-numeric="true" className="font-semibold">${doc.totalAmount.toLocaleString("es-CL")}</td>
                <td>
                  <StatusBadge status={doc.status} />
                </td>
                <td className="font-mono text-xs text-muted-foreground">
                  {new Date(doc.emittedAt).toLocaleDateString("es-CL")}
                </td>
                <td className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      title="Descargar XML"
                      onClick={() => handleDownloadXML(doc)}
                    >
                      <FileCode2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-foreground"
                      title="Descargar PDF"
                      onClick={() => handleDownloadPDF(doc)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
