'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { Bot, X, Send, Square, Trash2, ChevronDown, ArrowUpRight } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useConsultor } from '@/hooks/use-consultor'
import { Button } from '@/components/ui/button'

/**
 * Editorial chat widget — diseño de transcript, no de bubbles tipo iMessage.
 *
 * Cada mensaje es una "entrada" con eyebrow (rol) + barra de acento a la
 * izquierda + texto. El conjunto se lee como un diálogo impreso.
 */

function MessageEntry({
  role,
  content,
  isStreaming,
}: {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}) {
  const isUser = role === 'user'

  return (
    <div
      className={cn(
        'group relative pl-3 pr-1 py-1',
        // Barra de acento vertical a la izquierda
        'before:absolute before:left-0 before:top-1.5 before:bottom-1.5 before:w-0.5',
        isUser ? 'before:bg-primary' : 'before:bg-foreground/30'
      )}
    >
      <div className="flex items-baseline gap-2 mb-1">
        <span
          className={cn(
            'eyebrow !text-[0.55rem]',
            isUser ? 'text-primary' : 'text-foreground/70'
          )}
        >
          {isUser ? 'Tú' : 'Consultor'}
        </span>
        <span className="text-[0.6rem] font-mono text-muted-foreground/40">
          {new Date().toLocaleTimeString('es-CL', {
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
      </div>
      <div className="text-sm leading-relaxed text-foreground">
        {content ? (
          <p className="whitespace-pre-wrap break-words">{content}</p>
        ) : (
          isStreaming && (
            <span className="inline-flex gap-1 py-1">
              <span className="h-1 w-1 animate-bounce rounded-full bg-foreground/50 [animation-delay:0ms]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-foreground/50 [animation-delay:150ms]" />
              <span className="h-1 w-1 animate-bounce rounded-full bg-foreground/50 [animation-delay:300ms]" />
            </span>
          )
        )}
        {isStreaming && content && (
          <span className="ml-0.5 inline-block h-3.5 w-0.5 animate-pulse bg-primary opacity-80" />
        )}
      </div>
    </div>
  )
}

const SUGGESTIONS = [
  '¿Cuándo vence el F29 de este mes?',
  '¿Cuánto IVA debo declarar?',
  '¿Cómo funciona el PPM?',
  '¿Qué documentos emití este mes?',
]

export function ChatWidget() {
  const [open, setOpen] = useState(false)
  const [input, setInput] = useState('')
  const {
    messages,
    isLoading,
    error,
    sendMessage,
    clearMessages,
    stopStreaming,
  } = useConsultor()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open])

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [open])

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault()
    if (!input.trim()) return
    sendMessage(input)
    setInput('')
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSubmit(e as unknown as FormEvent)
    }
  }

  const handleSuggestion = (text: string) => {
    sendMessage(text)
  }

  return (
    <>
      {/* Panel */}
      <div
        className={cn(
          'fixed bottom-20 right-4 z-50 flex flex-col rounded-sm border border-border bg-paper transition-all duration-300',
          'shadow-[0_24px_64px_-16px_hsl(var(--ink)/0.25)]',
          open
            ? 'w-[380px] h-[560px] opacity-100 translate-y-0'
            : 'w-0 h-0 opacity-0 translate-y-4 pointer-events-none overflow-hidden'
        )}
      >
        {/* Header — newspaper-column-style */}
        <div className="border-b border-border bg-card px-5 pt-4 pb-3">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="eyebrow !text-[0.55rem]">
                  Sección · Consultoría
                </span>
                <span className="h-px w-6 bg-foreground/20" />
                <span className="flex items-center gap-1 text-[0.55rem] uppercase tracking-eyebrow text-sage font-semibold">
                  <span className="block h-1.5 w-1.5 rounded-full bg-sage animate-pulse" />
                  En línea
                </span>
              </div>
              <h3 className="font-display text-base font-semibold leading-tight tracking-tightest">
                Consultor{' '}
                <em className="text-primary not-italic font-medium">
                  Tributario
                </em>
              </h3>
              <p className="text-[0.65rem] text-muted-foreground/70 mt-0.5">
                IA especialista en tributación chilena
              </p>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {messages.length > 0 && (
                <button
                  onClick={clearMessages}
                  className="h-7 w-7 inline-flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                  title="Limpiar conversación"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                onClick={() => setOpen(false)}
                className="h-7 w-7 inline-flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
                title="Cerrar"
              >
                <ChevronDown className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Transcript */}
        <div className="flex-1 overflow-y-auto px-3 py-4 space-y-4">
          {messages.length === 0 ? (
            <EmptyState onPick={handleSuggestion} />
          ) : (
            <>
              {messages.map((msg) => (
                <MessageEntry
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  isStreaming={msg.isStreaming}
                />
              ))}
              {error && (
                <div className="rounded-sm border border-destructive/30 bg-destructive/5 px-3 py-2 text-xs text-destructive">
                  {error}
                </div>
              )}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Composer */}
        <form
          onSubmit={handleSubmit}
          className="border-t border-border bg-card px-3 py-3"
        >
          <div className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu consulta tributaria..."
              rows={1}
              className="flex-1 resize-none border border-input rounded-sm bg-paper px-3 py-2 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/30 min-h-[38px] max-h-[120px] transition-colors"
              style={{ height: 'auto' }}
              onInput={(e) => {
                const t = e.currentTarget
                t.style.height = 'auto'
                t.style.height = Math.min(t.scrollHeight, 120) + 'px'
              }}
            />
            {isLoading ? (
              <Button
                type="button"
                size="icon"
                variant="outline"
                onClick={stopStreaming}
                className="h-[38px] w-[38px] shrink-0"
                title="Detener"
              >
                <Square className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim()}
                className="h-[38px] w-[38px] shrink-0"
                title="Enviar"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
          <p className="mt-2 text-center text-[0.6rem] font-mono uppercase tracking-eyebrow text-muted-foreground/60">
            IA orientativa · Confirma con tu contador
          </p>
        </form>
      </div>

      {/* FAB — editorial square with monogram + accent dot */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'group fixed bottom-4 right-4 z-50 inline-flex h-12 w-12 items-center justify-center',
          'rounded-sm border-2 border-foreground bg-paper transition-all duration-200',
          'shadow-[0_8px_24px_-4px_hsl(var(--ink)/0.18)] hover:shadow-[0_12px_28px_-4px_hsl(var(--ink)/0.28)]',
          'hover:-translate-y-px active:translate-y-0',
          open && 'bg-foreground'
        )}
        aria-label="Abrir Consultor Tributario IA"
      >
        {open ? (
          <X className="h-5 w-5 text-background" />
        ) : (
          <>
            <Bot
              className="h-5 w-5 text-foreground group-hover:text-primary transition-colors"
              strokeWidth={2}
            />
            <span className="absolute -bottom-0.5 -right-0.5 h-2 w-2 bg-primary border border-paper" />
          </>
        )}
      </button>
    </>
  )
}

function EmptyState({ onPick }: { onPick: (text: string) => void }) {
  return (
    <div className="flex flex-col gap-5 px-2 pt-3">
      <div>
        <div className="inline-flex h-10 w-10 items-center justify-center border border-foreground bg-paper mb-3 relative">
          <Bot className="h-5 w-5 text-foreground" />
          <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 bg-primary" />
        </div>
        <h4 className="font-display text-lg font-semibold tracking-tightest leading-tight mb-1">
          ¿En qué te asesoro hoy?
        </h4>
        <p className="text-xs text-muted-foreground leading-relaxed max-w-[280px]">
          Consultas sobre IVA, F29, DTE, retenciones y obligaciones tributarias chilenas.
        </p>
      </div>

      <div>
        <span className="eyebrow !text-[0.55rem] block mb-2">
          Sugerencias
        </span>
        <ul className="space-y-1.5">
          {SUGGESTIONS.map((s, i) => (
            <li key={s}>
              <button
                onClick={() => onPick(s)}
                className="group/sug w-full text-left px-2 py-1.5 -mx-2 text-xs flex items-center gap-2 hover:bg-secondary/40 rounded-sm transition-colors"
              >
                <span className="font-mono text-[0.55rem] text-muted-foreground/60 tabular tracking-tight w-4">
                  {String(i + 1).padStart(2, '0')}
                </span>
                <span className="flex-1 text-foreground/85 group-hover/sug:text-foreground transition-colors">
                  {s}
                </span>
                <ArrowUpRight className="h-3 w-3 text-muted-foreground/40 group-hover/sug:text-primary group-hover/sug:translate-x-0.5 group-hover/sug:-translate-y-0.5 transition-all" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
