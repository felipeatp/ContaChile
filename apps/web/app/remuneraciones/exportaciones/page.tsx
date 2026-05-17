'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, FileSpreadsheet, FileText } from 'lucide-react'

const MONTHS = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre']

export default function ExportacionesPage() {
  const today = new Date()
  const [year, setYear] = useState(today.getFullYear())
  const [month, setMonth] = useState(today.getMonth() + 1)
  const [ddjjYear, setDdjjYear] = useState(today.getFullYear() - 1)

  return (
    <div className="space-y-8 animate-fade-up">
      <section className="max-w-2xl">
        <div className="flex items-center gap-3 mb-3">
          <span className="eyebrow">Remuneraciones · Exportaciones</span>
          <span className="h-px w-10 bg-foreground/20" />
          <span className="eyebrow text-muted-foreground/60">PreviRed · DDJJ 1887</span>
        </div>
        <h2 className="font-display text-3xl md:text-4xl font-semibold leading-[1.05] tracking-tightest text-foreground">
          Archivos para{' '}
          <em className="text-primary not-italic font-medium">PreviRed y SII</em>
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Pago mensual de cotizaciones previsionales y declaración jurada anual de sueldos. Generados desde las liquidaciones aprobadas.
        </p>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <article className="card-editorial p-6 space-y-4">
          <header className="flex items-start justify-between gap-3">
            <div>
              <span className="eyebrow">I · Mensual</span>
              <h3 className="font-display text-2xl font-semibold tracking-tightest mt-1">
                PreviRed
              </h3>
            </div>
            <FileSpreadsheet className="h-5 w-5 text-muted-foreground/70" />
          </header>
          <p className="text-sm text-muted-foreground">
            Archivo de texto con cotizaciones AFP, salud y seguro de cesantía del mes seleccionado. Listo para subir al portal de PreviRed.
          </p>

          <div className="h-px bg-border/60" />

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-[0.65rem] font-semibold uppercase tracking-eyebrow text-foreground/70">Año</label>
              <select
                value={year}
                onChange={(e) => setYear(Number(e.target.value))}
                className="min-w-[7rem]"
              >
                {Array.from({ length: 6 }, (_, i) => today.getFullYear() - i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-[0.65rem] font-semibold uppercase tracking-eyebrow text-foreground/70">Mes</label>
              <select
                value={month}
                onChange={(e) => setMonth(Number(e.target.value))}
                className="min-w-[8rem]"
              >
                {MONTHS.map((m, i) => (
                  <option key={i} value={i + 1}>{m}</option>
                ))}
              </select>
            </div>
            <Button asChild>
              <a
                href={`/api/payroll/previred/${year}/${month}`}
                download
              >
                <Download className="mr-2 h-4 w-4" /> Descargar
              </a>
            </Button>
          </div>
        </article>

        <article className="card-editorial p-6 space-y-4">
          <header className="flex items-start justify-between gap-3">
            <div>
              <span className="eyebrow">II · Anual</span>
              <h3 className="font-display text-2xl font-semibold tracking-tightest mt-1">
                DDJJ 1887
              </h3>
            </div>
            <FileText className="h-5 w-5 text-muted-foreground/70" />
          </header>
          <p className="text-sm text-muted-foreground">
            Declaración jurada anual de sueldos pagados. Se presenta al SII durante marzo del año siguiente.
          </p>

          <div className="rounded-sm border border-ochre/30 bg-ochre/5 px-3 py-2 text-xs text-ochre">
            Versión simplificada — incluye total anual y retención por trabajador.
          </div>

          <div className="h-px bg-border/60" />

          <div className="flex flex-wrap items-end gap-3">
            <div className="space-y-1.5">
              <label className="text-[0.65rem] font-semibold uppercase tracking-eyebrow text-foreground/70">Año tributario</label>
              <select
                value={ddjjYear}
                onChange={(e) => setDdjjYear(Number(e.target.value))}
                className="min-w-[8rem]"
              >
                {Array.from({ length: 6 }, (_, i) => today.getFullYear() - i).map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <Button asChild>
              <a
                href={`/api/payroll/ddjj-1887/${ddjjYear}`}
                download
              >
                <Download className="mr-2 h-4 w-4" /> Descargar
              </a>
            </Button>
          </div>
        </article>
      </section>
    </div>
  )
}
