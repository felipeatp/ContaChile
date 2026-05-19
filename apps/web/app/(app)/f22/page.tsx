"use client"

import { useEffect, useState } from "react"
import { Sparkles } from "lucide-react"
import { F22Report, type F22Data } from "@/components/tax/f22-report"

export default function F22Page() {
  const [data, setData] = useState<F22Data | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [year, setYear] = useState(new Date().getFullYear())
  const [explaining, setExplaining] = useState(false)
  const [explanation, setExplanation] = useState<string | null>(null)

  const fetchData = () => {
    setLoading(true)
    setError(null)
    setExplanation(null)
    fetch(`/api/f22?year=${year}`)
      .then((res) => res.json())
      .then((json) => {
        if (json.error) {
          setError(json.error)
          setData(null)
        } else {
          setData(json)
        }
        setLoading(false)
      })
      .catch(() => {
        setError("Error al cargar F22")
        setLoading(false)
      })
  }

  useEffect(() => {
    fetchData()
  }, [year])

  const handleExplain = async () => {
    if (!data) return
    setExplaining(true)
    try {
      const res = await fetch("/api/ai/consultor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: `Explica mi F22 del año ${data.year} como si tuviera 15 años. Usa estos datos:
- Ingresos brutos: $${data.summary.ingresos.toLocaleString("es-CL")}
- Costos: $${data.summary.costos.toLocaleString("es-CL")}
- Gastos: $${data.summary.gastos.toLocaleString("es-CL")}
- Renta líquida: $${data.summary.rentaLiquida.toLocaleString("es-CL")}
- PPM pagado: $${data.summary.ppmPagado.toLocaleString("es-CL")}
- Impuesto determinado: $${data.summary.impuesto.toLocaleString("es-CL")}
- Saldo a pagar: $${data.summary.saldoPagar.toLocaleString("es-CL")}
- Saldo a devolver: $${data.summary.saldoDevolver.toLocaleString("es-CL")}

Dime si hay algo raro o una oportunidad de optimización.`,
        }),
      })
      const json = await res.json()
      setExplanation(json.response || json.answer || "Sin respuesta")
    } catch {
      setExplanation("Error al consultar IA")
    } finally {
      setExplaining(false)
    }
  }

  return (
    <div className="space-y-6">
      <F22Report
        data={data}
        year={year}
        loading={loading}
        error={error}
        onYearChange={setYear}
        onRefresh={fetchData}
        onPrint={() => window.print()}
        onExplain={handleExplain}
        explaining={explaining}
      />
      {explanation && (
        <div className="card-editorial p-6 space-y-3 print-hide">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <span className="text-sm font-medium">Análisis IA</span>
          </div>
          <div className="text-sm whitespace-pre-wrap text-muted-foreground leading-relaxed">
            {explanation}
          </div>
        </div>
      )}
    </div>
  )
}
