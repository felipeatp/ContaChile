export function calcularIVA(neto: number): number {
  return Math.floor(neto * 0.19)
}

export function calcularTotal(neto: number): number {
  return neto + calcularIVA(neto)
}
