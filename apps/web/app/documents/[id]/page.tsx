"use client"

import { useParams } from "next/navigation"
import Link from "next/link"
import { useDocument } from "@/hooks/use-documents"
import { StatusBadge } from "@/components/documents/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { ArrowLeft, Download, Copy, FileText } from "lucide-react"

export default function DocumentDetailPage() {
  const params = useParams()
  const id = params.id as string
  const { data: doc, isLoading } = useDocument(id)

  const handleDownloadPDF = async () => {
    try {
      const res = await fetch(`/api/documents/${id}/pdf`)
      if (!res.ok) throw new Error("Error al descargar PDF")
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `dte-${doc?.type}-${doc?.folio}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (e) {
      alert("Error al descargar el PDF")
    }
  }

  if (isLoading) {
    return <p className="text-muted-foreground">Cargando...</p>
  }

  if (!doc) {
    return <p className="text-destructive">Documento no encontrado</p>
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center space-x-4">
          <Link href="/documents">
            <Button variant="outline" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-3xl font-bold">Documento #{doc.folio}</h1>
        </div>
        <div className="flex items-center space-x-2">
          <Button variant="outline" onClick={handleDownloadPDF}>
            <Download className="mr-2 h-4 w-4" />
            Descargar PDF
          </Button>
          <Link href={`/emit?duplicate=${id}`}>
            <Button variant="outline">
              <Copy className="mr-2 h-4 w-4" />
              Duplicar
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center">
              <FileText className="mr-2 h-5 w-5" />
              Información general
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tipo DTE</span>
              <span>{doc.type}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Estado</span>
              <StatusBadge status={doc.status} />
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Track ID</span>
              <span className="font-mono text-xs">{doc.trackId || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Fecha emisión</span>
              <span>{new Date(doc.emittedAt).toLocaleString("es-CL")}</span>
            </div>
            {doc.acceptedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fecha aceptación</span>
                <span>{new Date(doc.acceptedAt).toLocaleString("es-CL")}</span>
              </div>
            )}
            {doc.rejectedAt && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Fecha rechazo</span>
                <span>{new Date(doc.rejectedAt).toLocaleString("es-CL")}</span>
              </div>
            )}
            {doc.rejectionReason && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Motivo rechazo</span>
                <span className="text-destructive">{doc.rejectionReason}</span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Receptor</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex justify-between">
              <span className="text-muted-foreground">RUT</span>
              <span>{doc.receiverRut}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Nombre</span>
              <span>{doc.receiverName}</span>
            </div>
            {doc.receiverEmail && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Email</span>
                <span>{doc.receiverEmail}</span>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Totales</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Neto</span>
            <span>${doc.totalNet.toLocaleString("es-CL")}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">IVA (19%)</span>
            <span>${doc.totalTax.toLocaleString("es-CL")}</span>
          </div>
          <div className="flex justify-between text-lg font-bold">
            <span>Total</span>
            <span>${doc.totalAmount.toLocaleString("es-CL")}</span>
          </div>
        </CardContent>
      </Card>

      {doc.items && doc.items.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Items</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Cantidad</TableHead>
                  <TableHead>Precio unitario</TableHead>
                  <TableHead>Total</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {doc.items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.description}</TableCell>
                    <TableCell>{item.quantity}</TableCell>
                    <TableCell>${item.unitPrice.toLocaleString("es-CL")}</TableCell>
                    <TableCell>${item.totalPrice.toLocaleString("es-CL")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
