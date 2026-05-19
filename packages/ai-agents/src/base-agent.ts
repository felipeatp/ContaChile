import Anthropic from '@anthropic-ai/sdk'
import OpenAI from 'openai'

// ─── Tipos compartidos ────────────────────────────────────────────────────────

export interface AgentTool {
  name: string
  description: string
  input_schema: {
    type: 'object'
    properties: Record<string, unknown>
    required?: string[]
  }
}

export interface AgentConfig {
  systemPrompt: string
  userMessage: string | Anthropic.ContentBlock[]
  tools?: AgentTool[]
  model?: string
  maxTokens?: number
  onToolCall?: (toolName: string, input: unknown) => unknown | Promise<unknown>
}

export interface AgentStreamConfig extends Omit<AgentConfig, 'userMessage'> {
  messages: Anthropic.MessageParam[]
}

export interface AgentStreamConfigWithTools extends AgentStreamConfig {
  tools: AgentTool[]
  onToolCall: (toolName: string, input: unknown) => unknown | Promise<unknown>
  maxIterations?: number
}

export type AgentEvent =
  | { kind: 'text'; value: string }
  | { kind: 'tool'; name: string; status: 'running' | 'done' | 'error' }

// ─── Clientes ────────────────────────────────────────────────────────────────

const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  ...(process.env.ANTHROPIC_BASE_URL && { baseURL: process.env.ANTHROPIC_BASE_URL }),
})

// Permite sobreescribir el modelo Anthropic (incluso si el llamante pasó uno)
// vía env var. Útil para apuntar a endpoints Anthropic-compatible como Kimi.
const ANTHROPIC_MODEL_OVERRIDE = process.env.ANTHROPIC_MODEL || ''

// Cliente OpenAI-compatible (NVIDIA NIM, etc.)
const openaiCompatClient = new OpenAI({
  apiKey: process.env.OPENAI_COMPAT_API_KEY || '',
  baseURL: process.env.OPENAI_COMPAT_BASE_URL || 'https://integrate.api.nvidia.com/v1',
})

type Provider = 'anthropic' | 'openai-compat'

function getProvider(): Provider {
  return (process.env.LLM_PROVIDER as Provider) || 'anthropic'
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function extractText(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
}

// ─── Streaming ───────────────────────────────────────────────────────────────

function streamAnthropic(config: AgentStreamConfig): ReadableStream<string> {
  const { systemPrompt, messages, maxTokens = 4096 } = config
  const model = ANTHROPIC_MODEL_OVERRIDE || config.model || 'claude-sonnet-4-6'

  return new ReadableStream<string>({
    async start(controller) {
      try {
        const stream = anthropicClient.messages.stream({
          model,
          max_tokens: maxTokens,
          system: systemPrompt,
          messages,
        })

        for await (const chunk of stream) {
          if (
            chunk.type === 'content_block_delta' &&
            chunk.delta.type === 'text_delta'
          ) {
            controller.enqueue(chunk.delta.text)
          }
        }

        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })
}

function streamOpenAICompat(config: AgentStreamConfig): ReadableStream<string> {
  const { systemPrompt, messages, maxTokens = 4096 } = config
  // Ignora el model de Anthropic y usa el configurado para el proveedor OpenAI-compat
  const model = process.env.OPENAI_COMPAT_MODEL || 'deepseek-ai/deepseek-r1'

  const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: typeof m.content === 'string' ? m.content : '',
    })),
  ]

  return new ReadableStream<string>({
    async start(controller) {
      try {
        const stream = await openaiCompatClient.chat.completions.create({
          model,
          messages: openaiMessages,
          temperature: 0.7,
          max_tokens: maxTokens,
          stream: true,
        })

        for await (const chunk of stream) {
          // Algunos modelos de razonamiento devuelven thinking en delta.reasoning
          // Lo omitimos en el stream de chat — solo enviamos el contenido final
          const content = chunk.choices[0]?.delta?.content
          if (content) controller.enqueue(content)
        }

        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })
}

/**
 * Devuelve un ReadableStream de texto del agente.
 * El proveedor se selecciona con LLM_PROVIDER ('anthropic' | 'openai-compat').
 */
export function streamAgent(config: AgentStreamConfig): ReadableStream<string> {
  return getProvider() === 'openai-compat'
    ? streamOpenAICompat(config)
    : streamAnthropic(config)
}

// ─── Tool use (solo Anthropic) ───────────────────────────────────────────────

/**
 * Ejecuta un agente con tool use loop completo.
 * Solo disponible con proveedor 'anthropic'.
 * Retorna el texto final cuando el modelo termina.
 */
export async function runAgent(config: AgentConfig): Promise<string> {
  const {
    systemPrompt,
    userMessage,
    tools = [],
    maxTokens = 4096,
    onToolCall,
  } = config
  const model = ANTHROPIC_MODEL_OVERRIDE || config.model || 'claude-haiku-4-5'

  const content: Anthropic.MessageParam['content'] = Array.isArray(userMessage) ? userMessage : userMessage
  const messages: Anthropic.MessageParam[] = [{ role: 'user', content }]

  while (true) {
    const response = await anthropicClient.messages.create({
      model,
      max_tokens: maxTokens,
      system: systemPrompt,
      tools: tools as Anthropic.Tool[],
      messages,
    })

    if (response.stop_reason === 'end_turn' || !tools.length) {
      return extractText(response.content)
    }

    if (response.stop_reason === 'tool_use') {
      const toolUseBlocks = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
      )

      const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
        toolUseBlocks.map(async (block) => {
          let result: unknown = `Tool ${block.name} no implementada`

          if (onToolCall) {
            try {
              result = await onToolCall(block.name, block.input)
            } catch (err) {
              result = `Error ejecutando ${block.name}: ${err instanceof Error ? err.message : String(err)}`
            }
          }

          return {
            type: 'tool_result' as const,
            tool_use_id: block.id,
            content: typeof result === 'string' ? result : JSON.stringify(result),
          }
        })
      )

      messages.push(
        { role: 'assistant', content: response.content },
        { role: 'user', content: toolResults }
      )

      continue
    }

    return extractText(response.content)
  }
}

