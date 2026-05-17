# Consultor Tributario IA con Contexto — Design Spec

## Goal

Que el agente Consultor Tributario IA responda con datos reales del tenant: identidad de empresa, métricas del mes actual y capacidad de consultar documentos puntuales y hacer cálculos tributarios sobre montos específicos.

Hoy responde de forma genérica ("Voy a buscar..." sin datos). Después de este cambio responderá "Tu empresa Foo SpA emitió 12 DTE en mayo por $4.5M netos" y, ante "¿qué dice la factura 1024?", consultará la base de datos.

## Context

- El chat actual (`apps/web/components/ai/chat-widget.tsx` → `useConsultor` → `/api/ai/consultor` → Fastify → `streamConsultor`) usa solo streaming sin contexto ni tools.
- `runConsultorWithTools` ya existe en `packages/ai-agents/src/agents/consultor.ts` pero no es streaming y no se llama desde el chat (la UI nunca envía `useTools: true`).
- El provider activo es Kimi for Coding vía endpoint Anthropic-compatible (`ANTHROPIC_BASE_URL=https://api.kimi.com/coding`, `ANTHROPIC_MODEL=kimi-for-coding`). Verificado que soporta tool use streaming nativo en formato Anthropic.
- El `tenantPlugin` ya inyecta `request.companyId` en todas las rutas; en dev usa `'dev-test-company'` con `DEV_BYPASS_AUTH=true`.
- Schema disponible: `Company`, `Document` + `DocumentItem`, `Purchase`, `Employee` + `Payroll`, `JournalEntry`, `Account`, `Honorario`, `Quote`, `Product`, `BankMovement`, etc.
- Validators con cálculos puros ya existen en `@contachile/validators`: `calcularIVA`, `calcularRetencionHonorarios`, `calcularLiquidacion`, `findUpcomingDueDates`.

## Architecture

### Componentes y archivos

```
packages/ai-agents/src/
├── context.ts                ← NUEVO. buildContextSnapshot(companyId) → string markdown
├── base-agent.ts             ← EDIT. agrega streamAgentWithTools()
├── agents/consultor.ts       ← EDIT. nueva streamConsultorWithContext()
└── index.ts                  ← EDIT. exporta lo nuevo

apps/api/src/routes/ai/
└── consultor.ts              ← EDIT. usa nueva función, mantiene SSE protocol

apps/web/
├── hooks/use-consultor.ts    ← EDIT. parser maneja {tool, status}
└── components/ai/chat-widget.tsx ← EDIT. indicador inline de tool en curso

apps/api/scripts/
└── smoke-ai-consultor.ts     ← NUEVO. smoke test E2E
```

### Flujo de una request del chat

```
ChatWidget envía {messages}
   │
   ▼
Next /api/ai/consultor (proxy) ─ pasa header con companyId
   │
   ▼
Fastify /ai/consultor
   │ valida con Zod, sanitiza, audita
   │
   ▼
buildContextSnapshot(companyId)  ← 4 queries Prisma paralelas (~50ms)
   │
   ▼ retorna markdown
   │
streamConsultorWithContext({
  companyId, messages, snapshot, tools
})
   │
   ▼ Anthropic SDK messages.stream({tools, ...})
   │
   ▼ loop:
   │   text_delta    → SSE {text}
   │   tool_use start → SSE {tool: name, status: "running"}
   │   tool_use done  → executeTool(companyId, name, input)
   │                  → SSE {tool: name, status: "done"}
   │                  → continue con tool_result
   │
   ▼ stop_reason: end_turn → SSE [DONE]
```

### Context snapshot

`buildContextSnapshot(companyId: string): Promise<string>` retorna markdown listo para concatenar al system prompt.

Estructura:

```markdown
## CONTEXTO ACTUAL
Hoy es <día> de <mes> de <año>.

### Empresa
- Razón social: <Company.name>
- RUT: <Company.rut> · Giro: <Company.giro ?? "no declarado">
- Certificada SII: sí / no

### Estado de <mes año>
- DTE emitidos: N · Aceptados: N · Pendientes: N · Rechazados: N
- Ventas netas acumuladas: $X
- IVA débito acumulado: $X
- Compras del mes: N · IVA crédito: $X

### Personal
- Trabajadores activos: N

### Próxima obligación
- F29 vence el <fecha> (en N días).
```

Implementación:

