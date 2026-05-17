import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { PrismaClient } from '@contachile/db'
import { buildContextSnapshot, executeConsultorTool } from '@contachile/ai-agents'

const prisma = new PrismaClient()
const COMPANY_ID = 'test-ai-context-company'

beforeAll(async () => {
  // Clean
  await prisma.documentItem.deleteMany({ where: { document: { companyId: COMPANY_ID } } })
  await prisma.document.deleteMany({ where: { companyId: COMPANY_ID } })
  await prisma.purchase.deleteMany({ where: { companyId: COMPANY_ID } })
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
  await prisma.purchase.deleteMany({ where: { companyId: COMPANY_ID } })
  await prisma.employee.deleteMany({ where: { companyId: COMPANY_ID } })
  await prisma.company.deleteMany({ where: { id: COMPANY_ID } })
  await prisma.$disconnect()
})

describe('buildContextSnapshot', () => {
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

describe('executeConsultorTool', () => {
  // Reusa seed de buildContextSnapshot describe (mismo COMPANY_ID + datos)

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
