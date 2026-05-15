"use client"

import { useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Loader2, FileBarChart } from "lucide-react"

interface F29Data {
  period: { year: number; month: number }
  sales: { count: number; neto: number; iva: number; total: number }
  purchases: { count: number; neto: number; iva: number; total: number }
  f29: Record<string, number>
}

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
]

export default function F29Page() {
  const [data, setData] = useState<F29Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [year, setYear] = useState(new Date().getFullYear())
  const [month, setMonth] = useState(new Date().getMonth() + 1)

  const fetchData = () => {
    setLoading(true)
    fetch(`/api/f29?year=${year}&month=${month}`)
      .then((res) => res.json())
      .then((json) => {
        setData(json)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }

  useEffect(() => {
    fetchData()
  }, [year, month])

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">F29 — Declaración de IVA</h1>
          <p className="text-muted-foreground">Preview automático de los códigos SII</p>
        </div>
        <div className="flex items-center space-x-2">
          <select
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={month}
            onChange={(e) => setMonth(Number(e.target.value))}
          >
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            className="flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            value={year}
            onChange={(e) => setYear(Number(e.target.value))}
          >
            {Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - 2 + i).map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <Button variant="outline" onClick={fetchData}>
            <FileBarChart className="mr-2 h-4 w-4" />
            Actualizar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Ventas del período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.sales.count ?? 0}</div>
            <p className="text-xs text-muted-foreground">documentos emitidos</p>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between"><span>Neto</span><span>${(data?.sales.neto ?? 0).toLocaleString("es-CL")}</span></div>
              <div className="flex justify-between"><span>IVA</span><span>${(data?.sales.iva ?? 0).toLocaleString("es-CL")}</span></div>
              <div className="flex justify-between font-bold"><span>Total</span><span>${(data?.sales.total ?? 0).toLocaleString("es-CL")}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Compras del período</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data?.purchases.count ?? 0}</div>
            <p className="text-xs text-muted-foreground">documentos recibidos</p>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between"><span>Neto</span><span>${(data?.purchases.neto ?? 0).toLocaleString("es-CL")}</span></div>
              <div className="flex justify-between"><span>IVA</span><span>${(data?.purchases.iva ?? 0).toLocaleString("es-CL")}</span></div>
              <div className="flex justify-between font-bold"><span>Total</span><span>${(data?.purchases.total ?? 0).toLocaleString("es-CL")}</span></div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Resultado F29</CardTitle>
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${(data?.f29["595"] ?? 0) >= 0 ? "text-red-600" : "text-green-600"}`}>
              ${(data?.f29["595"] ?? 0).toLocaleString("es-CL")}
            </div>
            <p className="text-xs text-muted-foreground">IVA determinado (502 - 503)</p>
            <div className="mt-2 space-y-1 text-sm">
              <div className="flex justify-between"><span>PPM (0.4%)</span><span>${(data?.f29["547"] ?? 0).toLocaleString("es-CL")}</span></div>
              <div className="flex justify-between font-bold"><span>Total a pagar</span><span>${(data?.f29["91"] ?? 0).toLocaleString("es-CL")}</span></div>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Códigos SII F29</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="text-left py-2 px-2">Código</th>
                  <th className="text-left py-2 px-2">Descripción</th>
                  <th className="text-right py-2 px-2">Valor</th>
                </tr>
              </thead>
              <tbody>
                <tr className="border-b">
                  <td className="py-2 px-2 font-mono">502</td>
                  <td className="py-2 px-2">Débito fiscal (IVA ventas afectas)</td>
                  <td className="py-2 px-2 text-right">${(data?.f29["502"] ?? 0).toLocaleString("es-CL")}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 px-2 font-mono">503</td>
                  <td className="py-2 px-2">Crédito fiscal (IVA compras)</td>
                  <td className="py-2 px-2 text-right">${(data?.f29["503"] ?? 0).toLocaleString("es-CL")}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 px-2 font-mono">595</td>
                  <td className="py-2 px-2">IVA determinado (502 - 503)</td>
                  <td className="py-2 px-2 text-right font-bold">${(data?.f29["595"] ?? 0).toLocaleString("es-CL")}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 px-2 font-mono">538</td>
                  <td className="py-2 px-2">Remanente crédito fiscal mes anterior</td>
                  <td className="py-2 px-2 text-right">${(data?.f29["538"] ?? 0).toLocaleString("es-CL")}</td>
                </tr>
                <tr className="border-b">
                  <td className="py-2 px-2 font-mono">547</td>
                  <td className="py-2 px-2">Pago provisional mensual (PPM)</td>
                  <td className="py-2 px-2 text-right">${(data?.f29["547"] ?? 0).toLocaleString("es-CL")}</td>
                </tr>
                <tr>
                  <td className="py-2 px-2 font-mono">91</td>
                  <td className="py-2 px-2">Total a pagar o devolver</td>
                  <td className="py-2 px-2 text-right font-bold">${(data?.f29["91"] ?? 0).toLocaleString("es-CL")}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