```typescript
export async function buildContextSnapshot(companyId: string): Promise<string> {
  try {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)

    const [company, docs, purchases, employeesActive] = await Promise.all([
      prisma.company.findUnique({ where: { id: companyId } }),
      prisma.document.findMany({
        where: { companyId, emittedAt: { gte: startOfMonth } },
        select: { status: true, totalAmount: true, totalTax: true, totalNet: true },
      }),
      prisma.purchase.findMany({
        where: { companyId, date: { gte: startOfMonth } },
        select: { totalAmount: true, totalTax: true },
      }),
      prisma.employee.count({ where: { companyId, isActive: true } }),
    ])

    // formatear markdown ...
  } catch (err) {
    // Log + fallback a snapshot mínimo (solo identidad si está disponible)
    return `## CONTEXTO\nHoy es ${formatDate(new Date())}.`
  }
}
```

Fallback: si la query principal falla, se inyecta solo `Hoy es <fecha>` y el chat sigue funcionando. Si `company` es null, se omite la sección Empresa.

### Tools

Tres tools registradas con el modelo. Todas validan input con Zod antes de ejecutar y respetan scoping por `companyId` desde closure.

#### `get_monthly_summary`

```typescript
{
  name: 'get_monthly_summary',
  description: 'Resumen contable de un mes específico: ventas, IVA débito, compras, IVA crédito, sueldos pagados. Si no se especifica, retorna el mes actual.',
  input_schema: {
    type: 'object',
    properties: {
      year: { type: 'number', description: 'Año (ej: 2026). Default: año actual.' },
      month: { type: 'number', description: 'Mes 1-12. Default: mes actual.' },
    },
  },
}
```

Retorna:
```typescript
{
  periodo: 'Mayo 2026',
  ventas: { documentos: 12, neto: 4523000, iva_debito: 859370, total: 5382370 },
  compras: { documentos: 5, neto: 1267000, iva_credito: 240730, total: 1507730 },
  iva_neto_a_pagar: 618640,
  sueldos_aprobados: { trabajadores: 3, total_liquido: 2284376 },
}
```

#### `find_documents`

```typescript
{
  name: 'find_documents',
  description: 'Busca DTE emitidos. Si se da folio, retorna ese único documento. Si no, retorna hasta `limit` coincidencias (default 5, max 20).',
  input_schema: {
    type: 'object',
    properties: {
      folio: { type: 'number' },
      type: { type: 'number', description: '33, 39, 56, 61, etc.' },
      receiverRut: { type: 'string' },
      search: { type: 'string', description: 'Nombre del receptor (búsqueda parcial)' },
      status: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'FAILED'] },
      limit: { type: 'number', description: 'Default 5, máx 20.' },
    },
  },
}
```

Retorna array (incluso si folio único) de:
```typescript
{
  id, folio, type, receiverRut, receiverName,
  totalNet, totalTax, totalAmount, status,
  emittedAt: ISO string,
  itemsCount: number,
}
```

#### `calculate_tax`

```typescript
{
  name: 'calculate_tax',
  description: 'Cálculos tributarios chilenos: IVA 19%, retención honorarios 13.75%, líquido de sueldo aproximado.',
  input_schema: {
    type: 'object',
    properties: {
      kind: { type: 'string', enum: ['iva', 'retencion_honorarios', 'sueldo_liquido'] },
      amount: { type: 'number', description: 'Monto base en CLP' },
      afp: { type: 'string', enum: ['CAPITAL', 'CUPRUM', 'HABITAT', 'MODELO', 'PLANVITAL', 'PROVIDA', 'UNO'] },
      healthPlan: { type: 'string', enum: ['FONASA', 'ISAPRE'] },
    },
    required: ['kind', 'amount'],
  },
}
```

Retorna estructura específica por tipo. Reusa `calcularIVA`, `calcularRetencionHonorarios`, `calcularLiquidacion` de `@contachile/validators`.

### Streaming con tool use loop

En `base-agent.ts` se agrega `streamAgentWithTools(config)`. Para la API de Anthropic SDK `messages.stream({ tools, ... })`:

```typescript
export async function streamAgentWithTools(config: AgentStreamConfigWithTools): ReadableStream<AgentEvent> {
  return new ReadableStream({
    async start(controller) {
      let iterations = 0
      const MAX_ITERATIONS = 5
      let messages = [...config.initialMessages]

      while (iterations < MAX_ITERATIONS) {
        iterations++
        const stream = anthropicClient.messages.stream({
          model: ANTHROPIC_MODEL_OVERRIDE || config.model || 'claude-sonnet-4-6',
          max_tokens: config.maxTokens ?? 4096,
          system: config.systemPrompt,
          tools: config.tools as Anthropic.Tool[],
          messages,
        })

        const toolUses: Anthropic.ToolUseBlock[] = []
        let assistantContent: Anthropic.ContentBlock[] = []

        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta') {
            if (chunk.delta.type === 'text_delta') {
              controller.enqueue({ kind: 'text', value: chunk.delta.text })
            }
          }
          if (chunk.type === 'content_block_start' && chunk.content_block.type === 'tool_use') {
            controller.enqueue({ kind: 'tool', name: chunk.content_block.name, status: 'running' })
          }
        }

        const final = await stream.finalMessage()
        assistantContent = final.content
        for (const block of final.content) {
          if (block.type === 'tool_use') toolUses.push(block)
        }

        if (final.stop_reason === 'end_turn' || toolUses.length === 0) {
          controller.close()
          return
        }

        // Ejecutar tools
        const toolResults: Anthropic.ToolResultBlockParam[] = await Promise.all(
          toolUses.map(async (tu) => {
            try {
              const result = await config.onToolCall(tu.name, tu.input)
              controller.enqueue({ kind: 'tool', name: tu.name, status: 'done' })
              return { type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) }
            } catch (err) {
              controller.enqueue({ kind: 'tool', name: tu.name, status: 'error' })
              return { type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify({ error: String(err) }), is_error: true }
            }
          })
        )

        messages.push(
          { role: 'assistant', content: assistantContent },
          { role: 'user', content: toolResults }
        )
      }

      controller.enqueue({ kind: 'text', value: '\n\n(He alcanzado el límite de consultas para esta pregunta. ¿Podrías reformularla?)' })
      controller.close()
    },
  })
}
```

Tipo `AgentEvent`:
```typescript
type AgentEvent =
  | { kind: 'text'; value: string }
  | { kind: 'tool'; name: string; status: 'running' | 'done' | 'error' }