/**
 * Stream agente Anthropic con tool use loop completo.
 * Emite eventos AgentEvent: chunks de texto + indicadores de tool calls.
 *
 * Solo disponible con proveedor 'anthropic' (incluye endpoints
 * Anthropic-compatible como Kimi for Coding).
 */
export function streamAgentWithTools(
  config: AgentStreamConfigWithTools
): ReadableStream<AgentEvent> {
  const model = ANTHROPIC_MODEL_OVERRIDE || config.model || 'claude-sonnet-4-6'
  const maxTokens = config.maxTokens ?? 4096
  const maxIterations = config.maxIterations ?? 5

  return new ReadableStream<AgentEvent>({
    async start(controller) {
      let messages: Anthropic.MessageParam[] = [...config.messages]
      let iterations = 0

      try {
        while (iterations < maxIterations) {
          iterations++

          const stream = anthropicClient.messages.stream({
            model,
            max_tokens: maxTokens,
            system: config.systemPrompt,
            tools: config.tools as Anthropic.Tool[],
            messages,
          })

          for await (const chunk of stream) {
            if (
              chunk.type === 'content_block_start' &&
              chunk.content_block.type === 'tool_use'
            ) {
              controller.enqueue({
                kind: 'tool',
                name: chunk.content_block.name,
                status: 'running',
              })
            } else if (
              chunk.type === 'content_block_delta' &&
              chunk.delta.type === 'text_delta'
            ) {
              controller.enqueue({ kind: 'text', value: chunk.delta.text })
            }
          }

          const final = await stream.finalMessage()
          const toolUses = final.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use'
          )

          // Si el modelo se quedó sin tokens (con o sin tool_use parcial),
          // avisar al usuario en vez de cerrar silencioso.
          if (final.stop_reason === 'max_tokens') {
            controller.enqueue({
              kind: 'text',
              value:
                '\n\n(La respuesta se cortó por límite de tokens. Si necesitas más detalle, pregúntame con un foco más específico.)',
            })
            controller.close()
            return
          }

          if (final.stop_reason !== 'tool_use' || toolUses.length === 0) {
            controller.close()
            return
          }

          const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
            toolUses.map(async (tu) => {
              try {
                const result = await config.onToolCall(tu.name, tu.input)
                controller.enqueue({ kind: 'tool', name: tu.name, status: 'done' })
                return {
                  type: 'tool_result' as const,
                  tool_use_id: tu.id,
                  content:
                    typeof result === 'string' ? result : JSON.stringify(result),
                }
              } catch (err) {
                controller.enqueue({ kind: 'tool', name: tu.name, status: 'error' })
                return {
                  type: 'tool_result' as const,
                  tool_use_id: tu.id,
                  content: JSON.stringify({
                    error: err instanceof Error ? err.message : String(err),
                  }),
                  is_error: true,
                }
              }
            })
          )

          messages.push(
            { role: 'assistant', content: final.content },
            { role: 'user', content: toolResults }
          )
        }

        controller.enqueue({
          kind: 'text',
          value:
            '\n\n(He alcanzado el límite de consultas para esta pregunta. ¿Podrías reformularla?)',
        })
        controller.close()
      } catch (err) {
        controller.error(err)
      }
    },
  })
}
