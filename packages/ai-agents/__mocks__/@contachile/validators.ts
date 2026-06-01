// Stub for @contachile/validators — replaced by vi.mock() in tests.
// This file only needs to exist so that Vitest/Vite can resolve the alias.
export const calcularIVA = (n: number) => Math.floor(n * 0.19)
export const calcularRetencionHonorarios = (n: number) => ({
  gross: n,
  retention: Math.floor(n * 0.1375),
  net: n - Math.floor(n * 0.1375),
  rate: 0.1375,
})
export const calcularLiquidacion = () => ({
  bruto: 0, afp: 0, salud: 0, cesantia: 0,
  baseImponible: 0, impuesto: 0, liquido: 0,
})
export const calcularImpuestoRenta = () => 0
