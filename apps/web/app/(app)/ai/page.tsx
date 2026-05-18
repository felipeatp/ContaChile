import type { Metadata } from 'next'
import {
  Bot,
  FileSearch,
  Bell,
  Calculator,
  ArrowUpRight,
  Sparkles,
} from 'lucide-react'
import { RuleOrnament } from '@/components/ui/rule-ornament'
import { Button } from '@/components/ui/button'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Agentes IA',
  description: 'Automatización contable con inteligencia artificial.',
  robots: { index: false, follow: false },
}

type AgentStatus = 'live' | 'beta' | 'soon'

interface Agent {
  no: string
  icon: typeof Bot
  title: string
  description: string
  status: AgentStatus
  hint: string
  model: string
}

const agents: Agent[] = [
  {
    no: '01',
    icon: Bot,
    title: 'Consultor Tributario',
    description:
      'Resuelve dudas sobre IVA, F29, DTE y normativa SII en tiempo real. Conversa con tu plan de cuentas real y tus documentos emitidos.',
    status: 'live',
    hint: 'Disponible en el botón flotante de toda la app',
    model: 'claude-sonnet-4-6',
  },
  {
    no: '02',
    icon: FileSearch,
    title: 'Clasificador de Transacciones',
    description:
      'Analiza movimientos bancarios (Fintoc) y sugiere asientos contables automáticamente usando el PUC chileno. Aprueba o corrige con un clic.',
    status: 'beta',
    hint: 'Requiere conexión Fintoc activa',
    model: 'claude-haiku-4-5',
  },
  {
    no: '03',
    icon: Calculator,
    title: 'Asistente F22',
    description:
      'Prepara tu declaración anual de renta explicando cada código en lenguaje simple. Detecta inconsistencias y proyecta el saldo a pagar o devolución.',
    status: 'soon',
    hint: 'Disponible en versión beta próximamente',
    model: 'claude-sonnet-4-6',
  },
  {
    no: '04',
    icon: Bell,
    title: 'Alertas Tributarias',
    description:
      'Monitoreo diario de vencimientos: F29, retenciones, fechas límite SII. Notificaciones por email 5 días y 1 día antes.',
    status: 'live',
    hint: 'Worker BullMQ activo cada día a las 08:00',
    model: 'sistema',
  },
]

const STATUS_STYLE: Record<
  AgentStatus,
  { label: string; bg: string; text: string; dot: string }
> = {
  live: {
    label: 'En operación',
    bg: 'bg-sage/10',
    text: 'text-sage',
    dot: 'bg-sage',
  },
  beta: {
    label: 'Beta',
    bg: 'bg-primary/10',
    text: 'text-primary',
    dot: 'bg-primary',
  },
  soon: {
    label: 'Próximamente',
    bg: 'bg-ochre/15',
    text: 'text-ochre',
    dot: 'bg-ochre',
  },
}

