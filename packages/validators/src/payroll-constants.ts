export type AfpCode =
  | 'CAPITAL'
  | 'CUPRUM'
  | 'HABITAT'
  | 'MODELO'
  | 'PLANVITAL'
  | 'PROVIDA'
  | 'UNO'

export type HealthPlan = 'FONASA' | 'ISAPRE'

export type ContractType = 'INDEFINIDO' | 'PLAZO_FIJO' | 'HONORARIOS'

// Tasas cotización AFP (referencia 2026 — incluyen SIS). Revisar anualmente con SP.
export const AFP_RATES: Record<AfpCode, number> = {
  CAPITAL: 0.1144,
  CUPRUM: 0.1144,
  HABITAT: 0.1127,
  MODELO: 0.1058,
  PLANVITAL: 0.1154,
  PROVIDA: 0.1145,
  UNO: 0.1069,
}

// 7% legal obligatorio en FONASA. En isapre puede ser mayor (plan pactado).
export const SALUD_FONASA_RATE = 0.07

// Seguro de cesantía: solo contrato indefinido descuenta al empleado
export const SEGURO_CESANTIA_EMPLEADO = 0.006
export const SEGURO_CESANTIA_EMPLEADOR = 0.024

// UTM mensual (CLP) — valor referencia 2026. Configurable via env UTM_VALUE.
export const UTM_DEFAULT = 67000

// Tabla de impuesto único mensual (segunda categoría)
// Cada bracket: `upTo` = límite superior en UTM; `rate` = tasa marginal;
// `deduction` = rebaja en UTM para que tax(en UTM) = base*rate - deduction
export interface TaxBracket {
  upTo: number
  rate: number
  deduction: number
}

export const TAX_BRACKETS: TaxBracket[] = [
  { upTo: 13.5, rate: 0, deduction: 0 },
  { upTo: 30, rate: 0.04, deduction: 0.54 },
  { upTo: 50, rate: 0.08, deduction: 1.74 },
  { upTo: 70, rate: 0.135, deduction: 4.49 },
  { upTo: 90, rate: 0.23, deduction: 11.14 },
  { upTo: 120, rate: 0.304, deduction: 17.8 },
  { upTo: 150, rate: 0.35, deduction: 23.32 },
  { upTo: Infinity, rate: 0.4, deduction: 30.82 },
]
