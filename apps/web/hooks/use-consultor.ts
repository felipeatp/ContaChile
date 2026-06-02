'use client'

import { useState, useCallback, useRef, useEffect } from 'react'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  toolStatus?: { name: string; running: boolean }
  timestamp?: string
}

interface ConversationSummary {
  id: string
  agentType: string
  title: string | null
  createdAt: string
  updatedAt: string
}

// ─── Persistence helpers ──────────────────────────────────────────────────────

async function fetchConversations(): Promise<ConversationSummary[]> {
  try {
    const res = await fetch('/api/ai/conversations?agentType=consultor&limit=20')
    if (!res.ok) return []
    const data = await res.json()
    return data.conversations ?? []
  } catch {
    return []
  }
}

async function loadConversationMessages(id: string): Promise<ChatMessage[]> {
  try {
    const res = await fetch(`/api/ai/conversations/${id}`)
    if (!res.ok) return []
    const data = await res.json()
    const raw = data.messages ?? []
    return raw.map((m: { role: string; content: string; timestamp: string }) => ({
      id: crypto.randomUUID(),
      role: m.role as 'user' | 'assistant',
      content: m.content,
      timestamp: m.timestamp,
    }))
  } catch {
    return []
  }
}

async function createConversation(
  messages: ChatMessage[],
  title?: string
): Promise<string | null> {
  try {
    const payload = messages
      .filter((m) => m.content.trim().length > 0 && !m.isStreaming)
      .map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: new Date().toISOString(),
      }))

    if (payload.length === 0) return null

    const res = await fetch('/api/ai/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentType: 'consultor', messages: payload, title }),
    })
    if (!res.ok) return null
    const data = await res.json()
    return data.id ?? null
  } catch {
    return null
  }
}