export default function AIPage() {
  const liveCount = agents.filter((a) => a.status === 'live').length

  return (
    <div className="space-y-10 animate-fade-up">
      {/* Masthead */}
      <section>
        <div className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="max-w-2xl">
            <div className="flex items-center gap-3 mb-3">
              <span className="eyebrow">Redacción · IA</span>
              <span className="h-px w-10 bg-foreground/20" />
              <span className="eyebrow text-muted-foreground/60">
                {liveCount} en operación · {agents.length} totales
              </span>
            </div>
            <h2 className="font-display text-3xl md:text-4xl lg:text-5xl font-semibold leading-[1.05] tracking-tightest text-foreground">
              Tu redacción{' '}
              <em className="text-primary not-italic font-medium">
                contable inteligente
              </em>
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl text-sm leading-relaxed">
              Cuatro agentes especializados que conversan con tu información
              real: plan de cuentas, documentos emitidos, transacciones
              bancarias. Cada uno cubre una tarea que hoy hace un contador
              manualmente.
            </p>
          </div>
        </div>
      </section>

      {/* On-Air block */}
      <section className="card-editorial relative overflow-hidden p-6 md:p-8 bg-card">
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-sage opacity-70" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-sage" />
              </span>
              <span className="eyebrow !text-[0.55rem] text-sage">
                Al aire · ahora mismo
              </span>
            </div>
            <h3 className="font-display text-2xl md:text-3xl font-semibold tracking-tightest mb-1">
              Consultor{' '}
              <em className="text-primary not-italic font-medium">
                Tributario
              </em>
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Responde preguntas tributarias en tiempo real desde el ícono
              flotante en cualquier pantalla.
            </p>
            <div className="mt-3 flex items-center gap-2 text-[0.65rem] font-mono text-muted-foreground/70">
              <Sparkles className="h-3 w-3" />
              <span className="tabular">claude-sonnet-4-6</span>
            </div>
          </div>
          {/* Decorative oversized monogram */}
          <div className="hidden md:block relative">
            <div className="relative h-20 w-20 border-2 border-foreground bg-paper flex items-center justify-center">
              <Bot className="h-10 w-10 text-foreground" strokeWidth={1.5} />
              <span className="absolute -bottom-1 -right-1 h-3 w-3 bg-primary" />
            </div>
          </div>
        </div>
      </section>

      <RuleOrnament ornament="diamond" />

      {/* Roster */}
      <section>
        <div className="flex items-end justify-between mb-5">
          <div>
            <span className="eyebrow block mb-1">I · Roster de agentes</span>
            <h3 className="font-display text-2xl font-semibold tracking-tightest">
              Catálogo completo
            </h3>
          </div>
          <span className="text-xs text-muted-foreground/60 font-mono">
            Vol. I · Sec. IA
          </span>
        </div>

        <div className="grid gap-px bg-border md:grid-cols-2 border border-border">
          {agents.map((agent) => {
            const Icon = agent.icon
            const s = STATUS_STYLE[agent.status]
            return (
              <article
                key={agent.no}
                className="group bg-paper p-6 transition-colors hover:bg-secondary/40 relative overflow-hidden flex flex-col"
              >
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div className="flex items-center gap-3">
                    <div className="relative h-10 w-10 border border-foreground bg-paper flex items-center justify-center shrink-0">
                      <Icon className="h-5 w-5 text-foreground" strokeWidth={1.75} />
                      <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 bg-primary" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[0.65rem] text-muted-foreground/60 tabular">
                          A·{agent.no}
                        </span>
                        <span className="h-px w-3 bg-foreground/15" />
                        <span
                          className={`inline-flex items-center gap-1 text-[0.55rem] uppercase tracking-eyebrow font-semibold rounded-sm px-1.5 py-0.5 ${s.bg} ${s.text}`}
                        >
                          <span className={`h-1 w-1 rounded-full ${s.dot}`} />
                          {s.label}
                        </span>
                      </div>
                      <h4 className="font-display text-lg font-semibold tracking-tightest leading-tight mt-1">
                        {agent.title}
                      </h4>
                    </div>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground leading-relaxed mb-4 flex-1">
                  {agent.description}
                </p>

                <div className="pt-3 border-t border-border/60 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.65rem] text-muted-foreground/70 truncate">
                      {agent.hint}
                    </p>
                    <p className="text-[0.6rem] font-mono text-muted-foreground/50 tabular mt-0.5">
                      {agent.model}
                    </p>
                  </div>
                  {agent.status === 'live' && agent.no === '01' && (
                    <span className="text-[0.6rem] uppercase tracking-eyebrow text-muted-foreground/60 inline-flex items-center gap-1">
                      Abre el chat
                      <ArrowUpRight className="h-3 w-3 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </span>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      </section>

      <RuleOrnament ornament="diamond" />

      {/* Colophon / Attribution */}
      <section className="card-editorial bg-secondary/20 p-6">
        <div className="grid gap-6 md:grid-cols-3 items-start">
          <div>
            <span className="eyebrow block mb-1.5">Colofón</span>
            <h4 className="font-display text-lg font-semibold tracking-tightest leading-tight">
              Sobre los modelos
            </h4>
          </div>
          <div className="md:col-span-2 space-y-2 text-sm text-muted-foreground leading-relaxed">
            <p>
              Los agentes utilizan{' '}
              <strong className="text-foreground font-medium">
                Claude de Anthropic
              </strong>{' '}
              en dos modalidades:{' '}
              <span className="font-mono text-foreground/80 tabular text-xs">
                claude-haiku-4-5
              </span>{' '}
              para tareas de alto volumen (clasificación, OCR) y{' '}
              <span className="font-mono text-foreground/80 tabular text-xs">
                claude-sonnet-4-6
              </span>{' '}
              para razonamiento complejo (consultas, declaraciones).
            </p>
            <p className="text-xs text-muted-foreground/70 pt-2 border-t border-border/50 mt-3">
              <span className="eyebrow !text-[0.55rem] mr-2">Aviso</span>
              Las respuestas son orientativas. Toda decisión tributaria debe
              ser confirmada con tu contador.
            </p>
          </div>
        </div>
      </section>
    </div>
  )
}
