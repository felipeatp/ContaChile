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
  userMessage: string
  tools?: AgentTool[]
  model?: string
  maxTokens?: number
  onToolCall?: (toolName: string, input: unknown) => unknown | Promise<unknown>
}

export interface AgentStreamConfig extends Omit<AgentConfig, 'userMessage'> {
  messages: Anthropic.MessageParam[]
}

// ─── Clientes ────────────────────────────────────────────────────────────────

const anthropicClient = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  ...(process.env.ANTHROPIC_BASE_URL && { baseURL: process.env.ANTHROPIC_BASE_URL }),
})

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
  const { systemPrompt, messages, model = 'claude-sonnet-4-6', maxTokens = 4096 } = config

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
    model = 'claude-haiku-4-5',
    maxTokens = 4096,
    onToolCall,
  } = config

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }]

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
