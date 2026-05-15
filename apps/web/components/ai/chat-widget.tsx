'use client'

import { useState, useRef, useEffect, FormEvent } from 'react'
import { Bot, X, Send, Square, Trash2, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useConsultor } from '@/hooks/use-consultor'
import { Button } from '@/components/ui/button'

function MessageBubble({
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
    <div className={cn('flex gap-2 text-sm', isUser ? 'flex-row-reverse' : 'flex-row')}>
      {/* Avatar */}
      <div
        className={cn(
          'flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold',
          isUser
            ? 'bg-primary text-primary-foreground'
            : 'bg-muted text-muted-foreground border'
        )}
      >
        {isUser ? 'Tú' : <Bot className="h-4 w-4" />}
      </div>

      {/* Bubble */}
      <div
        className={cn(
          'max-w-[80%] rounded-2xl px-3 py-2 leading-relaxed',
          isUser
            ? 'bg-primary text-primary-foreground rounded-tr-sm'
            : 'bg-muted text-foreground rounded-tl-sm'
        )}
      >
        {content ? (
          <p className="whitespace-pre-wrap break-words">{content}</p>
        ) : (
          isStreaming && (
            <span className="flex gap-1 py-1">
              <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:0ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:150ms]" />
              <span className="h-2 w-2 animate-bounce rounded-full bg-current [animation-delay:300ms]" />
            </span>
          )
        )}
        {isStreaming && content && (
          <span className="ml-0.5 inline-block h-4 w-0.5 animate-pulse bg-current opacity-70" />
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
  const { messages, isLoading, error, sendMessage, clearMessages, stopStreaming } = useConsultor()
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Auto-scroll al último mensaje
  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, open])

  // Focus input al abrir
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
      {/* Panel de chat */}
      <div
        className={cn(
          'fixed bottom-20 right-4 z-50 flex flex-col rounded-2xl border bg-background shadow-2xl transition-all duration-300',
          open
            ? 'w-[360px] h-[520px] opacity-100 translate-y-0'
            : 'w-0 h-0 opacity-0 translate-y-4 pointer-events-none overflow-hidden'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between rounded-t-2xl border-b bg-primary px-4 py-3">
          <div className="flex items-center gap-2">
            <Bot className="h-5 w-5 text-primary-foreground" />
            <div>
              <p className="text-sm font-semibold text-primary-foreground">Consultor Tributario</p>
              <p className="text-xs text-primary-foreground/70">IA especialista en impuestos CL</p>
            </div>
          </div>
          <div className="flex items-center gap-1">
            {messages.length > 0 && (
              <Button
                variant="ghost"
                size="icon"
                onClick={clearMessages}
                className="h-7 w-7 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
                title="Limpiar conversación"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setOpen(false)}
              className="h-7 w-7 text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10"
            >
              <ChevronDown className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center gap-4 pb-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Bot className="h-7 w-7 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">Consultor Tributario IA</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                  Pregúntame sobre IVA, F29, DTE o cualquier duda tributaria chilena.
                </p>
              </div>
              <div className="flex flex-col gap-2 w-full">
                {SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    onClick={() => handleSuggestion(s)}
                    className="rounded-xl border px-3 py-2 text-xs text-left hover:bg-accent transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <>
              {messages.map((msg) => (
                <MessageBubble
                  key={msg.id}
                  role={msg.role}
                  content={msg.content}
                  isStreaming={msg.isStreaming}
                />
              ))}
              {error && (
                <p className="text-xs text-destructive text-center bg-destructive/10 rounded-lg px-3 py-2">
                  {error}
                </p>
              )}
              <div ref={bottomRef} />
            </>
          )}
        </div>

        {/* Input */}
        <div className="border-t p-3">
          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Escribe tu pregunta tributaria..."
              rows={1}
              className="flex-1 resize-none rounded-xl border bg-muted px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 min-h-[38px] max-h-[120px]"
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
                <Square className="h-4 w-4" />
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim()}
                className="h-[38px] w-[38px] shrink-0"
              >
                <Send className="h-4 w-4" />
              </Button>
            )}
          </form>
          <p className="mt-1.5 text-center text-[10px] text-muted-foreground">
            IA orientativa — confirma con tu contador
          </p>
        </div>
      </div>

      {/* Botón flotante */}
      <button
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'fixed bottom-4 right-4 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-300',
          'bg-primary text-primary-foreground hover:scale-105 active:scale-95',
          open && 'rotate-180'
        )}
        aria-label="Abrir Consultor Tributario IA"
      >
        {open ? <X className="h-6 w-6" /> : <Bot className="h-6 w-6" />}
      </button>
    </>
  )
}
