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
