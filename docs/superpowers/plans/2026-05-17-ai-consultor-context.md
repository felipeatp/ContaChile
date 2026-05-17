# Consultor IA con Contexto — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Que el Consultor Tributario IA conozca al tenant (identidad de empresa + métricas del mes) y pueda consultar documentos puntuales y hacer cálculos vía tool use, todo manteniendo streaming.

**Architecture:** Snapshot markdown inyectado en el system prompt (queries Prisma server-side) + tool use loop sobre Anthropic SDK streaming. Tres tools: `get_monthly_summary`, `find_documents`, `calculate_tax`. SSE protocol extendido con eventos `{tool, status}` retro-compatibles.

**Tech Stack:** TypeScript, Anthropic SDK 0.36 (apuntando a endpoint Anthropic-compatible de Kimi for Coding), Prisma 5, Fastify 4, Next.js 14, vitest. Reusa `calcularIVA`/`calcularRetencionHonorarios`/`calcularLiquidacion` de `@contachile/validators`.

**Reference spec:** `docs/superpowers/specs/2026-05-17-ai-consultor-context-design.md`

---

## File Structure

**Create:**
- `packages/ai-agents/src/context.ts` — `buildContextSnapshot(companyId)` retorna markdown
- `apps/api/tests/ai-context.test.ts` — vitest unit tests para snapshot + tools
- `apps/api/scripts/smoke-ai-consultor.ts` — smoke E2E

**Modify:**
- `packages/ai-agents/src/base-agent.ts` — agrega `AgentEvent` type + `streamAgentWithTools()`
- `packages/ai-agents/src/agents/consultor.ts` — reemplaza tools, agrega `streamConsultorWithContext`
- `packages/ai-agents/src/index.ts` — exports nuevos
- `apps/api/src/routes/ai/consultor.ts` — llama función nueva, emite `{tool, status}` SSE
- `apps/web/hooks/use-consultor.ts` — parser maneja eventos tool, expone `toolStatus`
- `apps/web/components/ai/chat-widget.tsx` — render del indicador inline de tool

---

## Task 1: AgentEvent type and streamAgentWithTools in base-agent

**Files:**
- Modify: `packages/ai-agents/src/base-agent.ts`

- [ ] **Step 1: Agregar el tipo `AgentEvent` después del tipo `AgentStreamConfig`**

Ubicación: justo después de la definición de `AgentStreamConfig` en líneas 25-27.

```typescript
export interface AgentStreamConfigWithTools extends AgentStreamConfig {
  tools: AgentTool[]
  onToolCall: (toolName: string, input: unknown) => unknown | Promise<unknown>
  maxIterations?: number
}

export type AgentEvent =
  | { kind: 'text'; value: string }
  | { kind: 'tool'; name: string; status: 'running' | 'done' | 'error' }
```

- [ ] **Step 2: Agregar `streamAgentWithTools` al final de base-agent.ts**

```typescript
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
```

- [ ] **Step 3: Build the package**

Run: `pnpm --filter @contachile/ai-agents build`

Expected: silent success (tsc with no errors).

- [ ] **Step 4: Verify dist contains new export**

Run: `Get-Content packages/ai-agents/dist/base-agent.d.ts | Select-String "streamAgentWithTools"`

Expected: matches the declaration line.

- [ ] **Step 5: Commit**

```bash
git add packages/ai-agents/src/base-agent.ts
git commit -m "feat(ai-agents): add streamAgentWithTools with tool_use loop

Anthropic SDK streaming with tools support. Iterates over chunks for
text and tool_use events, executes tools via onToolCall, recurses
with tool_results until end_turn or maxIterations=5."
```

---

## Task 2: buildContextSnapshot in context.ts

**Files:**
- Create: `packages/ai-agents/src/context.ts`
- Create: `apps/api/tests/ai-context.test.ts`
- Modify: `packages/ai-agents/src/index.ts`

- [ ] **Step 1: Write the failing test for buildContextSnapshot**

Create `apps/api/tests/ai-context.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@contachile/db'
import { buildContextSnapshot } from '@contachile/ai-agents'

const prisma = new PrismaClient()
const COMPANY_ID = 'test-ai-context-company'

describe('buildContextSnapshot', () => {
  beforeAll(async () => {
    // Clean
    await prisma.documentItem.deleteMany({ where: { document: { companyId: COMPANY_ID } } })
    await prisma.document.deleteMany({ where: { companyId: COMPANY_ID } })
    await prisma.employee.deleteMany({ where: { companyId: COMPANY_ID } })
    await prisma.company.deleteMany({ where: { id: COMPANY_ID } })

    // Seed
    await prisma.company.create({
      data: {
        id: COMPANY_ID,
        rut: '76.999.999-9',
        name: 'Test SpA',
        giro: 'Servicios informáticos',
        siiCertified: true,
      },
    })
    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    await prisma.document.createMany({
      data: [
        {
          companyId: COMPANY_ID, type: 33, folio: 1001,
          receiverRut: '11.111.111-1', receiverName: 'Cliente A',
          totalNet: 100000, totalTax: 19000, totalAmount: 119000,
          status: 'ACCEPTED', emittedAt: monthStart, paymentMethod: 'CONTADO',
        },
        {
          companyId: COMPANY_ID, type: 33, folio: 1002,
          receiverRut: '22.222.222-2', receiverName: 'Cliente B',
          totalNet: 50000, totalTax: 9500, totalAmount: 59500,
          status: 'PENDING', emittedAt: monthStart, paymentMethod: 'CONTADO',
        },
      ],
    })
    await prisma.employee.create({
      data: {
        companyId: COMPANY_ID, rut: '15.111.111-1', name: 'Empleado Test',
        position: 'Dev', startDate: new Date(), contractType: 'INDEFINIDO',
        baseSalary: 1500000, afp: 'HABITAT', healthPlan: 'FONASA', isActive: true,
      },
    })
  })

  afterAll(async () => {
    await prisma.document.deleteMany({ where: { companyId: COMPANY_ID } })
    await prisma.employee.deleteMany({ where: { companyId: COMPANY_ID } })
    await prisma.company.deleteMany({ where: { id: COMPANY_ID } })
    await prisma.$disconnect()
  })

  it('builds markdown snapshot with company + metrics', async () => {
    const md = await buildContextSnapshot(COMPANY_ID)
    expect(md).toContain('Test SpA')
    expect(md).toContain('76.999.999-9')
    expect(md).toContain('Servicios informáticos')
    expect(md).toMatch(/Aceptados:\s*1/)
    expect(md).toMatch(/Pendientes:\s*1/)
    expect(md).toMatch(/Trabajadores activos:\s*1/)
    // Ventas netas: 100k aceptado + 50k pendiente = 150k. Solo cuentan ACEPTADOS para IVA débito.
    expect(md).toContain('100.000') // ventas netas aceptadas
  })

  it('returns minimal snapshot for unknown company', async () => {
    const md = await buildContextSnapshot('unknown-company-id')
    expect(md).toMatch(/CONTEXTO/i)
    expect(md).not.toContain('Razón social:')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @contachile/api test -- tests/ai-context.test.ts`

