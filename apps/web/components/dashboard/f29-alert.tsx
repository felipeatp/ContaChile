import Link from "next/link"
import { AlertTriangle, CalendarClock, FileBarChart } from "lucide-react"
import { Button } from "@/components/ui/button"

export function F29Alert() {
  const today = new Date()
  const day = today.getDate()
  const month = today.getMonth() + 1
  const year = today.getFullYear()

  const MONTHS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ]

  if (day > 20) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-red-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <AlertTriangle className="h-5 w-5" />
          <div>
            <p className="font-medium">F29 vencido</p>
            <p className="text-sm">
              El plazo para declarar el F29 de {MONTHS[month - 2] ?? "Diciembre"} {month === 1 ? year - 1 : year} ya pasó (día 20).
            </p>
          </div>
        </div>
        <Link href="/f29">
          <Button variant="outline" size="sm" className="border-red-300 text-red-800 hover:bg-red-100">
            <FileBarChart className="mr-2 h-4 w-4" />
            Ver F29
          </Button>
        </Link>
      </div>
    )
  }

  if (day >= 15) {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-amber-800 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <CalendarClock className="h-5 w-5" />
          <div>
            <p className="font-medium">F29 próximo a vencer</p>
            <p className="text-sm">
              Quedan {20 - day} días para declarar el F29 de {MONTHS[month - 1]} {year}.
            </p>
          </div>
        </div>
        <Link href="/f29">
          <Button variant="outline" size="sm" className="border-amber-300 text-amber-800 hover:bg-amber-100">
            <FileBarChart className="mr-2 h-4 w-4" />
            Preparar F29
          </Button>
        </Link>
      </div>
    )
  }

  return null
}
