import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@contachile/db', () => ({
  prisma: {
    employee: { findMany: vi.fn() },
    payroll: { findUnique: vi.fn(), create: vi.fn() },
  },
}))

vi.mock('@contachile/validators', () => ({
  calcularLiquidacion: vi.fn().mockReturnValue({
    bruto: 1_000_000,
    horasExtras: 0,
    bonos: 0,
    afp: 112_700,
    salud: 70_000,
    cesantia: 6_000,
    baseImponible: 811_300,
    impuesto: 0,
    otrosDesc: 0,
    liquido: 811_300,
  }),
}))

import { prisma } from '@contachile/db'
import { calcularLiquidacion } from '@contachile/validators'
import { generatePayrollForMonth } from '../../src/lib/payroll-service'

const mockEmployees = prisma.employee.findMany as ReturnType<typeof vi.fn>
const mockPayrollUnique = prisma.payroll.findUnique as ReturnType<typeof vi.fn>
const mockPayrollCreate = prisma.payroll.create as ReturnType<typeof vi.fn>
const mockCalc = vi.mocked(calcularLiquidacion)

const COMPANY = 'company-payroll'

function makeEmployee(overrides: Partial<{
  id: string
  contractType: string
  baseSalary: number
  afp: string
  healthPlan: string
  healthAmount: null | number
  isActive: boolean
}> = {}) {
  return {
    id: 'emp-1',
    contractType: 'INDEFINIDO',
    baseSalary: 1_000_000,
    afp: 'HABITAT',
    healthPlan: 'FONASA',
    healthAmount: null,
    isActive: true,
    ...overrides,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
  mockPayrollCreate.mockResolvedValue({ id: 'pay-new' })
  mockPayrollUnique.mockResolvedValue(null) // no existing by default
})

describe('generatePayrollForMonth', () => {
  it('genera liquidación para cada empleado activo no-HONORARIOS', async () => {
    mockEmployees.mockResolvedValue([
      makeEmployee({ id: 'emp-1' }),
      makeEmployee({ id: 'emp-2' }),
    ])

    const result = await generatePayrollForMonth(COMPANY, 2026, 5)

    expect(result.generated).toBe(2)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)
    expect(mockPayrollCreate).toHaveBeenCalledTimes(2)
  })

  it('salta empleado si ya existe liquidación para ese período', async () => {
    mockEmployees.mockResolvedValue([
      makeEmployee({ id: 'emp-1' }),
      makeEmployee({ id: 'emp-2' }),
    ])
    // Primer empleado ya tiene liquidación
    mockPayrollUnique
      .mockResolvedValueOnce({ id: 'existing' })
      .mockResolvedValueOnce(null)

    const result = await generatePayrollForMonth(COMPANY, 2026, 5)

    expect(result.generated).toBe(1)
    expect(result.skipped).toBe(1)
    expect(mockPayrollCreate).toHaveBeenCalledTimes(1)
  })

  it('no genera liquidación para empleados HONORARIOS', async () => {
    // La query de findMany ya filtra contractType != HONORARIOS — aquí lo verificamos
    mockEmployees.mockResolvedValue([
      makeEmployee({ contractType: 'INDEFINIDO' }),
    ])

    await generatePayrollForMonth(COMPANY, 2026, 5)

    // Verificar que findMany se llamó con contractType != HONORARIOS
    expect(mockEmployees).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          contractType: { not: 'HONORARIOS' },
        }),
      })
    )
  })

  it('registra error y continúa si payroll.create lanza excepción', async () => {
    mockEmployees.mockResolvedValue([
      makeEmployee({ id: 'emp-ok' }),
      makeEmployee({ id: 'emp-fail' }),
    ])
    mockPayrollCreate.mockImplementation(({ data }: { data: { employeeId: string } }) => {
      if (data.employeeId === 'emp-fail') return Promise.reject(new Error('DB constraint'))
      return Promise.resolve({ id: 'pay-1' })
    })

    const result = await generatePayrollForMonth(COMPANY, 2026, 5)

    expect(result.generated).toBe(1)
    expect(result.errors).toHaveLength(1)
    expect(result.errors[0].employeeId).toBe('emp-fail')
    expect(result.errors[0].reason).toBe('DB constraint')
  })

  it('retorna { generated:0, skipped:0, errors:[] } cuando no hay empleados', async () => {
    mockEmployees.mockResolvedValue([])

    const result = await generatePayrollForMonth(COMPANY, 2026, 5)

    expect(result.generated).toBe(0)
    expect(result.skipped).toBe(0)
    expect(result.errors).toHaveLength(0)
  })

  it('pasa utmValue a calcularLiquidacion cuando se provee', async () => {
    mockEmployees.mockResolvedValue([makeEmployee()])

    await generatePayrollForMonth(COMPANY, 2026, 5, 68_000)

    expect(mockCalc).toHaveBeenCalledWith(
      expect.objectContaining({ utmValue: 68_000 })
    )
  })
})