```

### Adaptador en la ruta Fastify

`apps/api/src/routes/ai/consultor.ts` mapea `AgentEvent` a SSE:

```typescript
for await (const evt of reader) {
  if (evt.kind === 'text') {
    reply.raw.write(`data: ${JSON.stringify({ text: evt.value })}\n\n`)
  } else if (evt.kind === 'tool') {
    reply.raw.write(`data: ${JSON.stringify({ tool: evt.name, status: evt.status })}\n\n`)
  }
}
reply.raw.write('data: [DONE]\n\n')
```

Se mantienen los headers SSE actuales y la sanitización/audit. Se deprecan los dos modos `useTools=true|false`: ambos colapsan al mismo flujo nuevo (`useTools` se ignora silenciosamente). El modo `tools` no-streaming queda eliminado.

### SSE Protocol extendido

```
data: {"text": "..."}                           ← chunk de texto
data: {"tool": "find_documents", "status": "running"}  ← nuevo
data: {"tool": "find_documents", "status": "done"}     ← nuevo
data: {"tool": "find_documents", "status": "error"}    ← nuevo
data: {"error": "..."}                          ← error fatal (igual)
data: [DONE]                                    ← marcador final
```

Retro-compatible: el parser actual ignora keys desconocidas dentro del JSON.

### Frontend: `useConsultor`

Agrego campo `toolStatus?: { name: string; running: boolean }` al `ChatMessage` del asistente. Lo seteo cuando llegan eventos `{tool, status}`:

```typescript
if (parsed.tool) {
  setMessages((prev) =>
    prev.map((m) =>
      m.id === assistantId
        ? { ...m, toolStatus: parsed.status === 'running' ? { name: parsed.tool, running: true } : undefined }
        : m
    )
  )
  continue
}
```

### Frontend: `ChatWidget` indicador

Dentro de `MessageEntry`, antes del texto, si `toolStatus?.running`:

```tsx
{toolStatus?.running && (
  <div className="inline-flex items-center gap-2 mb-1.5 px-2 py-0.5 rounded-sm bg-secondary/40 text-[0.65rem] font-medium text-foreground/70">
    <span className="inline-flex gap-0.5">
      <span className="h-1 w-1 animate-bounce rounded-full bg-foreground/40 [animation-delay:0ms]" />
      <span className="h-1 w-1 animate-bounce rounded-full bg-foreground/40 [animation-delay:150ms]" />
    </span>
    <span>{TOOL_LABELS[toolStatus.name] ?? 'Consultando datos'}…</span>
  </div>
)}
```

Mapa de labels:
```typescript
const TOOL_LABELS: Record<string, string> = {
  find_documents: 'Buscando documentos',
  get_monthly_summary: 'Resumiendo el mes',
  calculate_tax: 'Calculando impuesto',
}
```

## Error handling

| Caso | Comportamiento |
|---|---|
| Query del snapshot falla | Fallback a snapshot mínimo (`Hoy es <fecha>`). Log warn. Chat continúa. |
| `company` no existe | Sección Empresa omitida; resto del snapshot intacto. |
| Tool execution throw | Tool_result devuelve `{error}` con `is_error: true`. El modelo lo recibe y explica al usuario. |
| Tool input inválido (Zod fail) | Executor retorna `{error: "Argumentos inválidos: ..."}`. |
| Loop tool_use ≥ 5 iteraciones | Stream emite texto "He alcanzado el límite, reformula tu pregunta" y cierra. |
| Cliente aborta (stopStreaming) | AbortController existente cancela el reader; recursos liberados. |
| Provider falla mid-stream | `safeErrorMessage(err)` se aplica y se envía como `{error}` por SSE. |
| `limit` de búsqueda > 20 | Executor cap-ea a 20 silenciosamente. |

Auditoría: el `auditLog` actual se extiende con campo `toolCalls: number` (conteo de tool_use por request). Rate limit existente (20 req/min stream) sigue aplicando — las tool_use no consumen rate limit adicional porque pasan dentro de la misma request del usuario.

## Testing

### Unit tests

1. **`buildContextSnapshot`** (`packages/ai-agents/src/context.test.ts`)
   - Seed: 1 Company, 2 Documents (1 ACCEPTED + 1 PENDING), 1 Purchase, 1 Employee activo
   - Aserta que el markdown contiene `Company.name`, `Company.rut`, "Aceptados: 1", "Pendientes: 1", "Trabajadores activos: 1"

2. **`executeTool` por tool** (mismo archivo o `consultor.test.ts`)
   - `get_monthly_summary` con seed → verifica `ventas.documentos === 2`, `iva_neto_a_pagar` correcto
   - `find_documents` por folio existente → match único
   - `find_documents` por folio inexistente → array vacío
   - `find_documents` con `limit: 50` → cap-eado a 20
   - `calculate_tax` IVA $100.000 → `iva_19_porciento: 19000`
   - `calculate_tax` retención $1.000.000 → retención $137.500
   - `calculate_tax` sueldo $1.000.000 Habitat/Fonasa → líquido cercano a smoke-payroll histórico

### Smoke E2E

`apps/api/scripts/smoke-ai-consultor.ts`:
- Seed mínimo (Company `dev-test-company` + 1 Document)
- Caso 1: pregunta general ("¿qué tasa de IVA?") → assert que llegan eventos `{text}` y NO `{tool}`
- Caso 2: pregunta con datos ("¿cuántos documentos emití?") → assert que llega evento `{tool: get_monthly_summary, status: running}` y respuesta cita el número correcto
- Caso 3: pregunta por folio ("¿qué dice la factura {folio}?") → assert evento `{tool: find_documents}`

Ejecutar con `pnpm --filter @contachile/api tsx scripts/smoke-ai-consultor.ts`.

### Manual test browser

Abrir el FAB del chat:
1. "Hola" → respuesta natural, sin tool indicator
2. "¿Cuándo vence el F29 de este mes?" → debería responder con la fecha del snapshot, sin tool indicator
3. "¿Qué facturé en abril?" → tool indicator "Resumiendo el mes…" → respuesta con números del seed
4. "¿Qué dice la factura 1024?" → tool indicator "Buscando documentos…" → cita receptor y monto

## Out of scope (siguiente sprint)

- Tools para **compras** o **asientos contables** específicos.
- Tools para emitir DTE / aprobar liquidaciones / acciones con efectos en DB (read-only por ahora).
- Generación de **F29 / F22** con tool use (requiere agente dedicado más pesado).
- **Memoria persistente** entre sesiones del chat. Cada conversación arranca de cero.
- **Caching** del snapshot. Si el costo molesta, se hace luego.
- **Búsqueda full-text** (Postgres tsvector). Por ahora `contains` simple.

## Risks

- Snapshot agrega ~500-1500 tokens al system prompt. Costo extra por mensaje. Aceptable porque la mayoría de preguntas no gatillan tool calls.
- Tool use loop puede ciclar — mitigado con `MAX_ITERATIONS = 5`.
- Provider (Kimi for Coding) puede cambiar comportamiento tool use sin previo aviso. El parser de eventos sigue el spec Anthropic, así que un eventual cambio de provider a Anthropic real debería funcionar igual.
- Sanitización contra prompt injection ya existe (delimitadores XML). El snapshot inyectado es server-side, sin riesgo de inyección.

## Migration / Rollout

Sin migración de DB. Cambios solo en código.

1. `packages/ai-agents` — build y publicar via workspace.
2. `apps/api` — reiniciar Fastify para tomar nuevas funciones.
3. `apps/web` — Next.js hot-reload toma los cambios.

Rollback: revertir commits. Sin estado migrado.