Expected: FAIL with `Cannot find module '@contachile/ai-agents' or its corresponding type declarations` referencing `buildContextSnapshot` (no exporta esa función todavía).

- [ ] **Step 3: Create `packages/ai-agents/src/context.ts`**

```typescript
import { prisma } from '@contachile/db'

const MONTHS_ES = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
]

const DAYS_ES = [
  'domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado',
]

function formatLongDate(d: Date): string {
  return `${DAYS_ES[d.getDay()]} ${d.getDate()} de ${MONTHS_ES[d.getMonth()]} de ${d.getFullYear()}`
}

function formatCLP(n: number): string {
  return `$${n.toLocaleString('es-CL')}`
}

function nextF29DueDate(today: Date): { date: Date; daysUntil: number } {
  // F29 vence el 20 del mes siguiente al mes facturado (ajuste fin de semana fuera de scope).
  const year = today.getFullYear()
  const month = today.getMonth()
  const candidate = new Date(year, month, 20)
  if (today.getDate() > 20) candidate.setMonth(candidate.getMonth() + 1)
  const ms = candidate.getTime() - today.getTime()
  return { date: candidate, daysUntil: Math.ceil(ms / (1000 * 60 * 60 * 24)) }
}

/**
 * Construye un snapshot en markdown con el contexto actual del tenant:
 * empresa, métricas del mes en curso, próxima obligación tributaria.
 *
 * Si alguna query falla, retorna un snapshot mínimo (solo fecha) sin
 * bloquear el chat. Diseñado para inyectarse en el system prompt del LLM.
 */
export async function buildContextSnapshot(companyId: string): Promise<string> {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const periodLabel = `${MONTHS_ES[now.getMonth()].replace(/^./, c => c.toUpperCase())} ${now.getFullYear()}`

  try {
    const [company, docs, purchases, employeesActive] = await Promise.all([
      prisma.company.findUnique({ where: { id: companyId } }),
      prisma.document.findMany({
        where: { companyId, emittedAt: { gte: startOfMonth } },
        select: { status: true, totalAmount: true, totalTax: true, totalNet: true },
      }),
      prisma.purchase.findMany({
        where: { companyId, date: { gte: startOfMonth } },
        select: { totalAmount: true, totalTax: true, totalNet: true },
      }),
      prisma.employee.count({ where: { companyId, isActive: true } }),
    ])

    const accepted = docs.filter(d => d.status === 'ACCEPTED')
    const pending = docs.filter(d => d.status === 'PENDING')
    const rejected = docs.filter(d => d.status === 'REJECTED')
    const ventasNeto = accepted.reduce((s, d) => s + d.totalNet, 0)
    const ivaDebito = accepted.reduce((s, d) => s + d.totalTax, 0)
    const comprasNeto = purchases.reduce((s, p) => s + p.totalNet, 0)
    const ivaCredito = purchases.reduce((s, p) => s + p.totalTax, 0)
    const { date: f29Date, daysUntil: f29Days } = nextF29DueDate(now)

    const lines: string[] = []
    lines.push('## CONTEXTO ACTUAL')
    lines.push(`Hoy es ${formatLongDate(now)}.`)

    if (company) {
      lines.push('')
      lines.push('### Empresa')
      lines.push(`- Razón social: ${company.name}`)
      lines.push(`- RUT: ${company.rut} · Giro: ${company.giro ?? 'no declarado'}`)
      lines.push(`- Certificada SII: ${company.siiCertified ? 'sí' : 'no'}`)
    }

    lines.push('')
    lines.push(`### Estado de ${periodLabel}`)
    lines.push(`- DTE emitidos: ${docs.length} · Aceptados: ${accepted.length} · Pendientes: ${pending.length} · Rechazados: ${rejected.length}`)
    lines.push(`- Ventas netas acumuladas (aceptadas): ${formatCLP(ventasNeto)}`)
    lines.push(`- IVA débito acumulado: ${formatCLP(ivaDebito)}`)
    lines.push(`- Compras del mes: ${purchases.length} · IVA crédito: ${formatCLP(ivaCredito)}`)

    lines.push('')
    lines.push('### Personal')
    lines.push(`- Trabajadores activos: ${employeesActive}`)

    lines.push('')
    lines.push('### Próxima obligación')
    lines.push(`- F29 vence el ${f29Date.getDate()} de ${MONTHS_ES[f29Date.getMonth()]} (en ${f29Days} día${f29Days === 1 ? '' : 's'}).`)

    return lines.join('\n')
  } catch (err) {
    // Fallback silencioso: log al stderr y retornar snapshot mínimo.
    console.warn('[buildContextSnapshot] failed:', err instanceof Error ? err.message : err)
    return `## CONTEXTO\nHoy es ${formatLongDate(now)}.`
  }
}
```

- [ ] **Step 4: Add export to `packages/ai-agents/src/index.ts`**

Append after the existing exports:

```typescript
export { buildContextSnapshot } from './context'
```

Full updated file:

```typescript
export { runAgent, streamAgent, streamAgentWithTools } from './base-agent'
export type {
  AgentConfig,
  AgentTool,
  AgentStreamConfig,
  AgentStreamConfigWithTools,
  AgentEvent,
} from './base-agent'

export { streamConsultor, runConsultorWithTools } from './agents/consultor'
export type { ConsultorMessage } from './agents/consultor'

