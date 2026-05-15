"use client"

import Link from "next/link"
import { Document } from "@/types"
import { StatusBadge } from "./status-badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
  return (
    <div className="rounded-md border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Folio</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Receptor</TableHead>
            <TableHead>Total</TableHead>
            <TableHead>Estado</TableHead>
            <TableHead>Fecha</TableHead>
            <TableHead className="text-right">Acciones</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-muted-foreground">
                No hay documentos
              </TableCell>
            </TableRow>
          ) : (
            documents.map((doc) => (
              <TableRow key={doc.id}>
                <TableCell>
                  <Link
                    href={`/documents/${doc.id}`}
                    className="font-medium hover:underline"
                  >
                    {doc.folio}
                  </Link>
                </TableCell>
                <TableCell>{doc.type}</TableCell>
                <TableCell>{doc.receiverName}</TableCell>
                <TableCell>${doc.totalAmount.toLocaleString("es-CL")}</TableCell>
                <TableCell>
                  <StatusBadge status={doc.status} />
                </TableCell>
                <TableCell>
                  {new Date(doc.emittedAt).toLocaleDateString("es-CL")}
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Descargar XML"
                      onClick={() => handleDownloadXML(doc)}
                    >
                      <FileCode2 className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      title="Descargar PDF"
                      onClick={() => handleDownloadPDF(doc)}
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
