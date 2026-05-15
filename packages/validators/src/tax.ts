export function calcularIVA(neto: number): number {
  return Math.floor(neto * 0.19)
}

export function calcularTotal(neto: number): number {
  return neto + calcularIVA(neto)
}

/**
 * Calcula el impuesto a la renta segun tabla progresiva chilena.
 * UTA = Unidad Tributaria Anual (default: 720_000 CLP)
 *
 * Renta Liquida Bracket | Tasa
 * Hasta 15 UTA          | 0%
 * 15 UTA - 30 UTA       | 4%
 * 30 UTA - 50 UTA       | 8%
 * 50 UTA - 120 UTA      | 13.5%
 * Mas de 120 UTA        | 27%
 */
export function calcularImpuestoRenta(rentaLiquida: number): number {
  if (rentaLiquida <= 0) return 0

  const UTA = 720_000
  const brackets = [
    { limit: 15 * UTA, rate: 0 },
    { limit: 30 * UTA, rate: 0.04 },
    { limit: 50 * UTA, rate: 0.08 },
    { limit: 120 * UTA, rate: 0.135 },
    { limit: Infinity, rate: 0.27 },
  ]

  let tax = 0
  let remaining = rentaLiquida
  let previousLimit = 0

  for (const bracket of brackets) {
    if (remaining <= 0) break
    const bracketAmount = Math.min(remaining, bracket.limit - previousLimit)
    tax += Math.floor(bracketAmount * bracket.rate)
    remaining -= bracketAmount
    previousLimit = bracket.limit
  }

  return tax
}