export { clasificarTransaccion, clasificarLote } from './agents/clasificador'
export type { BankTransaction, ClassificationResult } from './agents/clasificador'

export {
  sanitizeMessages,
  sanitizeUserInput,
  MAX_MESSAGE_CHARS,
  MAX_CONVERSATION_CHARS,
  MAX_MESSAGES,
} from './sanitize'
export type { SanitizedMessage, SanitizeResult } from './sanitize'

export { buildContextSnapshot } from './context'
```

- [ ] **Step 5: Rebuild the package**

Run: `pnpm --filter @contachile/ai-agents build`

Expected: silent success.

- [ ] **Step 6: Run the test to verify it passes**

Run: `pnpm --filter @contachile/api test -- tests/ai-context.test.ts`

Expected: 2 tests PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/ai-agents/src/context.ts packages/ai-agents/src/index.ts apps/api/tests/ai-context.test.ts
git commit -m "feat(ai-agents): add buildContextSnapshot

Generates markdown snapshot of current tenant context (company,
monthly metrics, next F29) for injection into system prompt.
Falls back to minimal snapshot if DB queries fail."
```

---

## Task 3: Replace tools in consultor.ts (get_monthly_summary, find_documents, calculate_tax)

**Files:**
- Modify: `packages/ai-agents/src/agents/consultor.ts`
- Modify: `apps/api/tests/ai-context.test.ts` (append tool tests)

- [ ] **Step 1: Append failing tests for the three new tools**

Add to `apps/api/tests/ai-context.test.ts` after the previous `describe` block:

```typescript
import { executeConsultorTool } from '@contachile/ai-agents'

describe('executeConsultorTool', () => {
  // Reusa seed de buildContextSnapshot describe (mismo COMPANY_ID)

  it('get_monthly_summary returns aggregates for current month', async () => {
    const now = new Date()
    const result = await executeConsultorTool(COMPANY_ID, 'get_monthly_summary', {
      year: now.getFullYear(),
      month: now.getMonth() + 1,
    }) as Record<string, any>
    expect(result.ventas.documentos).toBe(2)
    expect(result.ventas.neto).toBe(100000) // solo ACCEPTED suma a neto
    expect(result.ventas.iva_debito).toBe(19000)
  })

  it('find_documents by folio returns single match', async () => {
    const result = await executeConsultorTool(COMPANY_ID, 'find_documents', {
      folio: 1001,
    }) as { results: any[] }
    expect(result.results).toHaveLength(1)
    expect(result.results[0].folio).toBe(1001)
    expect(result.results[0].receiverName).toBe('Cliente A')
  })

  it('find_documents by receiverRut returns match', async () => {
    const result = await executeConsultorTool(COMPANY_ID, 'find_documents', {
      receiverRut: '22.222.222-2',
    }) as { results: any[] }
    expect(result.results).toHaveLength(1)
    expect(result.results[0].folio).toBe(1002)
  })

  it('find_documents caps limit at 20', async () => {
    const result = await executeConsultorTool(COMPANY_ID, 'find_documents', {
      limit: 100,
    }) as { results: any[]; limit: number }
    expect(result.limit).toBe(20)
  })

  it('calculate_tax iva 100000 returns 19000', async () => {
    const result = await executeConsultorTool(COMPANY_ID, 'calculate_tax', {
      kind: 'iva',
      amount: 100000,
    }) as Record<string, any>
    expect(result.iva).toBe(19000)
    expect(result.total).toBe(119000)
  })

  it('calculate_tax retencion_honorarios 1000000 returns 137500', async () => {
    const result = await executeConsultorTool(COMPANY_ID, 'calculate_tax', {
      kind: 'retencion_honorarios',
      amount: 1000000,
    }) as Record<string, any>
    expect(result.retencion).toBe(137500)
    expect(result.liquido).toBe(862500)
  })

  it('calculate_tax sueldo_liquido for $1.000.000 Habitat/Fonasa', async () => {
    const result = await executeConsultorTool(COMPANY_ID, 'calculate_tax', {
      kind: 'sueldo_liquido',
      amount: 1000000,
      afp: 'HABITAT',
      healthPlan: 'FONASA',
    }) as Record<string, any>
    expect(result.bruto).toBe(1000000)
    expect(result.liquido).toBeGreaterThan(800000)
    expect(result.liquido).toBeLessThan(900000)
  })

  it('calculate_tax with unknown kind returns error', async () => {
    const result = await executeConsultorTool(COMPANY_ID, 'calculate_tax', {
      kind: 'unknown' as any,
      amount: 1000,
    }) as Record<string, any>
    expect(result.error).toBeDefined()
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `pnpm --filter @contachile/api test -- tests/ai-context.test.ts`

Expected: FAIL with `executeConsultorTool is not exported`.

- [ ] **Step 3: Rewrite tools section and executor in `consultor.ts`**

Reemplaza el bloque completo de `const TOOLS: AgentTool[]` (líneas ~48-84) y `async function executeTool` (líneas ~86-164) en `packages/ai-agents/src/agents/consultor.ts` con:

```typescript
import { z } from 'zod'
import {
  calcularIVA,
  calcularRetencionHonorarios,
  calcularLiquidacion,
} from '@contachile/validators'

