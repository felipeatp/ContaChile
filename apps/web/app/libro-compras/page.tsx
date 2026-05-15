"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Printer, ShoppingCart } from "lucide-react"

interface Purchase {
  id: string
  type: number
  folio: number
  issuerRut: string
  issuerName: string
  date: string
  netAmount: number
  taxAmount: number
  totalAmount: number
  category: string | null
}

interface PurchasesBookResponse {
  purchases: Purchase[]
  total: number
  page: number
  limit: number
  summary: { net: number; tax: number; total: number }
}

export default function LibroComprasPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [data, setData] = useState<PurchasesBookResponse | null>(null)
  const [loading, setLoading] = useState(false)

  const fetchData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/purchases-book?year=${year}&month=${month}&limit=1000`)
      const json = await res.json()
      setData(json)
    } catch {
      setData(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchData()
  }, [year, month])

  const handlePrint = () => {
    window.print()
  }

  const monthNames = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ]

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4 print-header">
        <div>
          <h1 className="text-3xl font-bold">Libro de Compras</h1>
          <p className="text-muted-foreground">
            Facturas recibidas — {monthNames[month - 1]} {year}
          </p>
        </div>
        <div className="flex items-center space-x-2 no-print">
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {Array.from({ length: 5 }, (_, i) => today.getFullYear() - 2 + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <select
            className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {monthNames.map((name, idx) => (
              <option key={idx + 1} value={idx + 1}>{name}</option>
            ))}
          </select>
          <Button variant="outline" onClick={handlePrint}>
            <Printer className="mr-2 h-4 w-4" />
            Imprimir / PDF
          </Button>
        </div>
      </div>

      <div className="print-only hidden">
        <div className="text-center mb-4">
          <h2 className="text-xl font-bold">Libro de Compras</h2>
          <p className="text-sm text-muted-foreground">
            Período: {monthNames[month - 1]} {year}
          </p>
          <p className="text-sm text-muted-foreground">
            Fecha de impresión: {new Date().toLocaleDateString("es-CL")}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Cargando...</p>
      ) : !data || data.purchases.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <ShoppingCart className="mx-auto h-8 w-8 mb-2 opacity-50" />
            No hay compras registradas para el período seleccionado.
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Neto</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${data.summary.net.toLocaleString("es-CL")}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">IVA (19%)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${data.summary.tax.toLocaleString("es-CL")}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Total Compras</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${data.summary.total.toLocaleString("es-CL")}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Detalle de compras ({data.total} documentos)</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Fecha</TableHead>
                      <TableHead>Tipo</TableHead>
                      <TableHead>Folio</TableHead>
                      <TableHead>RUT Emisor</TableHead>
                      <TableHead>Razón Social</TableHead>
                      <TableHead className="text-right">Neto</TableHead>
                      <TableHead className="text-right">IVA</TableHead>
                      <TableHead className="text-right">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.purchases.map((p) => (
                      <TableRow key={p.id}>
                        <TableCell>
                          {new Date(p.date).toLocaleDateString("es-CL")}
                        </TableCell>
                        <TableCell>{p.type}</TableCell>
                        <TableCell>{p.folio}</TableCell>
                        <TableCell>{p.issuerRut}</TableCell>
                        <TableCell>{p.issuerName}</TableCell>
                        <TableCell className="text-right">
                          ${p.netAmount.toLocaleString("es-CL")}
                        </TableCell>
                        <TableCell className="text-right">
                          ${p.taxAmount.toLocaleString("es-CL")}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          ${p.totalAmount.toLocaleString("es-CL")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      <style jsx global>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          body {
            background: white;
          }
          .space-y-6 > * {
            break-inside: avoid;
          }
        }
      `}</style>
    </div>
  )
}
