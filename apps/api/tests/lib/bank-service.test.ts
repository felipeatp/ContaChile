import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@contachile/db', () => ({
  prisma: {
    bankMovement: { findFirst: vi.fn(), update: vi.fn() },
    document: { findMany: vi.fn() },
    purchase: { findMany: vi.fn() },
  },
}))

// bank-service también importa fintoc-client; lo mockeamos para que el import no falle
vi.mock('@contachile/fintoc-client', () => ({
  FintocClient: vi.fn().mockImplementation(() => ({
    listAccounts: vi.fn(),
    listMovements: vi.fn(),
  })),
}))

import { prisma } from '@contachile/db'
import { findAndApplyMatch } from '../../src/lib/bank-service'

const mockMovement = prisma.bankMovement.findFirst as ReturnType<typeof vi.fn>
const mockMovementUpdate = prisma.bankMovement.update as ReturnType<typeof vi.fn>
const mockDocuments = prisma.document.findMany as ReturnType<typeof vi.fn>
const mockPurchases = prisma.purchase.findMany as ReturnType<typeof vi.fn>

const COMPANY = 'company-bank'
const MOVEMENT_ID = 'mov-1'

function makeMovement(overrides: Partial<{
  id: string
  companyId: string
  status: string
  type: string
  amount: number
  counterpartRut: string | null
  postedAt: Date
}> = {}) {
  return {
    id: MOVEMENT_ID,
    companyId: COMPANY,
    status: 'PENDING',
    type: 'CREDIT',
    amount: 1_190_000,
    counterpartRut: '12345678-5',
    postedAt: new Date('2026-03-15'),
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockMovementUpdate.mockResolvedValue({ id: MOVEMENT_ID, status: 'MATCHED_DTE' })
  mockDocuments.mockResolvedValue([])
  mockPurchases.mockResolvedValue([])
})

describe('findAndApplyMatch', () => {
  it('CREDIT con RUT y monto exacto → MATCHED_DTE', async () => {
    mockMovement.mockResolvedValue(makeMovement({ type: 'CREDIT', amount: 1_190_000 }))
    mockDocuments.mockResolvedValue([
      { id: 'doc-1', totalAmount: 1_190_000, receiverRut: '12345678-5', emittedAt: new Date('2026-03-14') },
    ])

    const result = await findAndApplyMatch(MOVEMENT_ID, COMPANY)

    expect(result.matched).toBe(true)
    expect(result.type).toBe('DTE')
    expect(result.documentId).toBe('doc-1')
    expect(mockMovementUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'MATCHED_DTE', matchedDocumentId: 'doc-1' }),
      })
    )
  })

  it('diferencia de 1 CLP impide el match — la query de DB no encuentra el DTE', async () => {
    // El DTE tiene totalAmount=1_189_999 pero el movimiento es 1_190_000
    // La query de DB filtra por totalAmount=movement.amount → retorna vacío → no match
    mockMovement.mockResolvedValue(makeMovement({ amount: 1_190_000 }))
    mockDocuments.mockResolvedValue([]) // simula que DB no encontró DTE con ese monto exacto

    const result = await findAndApplyMatch(MOVEMENT_ID, COMPANY)

    expect(result.matched).toBe(false)
    expect(mockMovementUpdate).not.toHaveBeenCalled()
  })

  it('DEBIT con compra exacta → MATCHED_PURCHASE', async () => {
    mockMovement.mockResolvedValue(
      makeMovement({ type: 'DEBIT', amount: 595_000, counterpartRut: '76000001-5' })
    )
    mockPurchases.mockResolvedValue([
      { id: 'pur-1', totalAmount: 595_000, issuerRut: '76000001-5', date: new Date('2026-03-14') },
    ])

    const result = await findAndApplyMatch(MOVEMENT_ID, COMPANY)

    expect(result.matched).toBe(true)
    expect(result.type).toBe('PURCHASE')
    expect(result.purchaseId).toBe('pur-1')
  })

  it('movimiento ya RECONCILED → matched:false sin update', async () => {
    mockMovement.mockResolvedValue(makeMovement({ status: 'RECONCILED' }))

    const result = await findAndApplyMatch(MOVEMENT_ID, COMPANY)

    expect(result.matched).toBe(false)
    expect(result.reason).toContain('RECONCILED')
    expect(mockMovementUpdate).not.toHaveBeenCalled()
  })

  it('múltiples DTEs candidatos → matched:false con lista de candidates', async () => {
    mockMovement.mockResolvedValue(makeMovement({ amount: 1_000_000 }))
    mockDocuments.mockResolvedValue([
      { id: 'doc-1', totalAmount: 1_000_000, receiverRut: '12345678-5' },
      { id: 'doc-2', totalAmount: 1_000_000, receiverRut: '12345678-5' },
    ])

    const result = await findAndApplyMatch(MOVEMENT_ID, COMPANY) as any

    expect(result.matched).toBe(false)
    expect(result.candidates).toHaveLength(2)
    expect(result.candidates).toContain('doc-1')
    expect(mockMovementUpdate).not.toHaveBeenCalled()
  })

  it('sin counterpartRut → matched:false sin consultas a DB', async () => {
    mockMovement.mockResolvedValue(makeMovement({ counterpartRut: null }))

    const result = await findAndApplyMatch(MOVEMENT_ID, COMPANY)

    expect(result.matched).toBe(false)
    expect(mockDocuments).not.toHaveBeenCalled()
    expect(mockPurchases).not.toHaveBeenCalled()
  })

  it('lanza error si movimiento no existe', async () => {
    mockMovement.mockResolvedValue(null)

    await expect(findAndApplyMatch(MOVEMENT_ID, COMPANY)).rejects.toThrow('Movimiento no encontrado')
  })
})
