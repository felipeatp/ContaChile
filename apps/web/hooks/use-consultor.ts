'use client'

import { useState, useCallback, useRef } from 'react'

export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

export function useConsultor() {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  const sendMessage = useCallback(async (userText: string) => {
    if (!userText.trim() || isLoading) return

    setError(null)

    const userMsg: ChatMessage = {
      id: crypto.randomUUID(),
      role: 'user',
      content: userText.trim(),
    }

    const assistantId = crypto.randomUUID()
    const assistantMsg: ChatMessage = {
      id: assistantId,
      role: 'assistant',
      content: '',
      isStreaming: true,
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

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value, { stream: true })
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const data = line.slice(6).trim()
          if (data === '[DONE]') break

          try {
            const parsed = JSON.parse(data) as { text?: string; error?: string }

            // El servidor mandó un error vía SSE
            if (parsed.error) {
              streamErrored = true
              setError(parsed.error)
              setMessages((prev) => prev.filter((m) => m.id !== assistantId))
              return
            }

            if (parsed.text) {
              accumulated += parsed.text
              setMessages((prev) =>
                prev.map((m) =>
                  m.id === assistantId
                    ? { ...m, content: accumulated, isStreaming: true }
                    : m
                )
              )
            }
          } catch {
            // ignorar chunks mal formados
          }
        }
      }

      // Marcar como completo; si no llegó contenido, eliminar el mensaje vacío
      if (accumulated.trim().length === 0) {
        setMessages((prev) => prev.filter((m) => m.id !== assistantId))
        if (!streamErrored) setError('El modelo no devolvió respuesta')
      } else {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId ? { ...m, isStreaming: false } : m
          )
        )
      }
    } catch (err) {
      if ((err as Error).name === 'AbortError') return

      const errMsg = err instanceof Error ? err.message : 'Error desconocido'
      setError(errMsg)
      setMessages((prev) => prev.filter((m) => m.id !== assistantId))
    } finally {
      setIsLoading(false)
    }
  }, [messages, isLoading])

  const clearMessages = useCallback(() => {
    abortRef.current?.abort()
    setMessages([])
    setError(null)
  }, [])

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
    setIsLoading(false)
    setMessages((prev) =>
      prev.map((m) => (m.isStreaming ? { ...m, isStreaming: false } : m))
    )
  }, [])

  return { messages, isLoading, error, sendMessage, clearMessages, stopStreaming }
}