const TOOLS: AgentTool[] = [
  {
    name: 'get_monthly_summary',
    description: 'Resumen contable de un mes específico (ventas, IVA débito, compras, IVA crédito). Si no se especifican año/mes, retorna el mes actual.',
    input_schema: {
      type: 'object',
      properties: {
        year: { type: 'number', description: 'Año (ej: 2026). Default: año actual.' },
        month: { type: 'number', description: 'Mes 1-12. Default: mes actual.' },
      },
    },
  },
  {
    name: 'find_documents',
    description: 'Busca DTE emitidos. Si se da folio, retorna ese único documento. Si no, retorna hasta `limit` coincidencias (default 5, máx 20).',
    input_schema: {
      type: 'object',
      properties: {
        folio: { type: 'number' },
        type: { type: 'number', description: '33=Factura, 39=Boleta, 56=N.Débito, 61=N.Crédito, etc.' },
        receiverRut: { type: 'string', description: 'RUT receptor con guión, ej: 76.123.456-7' },
        search: { type: 'string', description: 'Búsqueda parcial sobre el nombre del receptor' },
        status: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'FAILED'] },
        limit: { type: 'number', description: 'Default 5, máx 20.' },
      },
    },
  },
  {
    name: 'calculate_tax',
    description: 'Cálculos tributarios chilenos: IVA 19%, retención de honorarios (13.75%), líquido aproximado de sueldo.',
    input_schema: {
      type: 'object',
      properties: {
        kind: { type: 'string', enum: ['iva', 'retencion_honorarios', 'sueldo_liquido'] },
        amount: { type: 'number', description: 'Monto base en CLP' },
        afp: { type: 'string', enum: ['CAPITAL', 'CUPRUM', 'HABITAT', 'MODELO', 'PLANVITAL', 'PROVIDA', 'UNO'], description: 'Requerido para sueldo_liquido' },
        healthPlan: { type: 'string', enum: ['FONASA', 'ISAPRE'], description: 'Requerido para sueldo_liquido' },
        contractType: { type: 'string', enum: ['INDEFINIDO', 'PLAZO_FIJO', 'HONORARIOS'], description: 'Opcional para sueldo_liquido. Default INDEFINIDO (incluye seguro cesantía).' },
      },
      required: ['kind', 'amount'],
    },
  },
]

// ─── Schemas de input ─────────────────────────────────────────────────────────

const MonthlySummarySchema = z.object({
  year: z.number().int().optional(),
  month: z.number().int().min(1).max(12).optional(),
})

const FindDocumentsSchema = z.object({
  folio: z.number().int().positive().optional(),
  type: z.number().int().optional(),
  receiverRut: z.string().optional(),
  search: z.string().optional(),
  status: z.enum(['PENDING', 'ACCEPTED', 'REJECTED', 'FAILED']).optional(),
  limit: z.number().int().positive().optional(),
})

const CalculateTaxSchema = z.object({
  kind: z.enum(['iva', 'retencion_honorarios', 'sueldo_liquido']),
  amount: z.number().nonnegative(),
  afp: z.enum(['CAPITAL', 'CUPRUM', 'HABITAT', 'MODELO', 'PLANVITAL', 'PROVIDA', 'UNO']).optional(),
  healthPlan: z.enum(['FONASA', 'ISAPRE']).optional(),
  contractType: z.enum(['INDEFINIDO', 'PLAZO_FIJO', 'HONORARIOS']).optional(),
})

// ─── Executor ─────────────────────────────────────────────────────────────────

/**
 * Ejecuta una tool del consultor. Siempre scoped por companyId.
 * Si la input es inválida retorna { error } en lugar de throw (el LLM lo recibe).
 */
export async function executeConsultorTool(
  companyId: string,
  toolName: string,
  input: unknown
): Promise<unknown> {
  switch (toolName) {
    case 'get_monthly_summary': {
      const parsed = MonthlySummarySchema.safeParse(input)
      if (!parsed.success) return { error: 'Argumentos inválidos para get_monthly_summary' }
      const now = new Date()
      const year = parsed.data.year ?? now.getFullYear()
      const month = parsed.data.month ?? now.getMonth() + 1
      const from = new Date(year, month - 1, 1)
      const to = new Date(year, month, 1)

      const [docs, purchases] = await Promise.all([
        prisma.document.findMany({
          where: { companyId, emittedAt: { gte: from, lt: to } },
          select: { status: true, totalNet: true, totalTax: true, totalAmount: true, type: true },
        }),
        prisma.purchase.findMany({
          where: { companyId, date: { gte: from, lt: to } },
          select: { netAmount: true, taxAmount: true, totalAmount: true },
        }),
      ])
      const accepted = docs.filter(d => d.status === 'ACCEPTED')
      const ventasNeto = accepted.reduce((s, d) => s + d.totalNet, 0)
      const ivaDebito = accepted.reduce((s, d) => s + d.totalTax, 0)
      const comprasNeto = purchases.reduce((s, p) => s + p.netAmount, 0)
      const ivaCredito = purchases.reduce((s, p) => s + p.taxAmount, 0)

      return {
        periodo: `${month.toString().padStart(2, '0')}/${year}`,
        ventas: {
          documentos: docs.length,
          aceptados: accepted.length,
          neto: ventasNeto,
          iva_debito: ivaDebito,
          total: ventasNeto + ivaDebito,
        },
        compras: {
          documentos: purchases.length,
          neto: comprasNeto,
          iva_credito: ivaCredito,
          total: comprasNeto + ivaCredito,
        },
        iva_neto_a_pagar: Math.max(0, ivaDebito - ivaCredito),
      }
    }

    case 'find_documents': {
      const parsed = FindDocumentsSchema.safeParse(input)
      if (!parsed.success) return { error: 'Argumentos inválidos para find_documents' }
      const { folio, type, receiverRut, search, status, limit } = parsed.data
      const cappedLimit = Math.min(limit ?? 5, 20)

      const docs = await prisma.document.findMany({
        where: {
          companyId,
          ...(folio !== undefined && { folio }),
          ...(type !== undefined && { type }),
          ...(receiverRut && { receiverRut }),
          ...(search && { receiverName: { contains: search, mode: 'insensitive' } }),
          ...(status && { status }),
        },
        select: {
          id: true, folio: true, type: true,
          receiverRut: true, receiverName: true,
          totalNet: true, totalTax: true, totalAmount: true,
          status: true, emittedAt: true,
          _count: { select: { items: true } },
        },
        orderBy: { emittedAt: 'desc' },
        take: cappedLimit,
      })

      return {
        limit: cappedLimit,
        count: docs.length,
        results: docs.map(d => ({
          id: d.id,
          folio: d.folio,
          type: d.type,
          receiverRut: d.receiverRut,
          receiverName: d.receiverName,
          totalNet: d.totalNet,
          totalTax: d.totalTax,
          totalAmount: d.totalAmount,
          status: d.status,
          emittedAt: d.emittedAt.toISOString(),
          itemsCount: d._count.items,
        })),
      }
    }

    case 'calculate_tax': {
      const parsed = CalculateTaxSchema.safeParse(input)
      if (!parsed.success) return { error: 'Argumentos inválidos para calculate_tax' }
      const { kind, amount, afp, healthPlan, contractType } = parsed.data
      if (kind === 'iva') {
        const iva = calcularIVA(amount)
        return { neto: amount, iva, total: amount + iva, nota: 'IVA 19% redondeado hacia abajo' }
      }
      if (kind === 'retencion_honorarios') {
        const r = calcularRetencionHonorarios(amount)
        return { bruto: r.gross, retencion: r.retention, liquido: r.net, tasa: r.rate }
      }
      if (kind === 'sueldo_liquido') {
        if (!afp || !healthPlan) {
          return { error: 'sueldo_liquido requiere afp y healthPlan' }
        }
        const liq = calcularLiquidacion({
          baseSalary: amount,
          afp,
          healthPlan,
          contractType: contractType ?? 'INDEFINIDO',
        })
        return {
          bruto: liq.bruto,
          afp_descuento: liq.afp,
          salud_descuento: liq.salud,
          cesantia_descuento: liq.cesantia,
          base_imponible: liq.baseImponible,
          impuesto_unico: liq.impuesto,
          liquido: liq.liquido,
          nota: 'Cálculo orientativo; topes legales no incluidos.',
        }
      }
      return { error: `Tipo de cálculo no soportado: ${kind}` }
    }

    default:
      return { error: `Herramienta "${toolName}" no reconocida` }
  }
}
```

Importante: borra la función `executeTool` privada anterior y la referencia desde `runConsultorWithTools`. Esa función queda usando `executeConsultorTool` directamente:

```typescript
export async function runConsultorWithTools(
  companyId: string,
  userMessage: string
): Promise<string> {
  return runAgent({
    systemPrompt: SYSTEM_PROMPT,
    userMessage: `<mensaje_usuario>${userMessage}</mensaje_usuario>`,
    tools: TOOLS,
    model: 'claude-sonnet-4-6',
    maxTokens: 2048,
    onToolCall: (name, input) => executeConsultorTool(companyId, name, input),
  })
}
```

- [ ] **Step 4: Add export to `packages/ai-agents/src/index.ts`**

Actualiza la línea de export de consultor:

```typescript
export { streamConsultor, runConsultorWithTools, executeConsultorTool } from './agents/consultor'
```

- [ ] **Step 5: Verify calcularLiquidacion signature**

Run: `Get-Content packages/validators/src/payroll.ts | Select-String "export function calcularLiquidacion" -Context 0,5`

Expected: ver firma. Si retorna campos con nombres distintos a `afpAmount` / `healthAmount` / `cesantiaAmount` / `taxAmount` / `liquido`, ajusta los nombres en `case 'sueldo_liquido'`.

- [ ] **Step 6: Rebuild**

Run: `pnpm --filter @contachile/ai-agents build`

Expected: silent success.

- [ ] **Step 7: Run tool tests**

Run: `pnpm --filter @contachile/api test -- tests/ai-context.test.ts`

Expected: TODOS los tests PASS (8 tests: 2 de snapshot + 8 de tools = ~10 totales).

- [ ] **Step 8: Commit**

```bash
git add packages/ai-agents/src/agents/consultor.ts packages/ai-agents/src/index.ts apps/api/tests/ai-context.test.ts
git commit -m "feat(ai-agents): replace consultor tools with get_monthly_summary, find_documents, calculate_tax

