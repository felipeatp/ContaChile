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

interface DocumentTableProps {
  documents: Document[]
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
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.length === 0 ? (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-muted-foreground">
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
              </TableRow>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  )
}
