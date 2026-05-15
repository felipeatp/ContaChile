import type { Metadata } from 'next'
import { Bot, FileSearch, Bell, Calculator, ArrowRight } from 'lucide-react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Agentes IA',
  description: 'Automatización contable con inteligencia artificial.',
  robots: { index: false, follow: false },
}

const agents = [
  {
    icon: Bot,
    title: 'Consultor Tributario',
    description:
      'Resuelve dudas sobre IVA, F29, DTE y normativa SII en tiempo real. Usa el ícono flotante en cualquier pantalla.',
    status: 'activo',
    statusColor: 'text-green-600 bg-green-50',
    action: null,
    hint: 'Disponible en el botón flotante ↘',
  },
  {
    icon: FileSearch,
    title: 'Clasificador de Transacciones',
    description:
      'Analiza movimientos bancarios (Fintoc) y sugiere asientos contables automáticamente usando el PUC chileno.',
    status: 'próximamente',
    statusColor: 'text-yellow-700 bg-yellow-50',
    action: null,
    hint: 'Requiere conexión Fintoc',
  },
  {
    icon: Calculator,
    title: 'Asistente F29',
    description:
      'Prepara tu declaración mensual de IVA y PPM a partir de los documentos emitidos. Detecta créditos y ajustes automáticamente.',
    status: 'próximamente',
    statusColor: 'text-yellow-700 bg-yellow-50',
    action: null,
    hint: 'Disponible en fase beta',
  },
  {
    icon: Bell,
    title: 'Alertas Tributarias',
    description:
      'Monitoreo diario de vencimientos: F29, retenciones, fechas límite SII. Notificaciones por email.',
    status: 'próximamente',
    statusColor: 'text-yellow-700 bg-yellow-50',
    action: null,
    hint: 'Se ejecuta automáticamente a las 08:00',
  },
]

export default function AIPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Agentes IA</h1>
        <p className="mt-1 text-muted-foreground">
          Automatización contable inteligente para empresas chilenas. Cada agente resuelve tareas
          que hoy hace un contador manualmente.
        </p>
      </div>

      {/* Stats banner */}
      <div className="rounded-2xl border bg-gradient-to-r from-primary/5 via-background to-primary/5 p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-muted-foreground">Agente activo ahora</p>
            <p className="mt-0.5 text-2xl font-bold">Consultor Tributario</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Responde preguntas tributarias en tiempo real · claude-sonnet-4-6
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-green-500">
              <span className="animate-ping h-2.5 w-2.5 rounded-full bg-green-500 opacity-75 absolute" />
            </span>
            <span className="text-sm font-medium text-green-700">En línea</span>
          </div>
        </div>
      </div>

      {/* Agent cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {agents.map((agent) => {
          const Icon = agent.icon
          return (
            <Card key={agent.title} className="flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{agent.title}</CardTitle>
                    </div>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${agent.statusColor}`}
                  >
                    {agent.status}
                  </span>
                </div>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-3">
                <CardDescription className="text-sm leading-relaxed">
                  {agent.description}
                </CardDescription>
                <div className="mt-auto flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">{agent.hint}</p>
                  {agent.action && (
                    <Button size="sm" asChild>
                      <Link href={agent.action}>
                        Usar <ArrowRight className="ml-1 h-3 w-3" />
                      </Link>
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Info footer */}
      <div className="rounded-xl border border-dashed p-4 text-center text-sm text-muted-foreground">
        Los agentes usan modelos Anthropic Claude.{' '}
        <strong>claude-haiku-4-5</strong> para tareas de alto volumen ·{' '}
        <strong>claude-sonnet-4-6</strong> para razonamiento complejo.
        Los datos del consultor son orientativos — confirma con tu contador.
      </div>
    </div>
  )
}
