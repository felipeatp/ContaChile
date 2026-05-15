import { SEGURO_CESANTIA_EMPLEADOR, type AfpCode, type HealthPlan } from '@contachile/validators'

interface PrevRedRow {
  payroll: {
    bruto: number
    afp: number
    salud: number
    cesantia: number
  }
  employee: {
    rut: string
    name: string
    afp: AfpCode
    healthPlan: HealthPlan
  }
}

function splitRut(rut: string): { numero: string; dv: string } {
  const clean = rut.replace(/[^0-9kK-]/g, '').toUpperCase()
  const parts = clean.split('-')
  if (parts.length === 2) return { numero: parts[0], dv: parts[1] }
  if (clean.length > 1) return { numero: clean.slice(0, -1), dv: clean.slice(-1) }
  return { numero: clean, dv: '' }
}

function splitName(fullName: string): { nombres: string; apPaterno: string; apMaterno: string } {
  const parts = fullName.trim().split(/\s+/)
  if (parts.length >= 3) {
    return {
      nombres: parts.slice(0, parts.length - 2).join(' '),
      apPaterno: parts[parts.length - 2],
      apMaterno: parts[parts.length - 1],
    }
  }
  if (parts.length === 2) return { nombres: parts[0], apPaterno: parts[1], apMaterno: '' }
  return { nombres: fullName, apPaterno: '', apMaterno: '' }
}

const PREVIRED_HEADER = [
  'rut',
  'dv',
  'nombres',
  'apellidoPaterno',
  'apellidoMaterno',
  'rutEmpresa',
  'periodo',
  'sueldoBase',
  'afp',
  'cotizacionAfp',
  'salud',
  'cotizacionSalud',
  'cesantiaEmpleado',
  'cesantiaEmpleador',
].join(';')

export function generatePreviRedFile(
  companyRut: string,
  year: number,
  month: number,
  rows: PrevRedRow[]
): string {
  const periodo = `${year}${String(month).padStart(2, '0')}`
  const lines: string[] = [PREVIRED_HEADER]

  for (const r of rows) {
    const rut = splitRut(r.employee.rut)
    const name = splitName(r.employee.name)
    const cotizEmpleador = Math.round(r.payroll.bruto * SEGURO_CESANTIA_EMPLEADOR)
    lines.push(
      [
        rut.numero,
        rut.dv,
        name.nombres,
        name.apPaterno,
        name.apMaterno,
        companyRut,
        periodo,
        r.payroll.bruto,
        r.employee.afp,
        r.payroll.afp,
        r.employee.healthPlan,
        r.payroll.salud,
        r.payroll.cesantia,
        cotizEmpleador,
      ].join(';')
    )
  }

  return lines.join('\n')
}

interface Ddjj1887Row {
  rut: string
  name: string
  totalAnual: number
  retenciones: number
}

export function generateDdjj1887File(year: number, rows: Ddjj1887Row[]): string {
  const header = ['rut', 'nombre', 'ano', 'totalAnual', 'retenciones'].join(';')
  const lines: string[] = [header]
  for (const r of rows) {
    lines.push([r.rut, r.name, year, r.totalAnual, r.retenciones].join(';'))
  }
  return lines.join('\n')
}