async function saveConversationMessages(
  id: string,
  messages: ChatMessage[]
): Promise<boolean> {
  try {
    const payload = messages
      .filter((m) => m.content.trim().length > 0 && !m.isStreaming)
      .map((m) => ({
        role: m.role,
        content: m.content,
        timestamp: new Date().toISOString(),
      }))

    if (payload.length === 0) return false

    const res = await fetch(`/api/ai/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: payload }),
    })
    return res.ok
  } catch {
    return false
  }
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useConsultor() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Al montar, cargar lista de conversaciones previas y restaurar la más reciente
  useEffect(() => {
    let cancelled = false

    async function init() {
      const convList = await fetchConversations()
      if (cancelled) return
      setConversations(convList)

      // Restaurar la conversación más reciente si existe
      if (convList.length > 0) {
        const latest = convList[0]
        const restored = await loadConversationMessages(latest.id)
        if (cancelled) return
        if (restored.length > 0) {
          setMessages(restored)
          setCurrentConversationId(latest.id)
        }
      }
    }

    init()
    return () => { cancelled = true }
  }, [])

  // Guardar mensajes al DB con debounce de 800ms después de cada respuesta completa
  const scheduleSave = useCallback(
    (updatedMessages: ChatMessage[], convId: string | null) => {
      if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)

      saveTimeoutRef.current = setTimeout(async () => {
        setIsSaving(true)
        try {
          if (convId) {
            await saveConversationMessages(convId, updatedMessages)
          } else {
            const newId = await createConversation(updatedMessages)
            if (newId) {
              setCurrentConversationId(newId)
              // Refrescar lista de conversaciones
              const updated = await fetchConversations()
              setConversations(updated)
            }
          }
        } finally {
          setIsSaving(false)
        }
      }, 800)
    },
    []
  )

  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || isLoading) return

    setError(null)

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userText.trim(),
      timestamp: new Date().toISOString(),
    }

    const assistantId = crypto.randomUUID()
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
      timestamp: new Date().toISOString(),
    }

    setMessages((prev) => [...prev, userMsg, assistantMsg])
    setIsLoading(true)

    // Construir historial para la API:
    // - excluir el assistantMsg vacío recién agregado
    // - filtrar mensajes con contenido vacío (ej: errores de stream anteriores)
    const history = [...messages, userMsg]
      .filter((m) => m.content.trim().length > 0)
      .map((m) => ({
        role: m.role,
        content: m.content,
      }))

    abortRef.current = new AbortController()

    try {
      const res = await fetch('/api/ai/consultor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: history }),
        signal: abortRef.current.signal,
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        throw new Error(err.error || `Error ${res.status}`)
      }

      // Leer SSE stream
      const reader = res.body?.getReader()
      if (!reader) throw new Error('No stream disponible')

      const decoder = new TextDecoder()
      let accumulated = ''
      let streamErrored = false
      let streamDone = false
      let toolWasUsed = false

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') {
            streamDone = true
            break
          }

          try {
            const parsed = JSON.parse(data) as {
              text?: string
              error?: string
              tool?: string
              status?: 'running' | 'done' | 'error'
            }

            if (parsed.error) {
              streamErrored = true
              setError(parsed.error)
              setMessages((prev) => prev.filter((m) => m.id !== assistantId))
              return
            }

            if (parsed.tool && parsed.status) {
              if (parsed.status === 'running') toolWasUsed = true
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? {
                        ...m,
                        toolStatus:
                          parsed.status === 'running'
                            ? { name: parsed.tool!, running: true }
                            : undefined,
                      }
                    : m
                )
              )
              continue
            }

            if (parsed.text) {
              accumulated += parsed.text
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: accumulated, isStreaming: true, toolStatus: undefined }
                    : m
                )
              )
            }
          } catch {
            // ignorar chunks mal formados
          }
        }

        if (streamDone) break
      }

      // Marcar como completo. Reglas:
      // - Si llegó texto: limpiar isStreaming.
      // - Si NO llegó texto pero se invocó al menos una tool: mantener la
      //   burbuja con un mensaje de fallback (la tool corrió pero el modelo
      //   no produjo respuesta textual). Mejor UX que borrar todo y mostrar
      //   "El modelo no devolvió respuesta".
      // - Si no llegó texto y tampoco hubo tools: era una respuesta vacía
      //   genuina → borrar la burbuja y mostrar error.
      if (accumulated.trim().length === 0) {
        if (toolWasUsed && !streamErrored) {
          setMessages((prev) => {
            const updated = prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    content: 'Consulté los datos pero no obtuve una respuesta clara. ¿Puedes reformular la pregunta?',
                    isStreaming: false,
                    toolStatus: undefined,
                  }
                : m
            )
            // Guardar después del fallback
            scheduleSave(updated, currentConversationId)
            return updated
          })
        } else {
          setMessages((prev) => prev.filter((m) => m.id !== assistantId))
          if (!streamErrored) setError('El modelo no devolvió respuesta')
        }
      } else {
        setMessages((prev) => {
          const updated = prev.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false } : m
          )
          // Guardar la conversación completa
          scheduleSave(updated, currentConversationId)
          return updated
        })
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return

      const errMsg = err instanceof Error ? err.message : 'Error desconocido'
      setError(errMsg)
      setMessages((prev) => prev.filter((m) => m.id !== assistantId))
    } finally {
      setIsLoading(false)
    }
  }, [messages, isLoading, currentConversationId, scheduleSave])

  const clearMessages = useCallback(() => {
    abortRef.current?.abort()
    if (saveTimeoutRef.current) clearTimeout(saveTimeoutRef.current)
    setMessages([])
    setCurrentConversationId(null)
    setError(null)
  }, [])

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
    setIsLoading(false)
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
    )
  }, [])

  const loadConversation = useCallback(async (id: string) => {
    if (isLoading) return
    const msgs = await loadConversationMessages(id)
    if (msgs.length > 0) {
      setMessages(msgs)
      setCurrentConversationId(id)
      setError(null)
    }
  }, [isLoading])

  return {
    messages,
    isLoading,
    isSaving,
    error,
    conversations,
    currentConversationId,
    sendMessage,
    clearMessages,
    stopStreaming,
    loadConversation,
  }
}
