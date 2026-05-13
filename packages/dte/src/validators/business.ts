import { validateRUT } from '@contachile/validators'
import { DocumentData, ValidationResult } from '../types'

export function validateBusinessRules(data: DocumentData): ValidationResult {
  const errors: string[] = []

  if (!validateRUT(data.company.rut)) {
    errors.push('RUT emisor inválido')
  }

  if (!validateRUT(data.receiver.rut)) {
    errors.push('RUT receptor inválido')
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const emitted = new Date(data.emittedAt)

  if (emitted > today) {
    errors.push('Fecha de emisión no puede ser futura')
  }

  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  if (emitted < thirtyDaysAgo) {
    errors.push('Fecha de emisión no puede ser mayor a 30 días pasada')
  }

  return { valid: errors.length === 0, errors }
}