executeConsultorTool centraliza la ejecución scoped por companyId.
Inputs validados con Zod; errores retornados al modelo como
{error} en lugar de throw."
```

---

## Task 4: streamConsultorWithContext

**Files:**
- Modify: `packages/ai-agents/src/agents/consultor.ts`
- Modify: `packages/ai-agents/src/index.ts`

- [ ] **Step 1: Agregar `streamConsultorWithContext` al final de `consultor.ts`**

```typescript
import { buildContextSnapshot } from '../context'
import { streamAgentWithTools, type AgentEvent } from '../base-agent'

const TOOL_USAGE_GUIDE = `

## USO DE HERRAMIENTAS
- Si te preguntan por un documento puntual (folio, RUT o cliente), usa find_documents.
- Si te piden datos de un mes diferente al actual o más detalle del mes en curso, usa get_monthly_summary.
- Para cálculos sobre montos específicos (IVA, retención honorarios, líquido), usa calculate_tax.
- Para preguntas generales o si la respuesta está en el snapshot, contesta directo sin tools.`

/**
 * Consultor con contexto del tenant + tool use + streaming.
 * Inyecta un snapshot markdown del tenant en el system prompt y habilita
 * las tools de consulta. Retorna un ReadableStream de AgentEvent
 * (text deltas + indicadores de tool calls).
 */
export async function streamConsultorWithContext(
  companyId: string,
  messages: ConsultorMessage[]
): Promise<ReadableStream<AgentEvent>> {
  const snapshot = await buildContextSnapshot(companyId)
  const enrichedSystemPrompt = `${SYSTEM_PROMPT}\n\n${snapshot}${TOOL_USAGE_GUIDE}`
  const anthropicMessages = wrapUserContent(messages)

  return streamAgentWithTools({
    systemPrompt: enrichedSystemPrompt,
    messages: anthropicMessages,
    tools: TOOLS,
    onToolCall: (name, input) => executeConsultorTool(companyId, name, input),
    model: 'claude-sonnet-4-6',
    maxTokens: 2048,
    maxIterations: 5,
  })
}
```

- [ ] **Step 2: Export desde index.ts**

Actualiza la línea de export:

```typescript
export { streamConsultor, runConsultorWithTools, executeConsultorTool, streamConsultorWithContext } from './agents/consultor'
```

- [ ] **Step 3: Rebuild**

Run: `pnpm --filter @contachile/ai-agents build`

Expected: silent success.

- [ ] **Step 4: Type-check apps/api**

Run: `pnpm --filter @contachile/api exec tsc --noEmit`

Expected: silent success.

- [ ] **Step 5: Commit**

```bash
git add packages/ai-agents/src/agents/consultor.ts packages/ai-agents/src/index.ts
git commit -m "feat(ai-agents): add streamConsultorWithContext

