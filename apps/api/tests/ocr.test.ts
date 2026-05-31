import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import tenantPlugin from '../src/plugins/tenant'
import ocrRoute from '../src/routes/ocr'

vi.mock('@contachile/db', () => ({
  prisma: {
    companyMembership: {
      findMany: vi.fn().mockResolvedValue([{ companyId: 'test-company', role: 'owner' }]),
      create: vi.fn(),
    },
    company: {
      upsert: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
    ocrDocument: {
      create: vi.fn(),
      update: vi.fn(),
    },
    purchase: {
      create: vi.fn(),
    },
  },
}))

vi.mock('@contachile/ai-agents', () => ({
  procesarDocumentoOCR: vi.fn(),
  validateOCRExtraction: vi.fn().mockReturnValue([]),  // sin errores de validación por defecto
}))

vi.mock('@contachile/auth', () => ({
  auth: {
    api: {
      getSession: vi.fn(),
    },
  },
}))

import { prisma } from '@contachile/db'
import { procesarDocumentoOCR } from '@contachile/ai-agents'
import { auth } from '@contachile/auth'

const mockPrisma = prisma as any
const mockOCR = vi.mocked(procesarDocumentoOCR)
const mockSession = auth.api.getSession as any

describe('POST /ocr/document', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSession.mockResolvedValue({
      user: { id: 'user-1', email: 'test@test.com', name: 'Test' },
    })
  })

  it('creates OCR document and purchase on success', async () => {
    mockPrisma.ocrDocument.create.mockResolvedValue({ id: 'ocr-1' })
    mockOCR.mockResolvedValue({
      tipo: 'factura',
      numero: '123',
      fecha: '15/05/2024',  // fecha pasada válida (no futura, no > 10 años)
      rutEmisor: '76.354.771-K',  // RUT válido (pasa módulo 11)
      nombreEmisor: 'Test SpA',
      montoNeto: 100000,
      iva: 19000,
      montoTotal: 119000,  // 100000 + 19000 = 119000 ✓
      descripcion: 'Servicios',
      confianza: 0.95,
    })
    mockPrisma.purchase.create.mockResolvedValue({
      id: 'purchase-1',
      type: 33,
      folio: 123,
      date: new Date('2026-05-15'),
      issuerName: 'Test SpA',
      totalAmount: 119000,
      status: 'PENDING_APPROVAL',
    })

    const app = Fastify()
    app.register(tenantPlugin)
    app.register(ocrRoute)

    const response = await app.inject({
      method: 'POST',
      url: '/ocr/document',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ imageBase64: 'fakebase64', mimeType: 'image/jpeg' }),
    })

    expect(response.statusCode).toBe(200)
    const body = JSON.parse(response.body)
    expect(body.ocr.tipo).toBe('factura')
    expect(body.purchase.id).toBe('purchase-1')
    expect(mockPrisma.ocrDocument.create).toHaveBeenCalled()
    expect(mockPrisma.ocrDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'PROCESSED' }),
      })
    )
  })

  it('returns 422 when OCR confidence is too low', async () => {
    mockPrisma.ocrDocument.create.mockResolvedValue({ id: 'ocr-1' })
    mockOCR.mockResolvedValue({
      tipo: 'desconocido',
      numero: null,
      fecha: null,
      rutEmisor: null,
      nombreEmisor: null,
      montoNeto: null,
      iva: null,
      montoTotal: null,
      descripcion: null,
      confianza: 0.1,
    })

    const app = Fastify()
    app.register(tenantPlugin)
    app.register(ocrRoute)

    const response = await app.inject({
      method: 'POST',
      url: '/ocr/document',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ imageBase64: 'fakebase64' }),
    })

    expect(response.statusCode).toBe(422)
    const body = JSON.parse(response.body)
    expect(body.error).toContain('No se pudo identificar')
    expect(mockPrisma.ocrDocument.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'ERROR' }),
      })
    )
  })

  it('returns 400 when imageBase64 is missing', async () => {
    const app = Fastify()
    app.register(tenantPlugin)
    app.register(ocrRoute)

    const response = await app.inject({
      method: 'POST',
      url: '/ocr/document',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({}),
    })

    expect(response.statusCode).toBe(400)
  })
})
