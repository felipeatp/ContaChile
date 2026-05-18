/**
 * Formato monetario chileno (CLP). No usa decimales, separador de miles es punto.
 * Ej: 1847293 -> "$ 1.847.293". Negativos: "-$ 119.000".
 */
export function formatCLP(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '$ 0'
  }
  const rounded = Math.round(value)
  const abs = Math.abs(rounded)
  const formatted = abs.toLocaleString('es-CL', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
  return rounded < 0 ? `-$ ${formatted}` : `$ ${formatted}`
}

/**
 * Parsea un string monetario chileno a número entero.
 * Acepta "$ 1.847.293", "$1.000.000", "1000000", "  -$ 50.000  ".
 * Devuelve 0 para strings vacíos o no parseables.
 */
export function parseCLP(value: string | null | undefined): number {
  if (!value) return 0
  const trimmed = value.trim()
  if (!trimmed) return 0
  const isNegative = trimmed.startsWith('-')
  const digits = trimmed.replace(/[^0-9]/g, '')
  if (!digits) return 0
  const n = parseInt(digits, 10)
  return isNegative ? -n : n
}

/**
 * Formatea un ratio (0..1) como porcentaje chileno con coma decimal.
 * Ej: 0.123 -> "12,3 %".
 */
export function formatPercent(
  ratio: number | null | undefined,
  digits = 1
): string {
  if (ratio === null || ratio === undefined || !Number.isFinite(ratio)) {
    return '0,0 %'
  }
  const formatted = (ratio * 100).toLocaleString('es-CL', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  return `${formatted} %`
}