Wrapper que combina snapshot + tools + streaming. Sustituye al chat
del consultor desde la ruta Fastify."
```

---

## Task 5: Update Fastify route to use new function

**Files:**
- Modify: `apps/api/src/routes/ai/consultor.ts`

- [ ] **Step 1: Reemplaza el body schema y la lógica del handler**

Edita `apps/api/src/routes/ai/consultor.ts`. Mantén las constantes de seguridad y `safeErrorMessage`/`auditLog`. Reemplaza el handler del POST por la nueva versión:

```typescript
import { FastifyInstance } from 'fastify'
import {
  streamConsultorWithContext,
  sanitizeMessages,
  type AgentEvent,
} from '@contachile/ai-agents'
import { z } from 'zod'

// ─── Constantes de seguridad ──────────────────────────────────────────────────

const MAX_MESSAGES = 50
const MAX_MSG_CHARS = 4000

const MessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.string().max(MAX_MSG_CHARS),
})

const ConsultorBodySchema = z.object({
  messages: z.array(MessageSchema).min(1).max(MAX_MESSAGES),
  // useTools queda como flag legacy ignorado; ahora siempre streaming-con-tools.
  useTools: z.boolean().optional(),
})

function safeErrorMessage(err: unknown): string {
  if (!(err instanceof Error)) return 'Error interno del servidor IA'
  const msg = err.message.toLowerCase()
  if (msg.includes('rate limit') || msg.includes('429')) return 'El modelo IA está ocupado. Intenta en unos segundos.'
  if (msg.includes('context length') || msg.includes('token') || msg.includes('maximum')) return 'La conversación es demasiado larga. Por favor, inicia una nueva.'
  if (msg.includes('content policy') || msg.includes('safety') || msg.includes('filtered')) return 'El mensaje no pudo ser procesado por políticas de contenido.'
  if (msg.includes('timeout') || msg.includes('timed out') || msg.includes('aborted')) return 'La consulta tardó demasiado. Por favor, intenta de nuevo.'
  if (msg.includes('network') || msg.includes('fetch') || msg.includes('connect')) return 'Error de conectividad con el proveedor IA. Intenta en unos instantes.'
  return 'El servicio IA no está disponible temporalmente.'
}

function auditLog(
  fastify: FastifyInstance,
  companyId: string,
  messageCount: number,
  totalChars: number,
  injectionDetected: boolean
) {
  fastify.log.info({
    event: 'ai_consultor_request',
    companyId,
    messageCount,
    totalChars,
    injectionDetected,
    ts: new Date().toISOString(),
  })
  if (injectionDetected) {
    fastify.log.warn({
      event: 'ai_injection_attempt',
      companyId,
      ts: new Date().toISOString(),
    })
  }
}

export default async function (fastify: FastifyInstance) {
  fastify.post('/ai/consultor', async (request, reply) => {
    let body: z.infer<typeof ConsultorBodySchema>
    try {
      body = ConsultorBodySchema.parse(request.body)
    } catch {
      return reply.code(400).send({ error: 'Formato de petición inválido' })
    }

    const companyId = request.companyId

    const { messages: sanitized, injectionDetected } = sanitizeMessages(
      body.messages.map(m => ({ role: m.role, content: m.content }))
    )

    if (sanitized.length === 0) {
      return reply.code(400).send({ error: 'No hay mensajes válidos para procesar' })
    }

    const totalChars = sanitized.reduce((sum, m) => sum + m.content.length, 0)
    auditLog(fastify, companyId, sanitized.length, totalChars, injectionDetected)

    reply.raw.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no',
    })

    if (injectionDetected) {
      reply.raw.write(`data: ${JSON.stringify({ text: 'Lo siento, no puedo procesar ese tipo de solicitud. Estoy aquí para ayudarte con consultas tributarias chilenas.' })}\n\n`)
      reply.raw.write('data: [DONE]\n\n')
      reply.raw.end()
      return
    }

    let stream: ReadableStream<AgentEvent>
    try {
      stream = await streamConsultorWithContext(companyId, sanitized)
    } catch (err) {
      fastify.log.error({ event: 'ai_stream_init_error', companyId, err })
      reply.raw.write(`data: ${JSON.stringify({ error: safeErrorMessage(err) })}\n\n`)
      reply.raw.write('data: [DONE]\n\n')
      reply.raw.end()
      return
    }

    const reader = stream.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        if (value.kind === 'text') {
          reply.raw.write(`data: ${JSON.stringify({ text: value.value })}\n\n`)
        } else if (value.kind === 'tool') {
          reply.raw.write(`data: ${JSON.stringify({ tool: value.name, status: value.status })}\n\n`)
        }
      }
    } catch (streamErr) {
      fastify.log.error({ event: 'ai_stream_error', companyId, err: streamErr })
      reply.raw.write(`data: ${JSON.stringify({ error: safeErrorMessage(streamErr) })}\n\n`)
    } finally {
      reader.releaseLock()
      reply.raw.write('data: [DONE]\n\n')
      reply.raw.end()
    }
  })
}
```

- [ ] **Step 2: Type-check the API**

Run: `pnpm --filter @contachile/api exec tsc --noEmit`

Expected: silent success.

- [ ] **Step 3: Restart Fastify dev server**

Manual: `Ctrl+C` en la terminal donde corre `pnpm --filter @contachile/api dev` y volver a ejecutar.

Verify with: `curl http://localhost:3001/health` → `{"status":"ok"}`.

- [ ] **Step 4: Smoke check with curl**

Run:

```powershell
$body = '{"messages":[{"role":"user","content":"Cuántos documentos llevo este mes?"}]}'
Invoke-WebRequest -Uri "http://localhost:3001/ai/consultor" `
  -Headers @{ 'x-company-id' = 'dev-test-company'; 'Content-Type' = 'application/json' } `
  -Method POST -Body $body -TimeoutSec 60 | Select-Object -ExpandProperty Content
```

Expected: Stream SSE con líneas `data: {"text": "..."}`, posiblemente `data: {"tool": "get_monthly_summary", "status": "running"}` seguido de `done`, y termina con `data: [DONE]`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/routes/ai/consultor.ts
git commit -m "feat(api): route /ai/consultor uses streamConsultorWithContext

