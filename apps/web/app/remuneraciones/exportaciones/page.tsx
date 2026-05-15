'use client'

import { useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Download } from 'lucide-react'

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function ExportacionesPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [ddjjYear, setDdjjYear] = useState(today.getFullYear() - 1)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Exportaciones de Remuneraciones</h1>
        <p className="text-sm text-muted-foreground">Archivos para PreviRed y declaraciones juradas al SII.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>PreviRed — Mensual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Archivo de cotizaciones previsionales del mes para pagar en PreviRed.
            </p>
            <div className="flex flex-wrap gap-2">
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {Array.from({ length: 6 }, (_, i) => today.getFullYear() - i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <a
              href={`/api/payroll/previred/${year}/${month}`}
              className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm hover:bg-primary/90"
              download
            >
              <Download className="h-4 w-4" /> Descargar PreviRed
            </a>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>DDJJ 1887 — Anual</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Declaración jurada anual de sueldos pagados. Se presenta al SII en marzo.
            </p>
            <p className="text-xs text-muted-foreground">
              ⚠ Versión simplificada — incluye solo total anual y retención por trabajador.
            </p>
            <div className="flex flex-wrap gap-2">
              <select
                value={ddjjYear}
                onChange={(e) => setDdjjYear(Number(e.target.value))}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                {Array.from({ length: 6 }, (_, i) => today.getFullYear() - i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <a
              href={`/api/payroll/ddjj-1887/${ddjjYear}`}
              className="inline-flex items-center gap-2 rounded-md bg-primary text-primary-foreground px-4 py-2 text-sm hover:bg-primary/90"
              download
            >
              <Download className="h-4 w-4" /> Descargar DDJJ 1887
            </a>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
