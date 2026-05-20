import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the base-agent module before importing the OCR agent
vi.mock('../../src/base-agent', () => ({
  runAgent: vi.fn(),
}))

import { runAgent } from '../../src/base-agent'
import { procesarDocumentoOCR } from '../../src/agents/ocr'

const mockedRunAgent = vi.mocked(runAgent)

describe('procesarDocumentoOCR', () => {
  beforeEach(() => {
    mockedRunAgent.mockReset()
  })

  it('parses a valid JSON response from Claude', async () => {
    mockedRunAgent.mockResolvedValueOnce(
      JSON.stringify({
        tipo: 'factura',
        numero: '12345',
        fecha: '15/05/2026',
        rutEmisor: '76.123.456-7',
        nombreEmisor: 'Empresa Test SpA',
        montoNeto: 100000,
        iva: 19000,
        montoTotal: 119000,
        descripcion: 'Servicios de consultoría',
        confianza: 0.95,
      })
    )

    const result = await procesarDocumentoOCR('fakebase64', 'image/jpeg')

    expect(result.tipo).toBe('factura')
    expect(result.numero).toBe('12345')
    expect(result.fecha).toBe('15/05/2026')
    expect(result.rutEmisor).toBe('76.123.456-7')
    expect(result.nombreEmisor).toBe('Empresa Test SpA')
    expect(result.montoNeto).toBe(100000)
    expect(result.iva).toBe(19000)
    expect(result.montoTotal).toBe(119000)
    expect(result.descripcion).toBe('Servicios de consultoría')
    expect(result.confianza).toBe(0.95)
  })

  it('handles snake_case aliases in the response', async () => {
    mockedRunAgent.mockResolvedValueOnce(
      JSON.stringify({
        tipo: 'boleta',
        numero: '999',
        fecha: '01/01/2026',
        rutEmisor: '11.111.111-1',
        nombreEmisor: 'Persona Natural',
        monto_neto: 50000,
        iva: 0,
        monto_total: 50000,
        descripcion: null,
        confianza: 0.88,
      })
    )

    const result = await procesarDocumentoOCR('fakebase64')

    expect(result.tipo).toBe('boleta')
    expect(result.montoNeto).toBe(50000)
    expect(result.montoTotal).toBe(50000)
    expect(result.descripcion).toBeNull()
    expect(result.confianza).toBe(0.88)
  })

  it('returns unknown with zero confidence on invalid JSON', async () => {
    mockedRunAgent.mockResolvedValueOnce('this is not json at all')

    const result = await procesarDocumentoOCR('fakebase64')

    expect(result.tipo).toBe('desconocido')
    expect(result.confianza).toBe(0)
    expect(result.numero).toBeNull()
  })

  it('returns unknown when Claude throws an error', async () => {
    mockedRunAgent.mockRejectedValueOnce(new Error('Anthropic API error'))

    const result = await procesarDocumentoOCR('fakebase64')

    expect(result.tipo).toBe('desconocido')
    expect(result.confianza).toBe(0)
  })

  it('uses default mimeType image/jpeg when not provided', async () => {
    mockedRunAgent.mockResolvedValueOnce('{}')

    await procesarDocumentoOCR('fakebase64')

    expect(mockedRunAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage: expect.arrayContaining([
          expect.objectContaining({
            type: 'image',
            source: expect.objectContaining({
              media_type: 'image/jpeg',
            }),
          }),
        ]),
      })
    )
  })

  it('passes provided mimeType to the agent', async () => {
    mockedRunAgent.mockResolvedValueOnce('{}')

    await procesarDocumentoOCR('fakebase64', 'image/png')

    expect(mockedRunAgent).toHaveBeenCalledWith(
      expect.objectContaining({
        userMessage: expect.arrayContaining([
          expect.objectContaining({
            type: 'image',
            source: expect.objectContaining({
              media_type: 'image/png',
            }),
          }),
        ]),
      })
    )
  })
})