Always streaming-con-tools. Emite eventos SSE de tipo {tool, status}
además de los {text} existentes. Mantiene sanitización + audit log.
useTools queda como flag legacy ignorado."
```

---

## Task 6: Update useConsultor hook to handle tool events

**Files:**
- Modify: `apps/web/hooks/use-consultor.ts`

- [ ] **Step 1: Agregar campo `toolStatus` al tipo `ChatMessage`**

Reemplaza la definición existente:

```typescript
export interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  toolStatus?: { name: string; running: boolean }
}
```

- [ ] **Step 2: Extender el parser SSE**

Localiza el bloque `try { const parsed = JSON.parse(data) ... }` dentro del while-loop (alrededor de las líneas 85-110). Reemplázalo por:

```typescript
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
```

Nota: al recibir el primer chunk de texto después de un tool call, `toolStatus` se limpia (queda undefined) para que la UI no muestre el indicador durante texto post-tool.

- [ ] **Step 3: Type-check web**

Run: `pnpm --filter web exec tsc --noEmit`

Expected: silent success.

- [ ] **Step 4: Commit**

```bash
git add apps/web/hooks/use-consultor.ts
git commit -m "feat(web): useConsultor handles tool SSE events

Adds ChatMessage.toolStatus = { name, running } seteado cuando llega
{tool, status: 'running'} y limpiado al status='done' o al primer
chunk de texto posterior."
```

---

## Task 7: Render tool indicator in ChatWidget

**Files:**
- Modify: `apps/web/components/ai/chat-widget.tsx`

- [ ] **Step 1: Agregar el mapa de labels al top del archivo**

Después de los imports, antes del componente `MessageEntry`, agregar:

```typescript
const TOOL_LABELS: Record<string, string> = {
  find_documents: 'Buscando documentos',
  get_monthly_summary: 'Resumiendo el mes',
  calculate_tax: 'Calculando impuesto',
}
```

- [ ] **Step 2: Extender los props de `MessageEntry` y renderizar el indicador**

Reemplazar la firma y body del componente `MessageEntry`:

```tsx
function MessageEntry({
  role,
  content,
  isStreaming,
  toolStatus,
}: {
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  toolStatus?: { name: string; running: boolean }
}) {
  const isUser = role === 'user'

  return (
    <div
      className={cn(
        'group relative pl-3 pr-1 py-1',
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

      {toolStatus?.running && (
        <div className="inline-flex items-center gap-2 mb-1.5 px-2 py-0.5 rounded-sm bg-secondary/40 text-[0.65rem] font-medium text-foreground/70">
          <span className="inline-flex gap-0.5">
            <span className="h-1 w-1 animate-bounce rounded-full bg-foreground/50 [animation-delay:0ms]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-foreground/50 [animation-delay:150ms]" />
            <span className="h-1 w-1 animate-bounce rounded-full bg-foreground/50 [animation-delay:300ms]" />
          </span>
          <span>{TOOL_LABELS[toolStatus.name] ?? 'Consultando datos'}…</span>
        </div>
      )}

      <div className="text-sm leading-relaxed text-foreground">
        {content ? (
          <p className="whitespace-pre-wrap break-words">{content}</p>
        ) : (
          isStreaming && !toolStatus?.running && (
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
```

- [ ] **Step 3: Pasar `toolStatus` desde el map de mensajes**

Localiza el `messages.map((msg) => <MessageEntry ...`. Agregar la prop `toolStatus={msg.toolStatus}`:

```tsx
{messages.map((msg) => (
  <MessageEntry
    key={msg.id}
    role={msg.role}
    content={msg.content}
    isStreaming={msg.isStreaming}
    toolStatus={msg.toolStatus}
  />
))}
```

- [ ] **Step 4: Type-check web**

Run: `pnpm --filter web exec tsc --noEmit`

Expected: silent success.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/ai/chat-widget.tsx
git commit -m "feat(web): chat widget renders tool indicator inline

Pill de eyebrow con dots animados encima del mensaje del consultor
cuando hay una tool en running. Labels en español según el tool."
```

---

## Task 8: Smoke E2E test

**Files:**
- Create: `apps/api/scripts/smoke-ai-consultor.ts`

- [ ] **Step 1: Crear el script**

```typescript
/**
 * Smoke E2E del Consultor IA con contexto + tool use.
 *
 * Requisitos:
 *   - apps/api corriendo (pnpm --filter @contachile/api dev)
 *   - .env de apps/api con LLM_PROVIDER=anthropic y key de Kimi
 *
 * Run:
 *   apps/api/node_modules/.bin/tsx.CMD apps/api/scripts/smoke-ai-consultor.ts
 */

import { PrismaClient } from '../../../packages/db/generated/client'

const prisma = new PrismaClient()
const COMPANY_ID = 'dev-test-company'
const API = 'http://localhost:3001'

interface SseEvent {
  text?: string
  tool?: string
  status?: string
  error?: string
}

async function postChat(messages: Array<{ role: 'user' | 'assistant'; content: string }>) {
  const res = await fetch(`${API}/ai/consultor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-company-id': COMPANY_ID },
    body: JSON.stringify({ messages }),
  })
  if (!res.ok || !res.body) throw new Error(`HTTP ${res.status}`)
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  const events: SseEvent[] = []
  let text = ''
  let buf = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buf += decoder.decode(value, { stream: true })
    const lines = buf.split('\n')
    buf = lines.pop() ?? ''
    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6).trim()
      if (payload === '[DONE]') continue
      try {
        const evt = JSON.parse(payload) as SseEvent
        events.push(evt)
        if (evt.text) text += evt.text
      } catch {}
    }
  }
  return { events, text }
}

async function seed() {
  // Asegurar Company y al menos un Document existente para el smoke
  await prisma.company.upsert({
    where: { id: COMPANY_ID },
    update: {},
    create: {
      id: COMPANY_ID,
      rut: '76.000.000-0',
      name: 'Empresa Smoke SpA',
      giro: 'Pruebas de consultor IA',
      siiCertified: false,
    },
  })

  const folio = 99001
  await prisma.document.upsert({
    where: { id: `${COMPANY_ID}-smoke-${folio}` },
    update: {},
    create: {
      id: `${COMPANY_ID}-smoke-${folio}`,
      companyId: COMPANY_ID,
      type: 33,
      folio,
      receiverRut: '77.777.777-7',
      receiverName: 'Cliente Smoke',
      totalNet: 200000,
      totalTax: 38000,
      totalAmount: 238000,
      status: 'ACCEPTED',
      emittedAt: new Date(),
      paymentMethod: 'CONTADO',
    },
  })
  return folio
}

async function testGeneral() {
  console.log('\n=== Test 1: pregunta general (sin tools esperadas) ===')
  const { events, text } = await postChat([
    { role: 'user', content: '¿Cuál es la tasa de IVA en Chile?' },
  ])
  const toolEvents = events.filter(e => e.tool)
  console.log(`  events: ${events.length}, tool events: ${toolEvents.length}`)
  console.log(`  respuesta: ${text.slice(0, 120)}...`)
  if (toolEvents.length > 0) {
    console.log('  [WARN] hubo tool calls pero la pregunta era general (no es fail)')
  }
  if (!/19/.test(text)) console.log('  [FAIL] respuesta no contiene "19"')
  else console.log('  [OK]')
}

async function testMonthlySummary() {
  console.log('\n=== Test 2: pregunta del mes (espera get_monthly_summary) ===')
  const { events, text } = await postChat([
    { role: 'user', content: '¿Cuántos DTE he emitido este mes y por cuánto?' },
  ])
  const toolEvents = events.filter(e => e.tool === 'get_monthly_summary')
  console.log(`  tool events: ${toolEvents.length}, eventos total: ${events.length}`)
  console.log(`  respuesta: ${text.slice(0, 200)}...`)
  if (toolEvents.length === 0) console.log('  [WARN] no se llamó get_monthly_summary; el snapshot pudo bastar')
  else console.log('  [OK] tool invocada')
}

async function testFindDocument(folio: number) {
  console.log(`\n=== Test 3: pregunta por folio ${folio} (espera find_documents) ===`)
  const { events, text } = await postChat([
    { role: 'user', content: `¿Qué dice la factura ${folio}?` },
  ])
  const toolEvents = events.filter(e => e.tool === 'find_documents')
  console.log(`  tool events: ${toolEvents.length}`)
  console.log(`  respuesta: ${text.slice(0, 200)}...`)
  if (toolEvents.length === 0) console.log('  [FAIL] no se llamó find_documents')
  else if (!text.includes('Cliente Smoke')) console.log('  [FAIL] respuesta no menciona al receptor')
  else console.log('  [OK]')
}

async function main() {
  const folio = await seed()
  await testGeneral()
  await testMonthlySummary()
  await testFindDocument(folio)
  await prisma.$disconnect()
}

main().catch(err => { console.error(err); process.exit(1) })
```

- [ ] **Step 2: Verify Fastify is running**

```powershell
Invoke-RestMethod -Uri "http://localhost:3001/health"
```

Expected: `{status: "ok"}`. Si no, levantarlo con `pnpm --filter @contachile/api dev`.

- [ ] **Step 3: Run the smoke**

Run: `apps/api/node_modules/.bin/tsx.CMD apps/api/scripts/smoke-ai-consultor.ts`

Expected: tres tests con `[OK]` (o `[WARN]` en test 2 si el snapshot ya alcanza para responder).

- [ ] **Step 4: Commit**

```bash
git add apps/api/scripts/smoke-ai-consultor.ts
git commit -m "test(api): add smoke E2E for AI consultor with context

Tres escenarios: pregunta general, pregunta de mes (snapshot + tool),
y búsqueda de factura por folio."
```

---

## Task 9: Manual verification in browser

- [ ] **Step 1: Asegurar ambos servers corriendo**

- Fastify: `pnpm --filter @contachile/api dev` (puerto 3001)
- Next: `pnpm --filter web dev` (puerto 3000)

- [ ] **Step 2: Abrir el FAB del chat y validar los 4 escenarios**

Abrir `http://localhost:3000`, click en el FAB inferior derecho:

| # | Mensaje | Resultado esperado |
|---|---|---|
| 1 | "Hola" | Respuesta natural saludando, sin tool indicator. |
| 2 | "¿Cuándo vence el F29 de este mes?" | Cita la fecha del snapshot (día 20). Sin tool indicator. |
| 3 | "¿Qué facturé en abril?" | Tool indicator "Resumiendo el mes…" → respuesta con datos de abril. |
| 4 | "¿Qué dice la factura 99001?" | Tool indicator "Buscando documentos…" → cita receptor y monto. |

- [ ] **Step 3: Si alguno falla, registrar en task notes y debuggear**

No commit en este step. Solo verificación. Si todo OK, pasar al siguiente.

- [ ] **Step 4: Final commit con notas en CLAUDE.md (opcional)**

Si quieres dejar un mojón:

```bash
git add CLAUDE.md  # solo si lo editaste
git commit --allow-empty -m "chore: AI consultor with context — feature complete

Plan: docs/superpowers/plans/2026-05-17-ai-consultor-context.md
Spec: docs/superpowers/specs/2026-05-17-ai-consultor-context-design.md
Manual test OK en los 4 escenarios documentados."
```

---

## Notes & Gotchas

- **Si los nombres de campo de `calcularLiquidacion` difieren** del placeholder en Task 3 Step 3 (`afpAmount`, etc.), ajustar al firmar real antes del commit. Verificación en Step 5.
- **Prisma client desde ai-agents**: el package ya usa `import { prisma } from '@contachile/db'`. No agregues `new PrismaClient()`.
- **Rebuild después de cada cambio en `packages/ai-agents/src/`**: el `apps/api` consume `dist/index.js`, no hay watch automático. Si te ves debuggeando con código viejo, recompila.
- **Restart Fastify después de cambios en `.env` o en `dist/` de packages**: tsx watch toma cambios de `apps/api/src/` pero no de paquetes workspace ni de `.env`.
- **Kimi for Coding model**: `kimi-for-coding` se pasa al SDK como `model`, pero el override `ANTHROPIC_MODEL` en `base-agent.ts` (de la sesión previa) gana sobre el `'claude-sonnet-4-6'` hardcodeado en `streamConsultorWithContext`. Funciona transparente.
- **Sanitización**: el sanitizer existente sigue corriendo antes de pasar al LLM. No remover.
- **Aborto del cliente**: el AbortController del hook ya cancela el reader; con el nuevo flujo se cancela el stream interno también. No requiere cambios.
- **Tests requieren DB up**: el `docker-compose` con Postgres debe estar corriendo para que vitest pase los tests de Task 2 y Task 3.
