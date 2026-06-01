import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@contachile/db', () => ({
  prisma: {
    document: {
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
    purchase: {
      aggregate: vi.fn(),
    },
  },
}))

vi.mock('@contachile/validators', () => ({
  calcularImpuestoRenta: vi.fn((renta: number) => Math.floor(renta * 0.04)),
}))

vi.mock('../../src/base-agent', () => ({
  streamAgentWithTools: vi.fn(),
}))

import { prisma } from '@contachile/db'
import { calcularImpuestoRenta } from '@contachile/validators'
import { streamAgentWithTools } from '../../src/base-agent'
import { streamF22Assistant } from '../../src/agents/f22-assistant'

const mockPrisma = prisma as any
const mockCalc = vi.mocked(calcularImpuestoRenta)
const mockBaseAgent = vi.mocked(streamAgentWithTools)

async function* captureToolCalls({ executeToolCall }: any) {
  yield { type: 'tool_start', toolName: 'get_f22_data' }
  const result = await executeToolCall('get_f22_data', { year: 2025 })
  yield { type: 'tool_result', toolName: 'get_f22_data', result }
  yield { type: 'text_delta', text: 'Análisis listo.' }
  yield { type: 'done', fullText: 'Análisis listo.' }
}

describe('streamF22Assistant', () => {
  beforeEach(() => {
    mockPrisma.document.aggregate.mockReset()
    mockPrisma.purchase.aggregate.mockReset()
    mockPrisma.document.findMany.mockReset()
    mockBaseAgent.mockReset()
  })

  it('pasa el año y mensaje correcto a streamAgentWithTools', async () => {
    mockBaseAgent.mockImplementation(async function* () {
      yield { type: 'done', fullText: 'ok' }
    })

    const gen = streamF22Assistant('company-1', '¿Tengo devolución?', 2025)
    await gen.next()

    expect(mockBaseAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        model: 'claude-sonnet-4-6',
        tools: expect.arrayContaining([
          expect.objectContaining({ name: 'get_f22_data' }),
          expect.objectContaining({ name: 'get_monthly_breakdown' }),
        ]),
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('2025'),
          }),
        ]),
      })
    )
  })

  it('get_f22_data: calcula saldo a pagar cuando impuesto > PPM', async () => {
    // Ingresos 50M → PPM estimado 250.000. Impuesto mock (4%) = 2.000.000
    mockPrisma.document.aggregate.mockResolvedValue({ _sum: { totalAmount: 50_000_000 } })
    mockPrisma.purchase.aggregate
      .mockResolvedValueOnce({ _sum: { totalAmount: 5_000_000 } })
      .mockResolvedValueOnce({ _sum: { totalAmount: 5_000_000 } })
    mockCalc.mockReturnValue(2_000_000)
    mockBaseAgent.mockImplementation(captureToolCalls)

    const events: object[] = []
    for await (const e of streamF22Assistant('company-1', 'Analiza', 2025)) {
      events.push(e)
    }

    const toolResultEvent = events.find((e: any) => e.type === 'tool_result') as any
    const result = JSON.parse(toolResultEvent.result)

    expect(result.saldoPagar).toBeGreaterThan(0)
    expect(result.saldoDevolver).toBe(0)
    expect(result.impuestoDeterminado).toBe(2_000_000)
  })

  it('get_f22_data: calcula saldo a devolver cuando PPM > impuesto', async () => {
    // Ingresos altisimos → PPM grande. Renta liquida pequeña → impuesto 0
    mockPrisma.document.aggregate.mockResolvedValue({ _sum: { totalAmount: 1_000_000_000 } })
    mockPrisma.purchase.aggregate
      .mockResolvedValueOnce({ _sum: { totalAmount: 990_000_000 } })
      .mockResolvedValueOnce({ _sum: { totalAmount: 9_000_000 } })
    mockCalc.mockReturnValue(0)
    mockBaseAgent.mockImplementation(captureToolCalls)

    const events: object[] = []
    for await (const e of streamF22Assistant('company-1', 'Analiza', 2025)) {
      events.push(e)
    }

    const toolResultEvent = events.find((e: any) => e.type === 'tool_result') as any
    const result = JSON.parse(toolResultEvent.result)

    expect(result.saldoDevolver).toBeGreaterThan(0)
    expect(result.saldoPagar).toBe(0)
  })

  it('get_monthly_breakdown: retorna 12 meses con nombre e ingresos', async () => {
    mockPrisma.document.findMany.mockResolvedValue([{ totalAmount: 1_000_000 }])

    let capturedExecuteTool: any
    mockBaseAgent.mockImplementation(async function* ({ executeToolCall }: any) {
      capturedExecuteTool = executeToolCall
      yield { type: 'done', fullText: 'ok' }
    })

    const gen = streamF22Assistant('company-1', 'Analiza', 2025)
    for await (const _ of gen) { /* consume */ }

    const raw = await capturedExecuteTool('get_monthly_breakdown', { year: 2025 })
    const result = JSON.parse(raw)

    expect(result.meses).toHaveLength(12)
    expect(result.meses[0]).toHaveProperty('mes')
    expect(result.meses[0]).toHaveProperty('ingresos')
    expect(result.meses[0]).toHaveProperty('ppmEstimado')
  })

  it('herramienta desconocida retorna error JSON', async () => {
    let capturedExecuteTool: any
    mockBaseAgent.mockImplementation(async function* ({ executeToolCall }: any) {
      capturedExecuteTool = executeToolCall
      yield { type: 'done', fullText: 'ok' }
    })

    const gen = streamF22Assistant('company-1', 'Analiza', 2025)
    for await (const _ of gen) { /* consume */ }

    const raw = await capturedExecuteTool('herramienta_inexistente', {})
    const result = JSON.parse(raw)

    expect(result.error).toContain('herramienta_inexistente')
  })
})
