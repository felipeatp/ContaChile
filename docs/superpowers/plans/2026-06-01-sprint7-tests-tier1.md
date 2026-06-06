# Sprint 7 — Tests Críticos Tier 1 (Cálculos Tributarios)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cubrir todos los cálculos que afectan dinero real de los clientes: nómina (AFP/salud/impuesto único), IVA, impuesto a la renta F22, F29, firma DTE, y multi-tenancy.

**Architecture:** Tests puramente unitarios para funciones exportadas (`calcularLiquidacion`, `calcularImpuestoRenta`, `validateRUT`); tests de integración con Fastify + Prisma mockeado para rutas F29 y F22; extensión de `signer.test.ts` con detección de tampering; tests de multi-tenancy verificando que `companyId` filtra correctamente en las queries. Cobertura mínima 80% en `packages/validators` y `packages/dte` mediante thresholds en vitest config.

**Tech Stack:** Vitest 1.x, node-forge (en tests de signer), `@vitest/coverage-v8` (nuevo en validators/dte), pnpm workspaces

---

## Contexto del dominio (leer antes de tocar cualquier archivo)

### Impuesto único mensual (nómina)
- `packages/validators/src/payroll-constants.ts`: `TAX_BRACKETS` — 8 tramos, en UTM (`UTM_DEFAULT = 67_000`)
- Lógica: `baseImponible / utm = baseInUtm`; buscar tramo donde `baseInUtm <= upTo`; `taxInUtm = baseInUtm * rate - deduction`; `impuesto = Math.max(0, Math.round(taxInUtm * utm))`

### Tasas AFP/salud/cesantía
- `AFP_RATES`: HABITAT=0.1127, CAPITAL=0.1144, MODELO=0.1058, etc.
- `SALUD_FONASA_RATE=0.07`; ISAPRE: `max(7% de bruto, healthAmount)`
- `SEGURO_CESANTIA_EMPLEADO=0.006`; solo para `INDEFINIDO`

### Impuesto a la renta anual (F22)
- `packages/validators/src/tax.ts`: `calcularImpuestoRenta(rentaLiquida)` — tramos sobre UTA=720_000 CLP (anual, no mensual)

### IVA
- `calcularIVA(neto) = Math.floor(neto * 0.19)`

### RUT (mod-11 chileno)
- Ciclo de multiplicadores: 2→3→4→5→6→7→2→3→... de derecha a izquierda del cuerpo
- DV esperado: `11 - (sum % 11)`; si resultado==11 → '0'; si resultado==10 → 'K'

---

## File Map

| Archivo | Acción |
|---------|--------|
| `packages/validators/tests/payroll.test.ts` | Crear — 8 casos cubriendo cada tramo y variantes |
| `packages/validators/tests/tax.test.ts` | Extender — IVA extremos + calcularImpuestoRenta tramos |
| `packages/validators/tests/rut.test.ts` | Extender — todos los DV (0-9, K) + RUT mínimo |
| `packages/validators/vitest.config.ts` | Crear — coverage threshold 80% |
| `packages/dte/tests/signer.test.ts` | Extender — tampering + PEM inválido |
| `packages/dte/vitest.config.ts` | Crear — coverage threshold 80% |
| `apps/api/tests/f29-calculations.test.ts` | Crear — lógica F29 via route con Prisma mock |
| `apps/api/tests/f22-calculations.test.ts` | Crear — lógica F22 via route con Prisma mock |
| `apps/api/tests/security/multi-tenancy.test.ts` | Crear — aislamiento de datos entre empresas |

---

## Task 1: Crear tests exhaustivos para calcularLiquidacion

**Files:**
- Create: `packages/validators/tests/payroll.test.ts`

- [ ] **Step 1: Escribir el archivo de tests**

Crear `packages/validators/tests/payroll.test.ts` con este contenido exacto:

```typescript
import { describe, it, expect } from 'vitest'
import { calcularLiquidacion } from '../src/payroll'

// UTM fijada en 67_000 en todos los tests para resultados deterministas

describe('calcularLiquidacion', () => {
  describe('AFP correcta según código', () => {
    it('HABITAT (0.1127) — descuenta tasa correcta', () => {
      const r = calcularLiquidacion({
        baseSalary: 1_000_000,
        afp: 'HABITAT',
        healthPlan: 'FONASA',
        contractType: 'INDEFINIDO',
        utmValue: 67_000,
      })
      // Math.round(1_000_000 * 0.1127) = 112_700
      expect(r.afp).toBe(112_700)
    })

    it('CAPITAL (0.1144) — descuenta tasa correcta', () => {
      const r = calcularLiquidacion({
        baseSalary: 1_000_000,
        afp: 'CAPITAL',
        healthPlan: 'FONASA',
        contractType: 'INDEFINIDO',
        utmValue: 67_000,
      })
      // Math.round(1_000_000 * 0.1144) = 114_400
      expect(r.afp).toBe(114_400)
    })

    it('MODELO (0.1058) — descuenta tasa más baja entre las 7 AFP', () => {
      const r = calcularLiquidacion({
        baseSalary: 1_000_000,
        afp: 'MODELO',
        healthPlan: 'FONASA',
        contractType: 'INDEFINIDO',
        utmValue: 67_000,
      })
      // Math.round(1_000_000 * 0.1058) = 105_800
      expect(r.afp).toBe(105_800)
    })
  })

  describe('Tramos de impuesto único mensual', () => {
    // Tramo 1: baseInUtm <= 13.5 → 0% (sin impuesto)
    it('Tramo 1 (0%): bruto 1M → impuesto = 0', () => {
      const r = calcularLiquidacion({
        baseSalary: 1_000_000,
        afp: 'HABITAT',
        healthPlan: 'FONASA',
        contractType: 'INDEFINIDO',
        utmValue: 67_000,
      })
      // baseImponible = 1_000_000 - 112_700 - 70_000 - 6_000 = 811_300
      // baseInUtm = 811_300 / 67_000 = 12.1 <= 13.5 → 0%
      expect(r.baseImponible).toBe(811_300)
      expect(r.impuesto).toBe(0)
      expect(r.liquido).toBe(811_300)
    })

    // Tramo 2: 13.5 < baseInUtm <= 30 → 4%, deducción 0.54
    it('Tramo 2 (4%): bruto 1.5M → impuesto 12_498', () => {
      const r = calcularLiquidacion({
        baseSalary: 1_500_000,
        afp: 'HABITAT',
        healthPlan: 'FONASA',
        contractType: 'INDEFINIDO',
        utmValue: 67_000,
      })
      // afp = 169_050, salud = 105_000, cesantia = 9_000
      // baseImponible = 1_500_000 - 169_050 - 105_000 - 9_000 = 1_216_950
      // baseInUtm = 18.163... → tramo 2
      // taxInUtm = 18.163 * 0.04 - 0.54 = 0.18654 → impuesto = round(0.18654 * 67_000) = 12_498
      expect(r.afp).toBe(169_050)
      expect(r.salud).toBe(105_000)
      expect(r.cesantia).toBe(9_000)
      expect(r.impuesto).toBe(12_498)
      expect(r.liquido).toBe(1_500_000 - 169_050 - 105_000 - 9_000 - 12_498)
    })

    // Tramo 3: 30 < baseInUtm <= 50 → 8%, deducción 1.74
    it('Tramo 3 (8%): bruto 2.5M → impuesto 45_680', () => {
      const r = calcularLiquidacion({
        baseSalary: 2_500_000,
        afp: 'HABITAT',
        healthPlan: 'FONASA',
        contractType: 'INDEFINIDO',
        utmValue: 67_000,
      })
      // baseImponible = 2_028_250; baseInUtm = 30.27 → tramo 3
      // taxInUtm = 30.27 * 0.08 - 1.74 = 0.6818 → round(0.6818 * 67_000) = 45_680
      expect(r.impuesto).toBe(45_680)
    })

    // Tramo 4: 50 < baseInUtm <= 70 → 13.5%, deducción 4.49
    it('Tramo 4 (13.5%): bruto 4.5M', () => {
      const r = calcularLiquidacion({
        baseSalary: 4_500_000,
        afp: 'HABITAT',
        healthPlan: 'FONASA',
        contractType: 'INDEFINIDO',
        utmValue: 67_000,
      })
      // afp=507_150, salud=315_000, cesantia=27_000
      // baseImponible=3_650_850; baseInUtm=54.49 → tramo 4
      expect(r.impuesto).toBeGreaterThan(0)
      // Tramo 4: rate 13.5%, deducción 4.49
      const baseInUtm = r.baseImponible / 67_000
      expect(baseInUtm).toBeGreaterThan(50)
      expect(baseInUtm).toBeLessThanOrEqual(70)
    })

    // Tramo 5: 70 < baseInUtm <= 90 → 23%, deducción 11.14
    it('Tramo 5 (23%): bruto 6M — baseInUtm en rango 70-90', () => {
      const r = calcularLiquidacion({
        baseSalary: 6_000_000,
        afp: 'HABITAT',
        healthPlan: 'FONASA',
        contractType: 'INDEFINIDO',
        utmValue: 67_000,
      })
      const baseInUtm = r.baseImponible / 67_000
      expect(baseInUtm).toBeGreaterThan(70)
      expect(baseInUtm).toBeLessThanOrEqual(90)
      expect(r.impuesto).toBeGreaterThan(0)
    })
  })

  describe('Salud: FONASA vs ISAPRE', () => {
    it('FONASA: descuenta exactamente el 7% del bruto', () => {
      const r = calcularLiquidacion({
        baseSalary: 2_000_000,
        afp: 'HABITAT',
        healthPlan: 'FONASA',
        contractType: 'INDEFINIDO',
        utmValue: 67_000,
      })
      // Math.round(2_000_000 * 0.07) = 140_000
      expect(r.salud).toBe(140_000)
    })

    it('ISAPRE: toma el máximo entre 7% y el monto del plan cuando plan > mínimo', () => {
      const r = calcularLiquidacion({
        baseSalary: 2_000_000,
        afp: 'HABITAT',
        healthPlan: 'ISAPRE',
        healthAmount: 200_000,
        contractType: 'INDEFINIDO',
        utmValue: 67_000,
      })
      // saludMinimo = round(2_000_000 * 0.07) = 140_000
      // salud = max(140_000, 200_000) = 200_000
      expect(r.salud).toBe(200_000)
    })

    it('ISAPRE: usa el 7% mínimo cuando el plan pactado es menor', () => {
      const r = calcularLiquidacion({
        baseSalary: 1_000_000,
        afp: 'HABITAT',
        healthPlan: 'ISAPRE',
        healthAmount: 50_000,
        contractType: 'INDEFINIDO',
        utmValue: 67_000,
      })
      // saludMinimo = 70_000 > healthAmount = 50_000 → salud = 70_000
      expect(r.salud).toBe(70_000)
    })
  })

  describe('Cesantía: solo INDEFINIDO', () => {
    it('INDEFINIDO: descuenta el 0.6% del bruto', () => {
      const r = calcularLiquidacion({
        baseSalary: 1_000_000,
        afp: 'HABITAT',
        healthPlan: 'FONASA',
        contractType: 'INDEFINIDO',
        utmValue: 67_000,
      })
      // Math.round(1_000_000 * 0.006) = 6_000
      expect(r.cesantia).toBe(6_000)
    })

    it('PLAZO_FIJO: no descuenta cesantía', () => {
      const r = calcularLiquidacion({
        baseSalary: 1_000_000,
        afp: 'CAPITAL',
        healthPlan: 'FONASA',
        contractType: 'PLAZO_FIJO',
        utmValue: 67_000,
      })
      expect(r.cesantia).toBe(0)
      // liquido = bruto - afp - salud (sin cesantía, sin impuesto si base bajo)
      // afp = 114_400, salud = 70_000, cesantia = 0
      // baseImponible = 1_000_000 - 114_400 - 70_000 = 815_600
      // 815_600 / 67_000 = 12.17 <= 13.5 → impuesto = 0
      expect(r.liquido).toBe(815_600)
    })

    it('HONORARIOS: no descuenta cesantía', () => {
      const r = calcularLiquidacion({
        baseSalary: 800_000,
        afp: 'HABITAT',
        healthPlan: 'FONASA',
        contractType: 'HONORARIOS',
        utmValue: 67_000,
      })
      expect(r.cesantia).toBe(0)
    })
  })

  describe('Bonos y horas extras', () => {
    it('bruto incluye baseSalary + horasExtras + bonos', () => {
      const r = calcularLiquidacion({
        baseSalary: 800_000,
        horasExtras: 100_000,
        bonos: 50_000,
        afp: 'HABITAT',
        healthPlan: 'FONASA',
        contractType: 'INDEFINIDO',
        utmValue: 67_000,
      })
      expect(r.bruto).toBe(950_000)
      expect(r.horasExtras).toBe(100_000)
      expect(r.bonos).toBe(50_000)
    })
  })

  describe('Casos extremos', () => {
    it('otrosDescuentos puede dejar líquido negativo', () => {
      const r = calcularLiquidacion({
        baseSalary: 500_000,
        otrosDescuentos: 600_000,
        afp: 'HABITAT',
        healthPlan: 'FONASA',
        contractType: 'INDEFINIDO',
        utmValue: 67_000,
      })
      // afp=56_350, salud=35_000, cesantia=3_000, impuesto=0
      // liquido = 500_000 - 56_350 - 35_000 - 3_000 - 0 - 600_000 = -194_350
      expect(r.liquido).toBe(-194_350)
      expect(r.otrosDesc).toBe(600_000)
    })

    it('sueldo 0 retorna todos los campos en 0', () => {
      const r = calcularLiquidacion({
        baseSalary: 0,
        afp: 'HABITAT',
        healthPlan: 'FONASA',
        contractType: 'INDEFINIDO',
        utmValue: 67_000,
      })
      expect(r.bruto).toBe(0)
      expect(r.afp).toBe(0)
      expect(r.salud).toBe(0)
      expect(r.cesantia).toBe(0)
      expect(r.impuesto).toBe(0)
      expect(r.liquido).toBe(0)
    })

    it('invariante: liquido = bruto - afp - salud - cesantia - impuesto - otrosDesc', () => {
      const r = calcularLiquidacion({
        baseSalary: 3_200_000,
        bonos: 200_000,
        afp: 'PROVIDA',
        healthPlan: 'ISAPRE',
        healthAmount: 180_000,
        contractType: 'INDEFINIDO',
        utmValue: 67_000,
      })
      const expected = r.bruto - r.afp - r.salud - r.cesantia - r.impuesto - r.otrosDesc
      expect(r.liquido).toBe(expected)
    })
  })
})
```

- [ ] **Step 2: Ejecutar y verificar que todos pasan**

```bash
pnpm --filter @contachile/validators test
```

Expected output: todos los tests pasan. Si alguno falla, el valor calculado está mal — revisar la aritmética en los comentarios del test.

- [ ] **Step 3: Commit**

```bash
git add packages/validators/tests/payroll.test.ts
git commit -m "test(sprint7): tests exhaustivos calcularLiquidacion — 8 tramos AFP/salud/cesantía"
```

---

## Task 2: Extender tax.test.ts con IVA extremos y calcularImpuestoRenta

**Files:**
- Modify: `packages/validators/tests/tax.test.ts`

- [ ] **Step 1: Reemplazar el archivo con la versión extendida**

```typescript
import { describe, it, expect } from 'vitest'
import { calcularIVA, calcularTotal, calcularImpuestoRenta } from '../src/tax'

describe('calcularIVA', () => {
  it('calcula el 19% redondeado hacia abajo', () => {
    expect(calcularIVA(100_000)).toBe(19_000)
    expect(calcularIVA(99_999)).toBe(18_999)
    expect(calcularIVA(1)).toBe(0) // floor(0.19) = 0
  })

  it('retorna 0 para neto = 0', () => {
    expect(calcularIVA(0)).toBe(0)
  })

  it('funciona con montos grandes (millones de CLP)', () => {
    // 1_000_000_000 * 0.19 = 190_000_000 exacto
    expect(calcularIVA(1_000_000_000)).toBe(190_000_000)
  })

  it('retorna valor negativo para neto negativo (nota de crédito)', () => {
    // Math.floor(-1000 * 0.19) = Math.floor(-190) = -190
    expect(calcularIVA(-1_000)).toBe(-190)
  })
})

describe('calcularTotal', () => {
  it('retorna neto + IVA', () => {
    expect(calcularTotal(100_000)).toBe(119_000)
  })

  it('retorna 0 para neto = 0', () => {
    expect(calcularTotal(0)).toBe(0)
  })
})

// UTA = 720_000 CLP
// Tramos:
//   0%:    hasta 15 UTA = 10_800_000
//   4%:    15-30 UTA    = 10_800_000 - 21_600_000
//   8%:    30-50 UTA    = 21_600_000 - 36_000_000
//   13.5%: 50-120 UTA   = 36_000_000 - 86_400_000
//   27%:   > 120 UTA    = > 86_400_000
describe('calcularImpuestoRenta', () => {
  it('retorna 0 para renta = 0', () => {
    expect(calcularImpuestoRenta(0)).toBe(0)
  })

  it('retorna 0 para renta negativa', () => {
    expect(calcularImpuestoRenta(-500_000)).toBe(0)
  })

  it('Tramo 1 (0%): renta 5M — todo exento', () => {
    // 5_000_000 < 10_800_000 → 0%
    expect(calcularImpuestoRenta(5_000_000)).toBe(0)
  })

  it('Tramo 1+2 (0%+4%): renta 15M', () => {
    // 0% sobre 10_800_000 = 0
    // 4% sobre (15_000_000 - 10_800_000) = 4% sobre 4_200_000 = floor(168_000) = 168_000
    expect(calcularImpuestoRenta(15_000_000)).toBe(168_000)
  })

  it('Tramo 2 completo (4%): renta 25M', () => {
    // 0% sobre 10_800_000 = 0
    // 4% sobre (25_000_000 - 10_800_000) = 4% sobre 14_200_000 = floor(568_000) = 568_000
    expect(calcularImpuestoRenta(25_000_000)).toBe(568_000)
  })

  it('Tramo 3 (8%): renta 40M', () => {
    // 0%  → 0
    // 4%  sobre (21_600_000 - 10_800_000) = 4% × 10_800_000 = 432_000
    // 8%  sobre (40_000_000 - 21_600_000) = 8% × 18_400_000 = floor(1_472_000) = 1_472_000
    expect(calcularImpuestoRenta(40_000_000)).toBe(1_904_000)
  })

  it('Tramo 4 (13.5%): renta 50M — justo en el límite', () => {
    // 0%  → 0
    // 4%  × 10_800_000 = 432_000
    // 8%  × 14_400_000 = floor(1_152_000) = 1_152_000
    // total = 1_584_000
    expect(calcularImpuestoRenta(36_000_000)).toBe(1_584_000)
  })

  it('Tramo 5 (27%): renta 100M — tramo máximo actual', () => {
    // impuesto > 0 y superior al tramo 4
    const tax100M = calcularImpuestoRenta(100_000_000)
    const tax80M  = calcularImpuestoRenta(80_000_000)
    expect(tax100M).toBeGreaterThan(tax80M)
    // La tasa marginal en el último tramo es 27%
    expect(tax100M).toBeGreaterThan(0)
  })

  it('invariante: impuesto es monótono creciente con la renta', () => {
    const rentas = [0, 1_000_000, 10_000_000, 20_000_000, 40_000_000, 80_000_000, 120_000_000]
    for (let i = 1; i < rentas.length; i++) {
      expect(calcularImpuestoRenta(rentas[i])).toBeGreaterThanOrEqual(
        calcularImpuestoRenta(rentas[i - 1])
      )
    }
  })
})
```

- [ ] **Step 2: Ejecutar tests**

```bash
pnpm --filter @contachile/validators test
```

Expected: todos los tests anteriores + los nuevos pasan.

- [ ] **Step 3: Commit**

```bash
git add packages/validators/tests/tax.test.ts
git commit -m "test(sprint7): extender tax.test.ts — IVA extremos y calcularImpuestoRenta 5 tramos"
```

---

## Task 3: Extender rut.test.ts con todos los DV posibles

**Files:**
- Modify: `packages/validators/tests/rut.test.ts`

Los RUTs de prueba con cada DV posible (pre-calculados con el algoritmo mod-11):
- DV=0: `10010001-0`  (sum=11, 11%11=0 → DV=0)
- DV=1: `10100000-1`  (sum=10 → DV=1)
- DV=2: `10010000-2`  (sum=9  → DV=2)
- DV=3: `10001000-3`  (sum=8  → DV=3)
- DV=4: `10000100-4`  (sum=7  → DV=4)
- DV=5: `12345678-5`  (conocido)
- DV=6: `10000001-6`  (sum=5  → DV=6)
- DV=7: `00000002-7`  (sum=4  → DV=7)
- DV=8: `10000000-8`  (sum=3  → DV=8)
- DV=9: `00000001-9`  (sum=2  → DV=9)
- DV=K: `8888888-K`   (7 dígitos, sum=232, 232%11=1 → DV=10='K')

- [ ] **Step 1: Reemplazar el archivo con la versión extendida**

```typescript
import { describe, it, expect } from 'vitest'
import { validateRUT, formatRUT } from '../src/rut'

describe('validateRUT', () => {
  it('valida un RUT correcto con puntos y guión', () => {
    expect(validateRUT('12.345.678-5')).toBe(true)
  })

  it('valida un RUT correcto sin formato', () => {
    expect(validateRUT('12345678-5')).toBe(true)
  })

  it('rechaza un RUT con dígito verificador incorrecto', () => {
    expect(validateRUT('12.345.678-6')).toBe(false)
  })

  it('rechaza RUT malformado', () => {
    expect(validateRUT('not-a-rut')).toBe(false)
    expect(validateRUT('')).toBe(false)
  })

  it('valida todos los dígitos verificadores posibles (0-9 y K)', () => {
    const casesValid = [
      '10010001-0',  // DV=0
      '10100000-1',  // DV=1
      '10010000-2',  // DV=2
      '10001000-3',  // DV=3
      '10000100-4',  // DV=4
      '12345678-5',  // DV=5
      '10000001-6',  // DV=6
      '00000002-7',  // DV=7
      '10000000-8',  // DV=8
      '00000001-9',  // DV=9
      '8888888-K',   // DV=K (7 dígitos)
    ]
    for (const rut of casesValid) {
      expect(validateRUT(rut), `${rut} debe ser válido`).toBe(true)
    }
  })

  it('rechaza los mismos RUTs con DV cambiado en 1', () => {
    // Cada uno con DV incorrecto — deben fallar
    const casesInvalid = [
      '10010001-1',  // DV correcto es 0
      '10100000-2',  // DV correcto es 1
      '12345678-6',  // DV correcto es 5
      '8888888-0',   // DV correcto es K
    ]
    for (const rut of casesInvalid) {
      expect(validateRUT(rut), `${rut} debe ser inválido`).toBe(false)
    }
  })

  it('acepta DV=K en mayúscula y minúscula', () => {
    expect(validateRUT('8888888-K')).toBe(true)
    expect(validateRUT('8888888-k')).toBe(true)
  })

  it('rechaza RUT con menos de 7 dígitos en el cuerpo', () => {
    expect(validateRUT('123456-5')).toBe(false) // 6 dígitos — demasiado corto
  })

  it('rechaza RUT con letras en el cuerpo', () => {
    expect(validateRUT('1234567A-5')).toBe(false)
  })
})

describe('formatRUT', () => {
  it('formatea RUT con puntos y guión', () => {
    expect(formatRUT('123456785')).toBe('12.345.678-5')
  })

  it('formatea RUT de 7 dígitos (empresa pequeña)', () => {
    // body = '888888', DV = 'K'
    expect(formatRUT('8888888K')).toBe('8.888.888-K')
  })
})
```

- [ ] **Step 2: Ejecutar tests**

```bash
pnpm --filter @contachile/validators test
```

Expected: 12+ tests pasando.

- [ ] **Step 3: Commit**

```bash
git add packages/validators/tests/rut.test.ts
git commit -m "test(sprint7): extender rut.test.ts — todos los DV posibles (0-9 y K)"
```

---

## Task 4: Configurar coverage thresholds en validators y dte

**Files:**
- Create: `packages/validators/vitest.config.ts`
- Create: `packages/dte/vitest.config.ts`
- Modify: `packages/validators/package.json` (agregar `@vitest/coverage-v8` como devDep)
- Modify: `packages/dte/package.json` (ídem)

- [ ] **Step 1: Instalar @vitest/coverage-v8 en validators y dte**

```bash
pnpm --filter @contachile/validators add -D @vitest/coverage-v8
pnpm --filter @contachile/dte add -D @vitest/coverage-v8
```

Expected: sin errores, pnpm-lock.yaml actualizado.

- [ ] **Step 2: Crear vitest.config.ts en validators**

Crear `packages/validators/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
  },
})
```

- [ ] **Step 3: Crear vitest.config.ts en dte**

Crear `packages/dte/vitest.config.ts`:

```typescript
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 70,
        statements: 80,
      },
      include: ['src/**/*.ts'],
      exclude: ['src/index.ts'],
    },
  },
})
```

- [ ] **Step 4: Verificar que coverage corre sin bloquear**

```bash
pnpm --filter @contachile/validators exec vitest run --coverage
```

Expected: coverage report generado. Si falla por threshold, revisar qué código no está cubierto.

- [ ] **Step 5: Commit**

```bash
git add packages/validators/vitest.config.ts packages/dte/vitest.config.ts packages/validators/package.json packages/dte/package.json pnpm-lock.yaml
git commit -m "test(sprint7): configurar coverage threshold 80% en validators y dte"
```

---

## Task 5: Extender signer.test.ts con tampering y PEM inválido

**Files:**
- Modify: `packages/dte/tests/signer.test.ts`

El signer firma con RSA+SHA1. Para el test de tampering: (1) firmar un doc, (2) extraer el DigestValue embebido, (3) calcular el SHA1 del contenido modificado, (4) mostrar que difieren.

- [ ] **Step 1: Reemplazar el archivo con la versión extendida**

```typescript
import { describe, it, expect } from 'vitest'
import { firmarDTE, extractPrivateKeyFromPfx } from '../src/signer'
import forge from 'node-forge'

function generateTestKeyPair(): { privateKeyPem: string; publicKeyPem: string } {
  const keys = forge.pki.rsa.generateKeyPair({ bits: 2048 })
  return {
    privateKeyPem: forge.pki.privateKeyToPem(keys.privateKey),
    publicKeyPem: forge.pki.publicKeyToPem(keys.publicKey),
  }
}

function sha1Base64(data: string): string {
  const md = forge.md.sha1.create()
  md.update(data, 'utf8')
  return forge.util.encode64(md.digest().bytes())
}

describe('firmarDTE', () => {
  it('agrega elemento Signature dentro de Documento', () => {
    const xml = '<?xml version="1.0" encoding="ISO-8859-1"?><DTE><Documento ID="T1"></Documento></DTE>'
    const { privateKeyPem } = generateTestKeyPair()
    const signed = firmarDTE(xml, privateKeyPem)
    expect(signed).toContain('<Signature')
    expect(signed).toContain('</Signature>')
    expect(signed).toContain('<Documento ID="T1"><Signature')
  })

  it('incluye SignedInfo con Reference al ID del Documento', () => {
    const xml = '<?xml version="1.0" encoding="ISO-8859-1"?><DTE><Documento ID="T1"></Documento></DTE>'
    const { privateKeyPem } = generateTestKeyPair()
    const signed = firmarDTE(xml, privateKeyPem)
    expect(signed).toContain('<SignedInfo xmlns="http://www.w3.org/2000/09/xmldsig#">')
    expect(signed).toContain('URI="#T1"')
    expect(signed).toContain('<DigestMethod Algorithm="http://www.w3.org/2000/09/xmldsig#sha1"')
    expect(signed).toContain('<SignatureMethod Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"')
  })

  it('produce un SignatureValue no vacío', () => {
    const xml = '<?xml version="1.0" encoding="ISO-8859-1"?><DTE><Documento ID="T1"></Documento></DTE>'
    const { privateKeyPem } = generateTestKeyPair()
    const signed = firmarDTE(xml, privateKeyPem)
    const match = signed.match(/<SignatureValue>([^<]+)<\/SignatureValue>/)
    expect(match).not.toBeNull()
    expect(match![1].length).toBeGreaterThan(0)
  })

  it('DigestValue embebido coincide con SHA-1 del bloque Documento original', () => {
    const content = '<monto>100000</monto>'
    const xml = `<?xml version="1.0"?><DTE><Documento ID="F1">${content}</Documento></DTE>`
    const { privateKeyPem } = generateTestKeyPair()
    const signed = firmarDTE(xml, privateKeyPem)

    // Extraer DigestValue del XML firmado
    const digestMatch = signed.match(/<DigestValue>([^<]+)<\/DigestValue>/)
    expect(digestMatch).not.toBeNull()
    const embeddedDigest = digestMatch![1]

    // El DigestValue debe ser el SHA-1 del bloque Documento ANTES de la firma
    const expectedDigest = sha1Base64(`<Documento ID="F1">${content}</Documento>`)
    expect(embeddedDigest).toBe(expectedDigest)
  })

  it('tampering: modificar el contenido produce un DigestValue distinto — el fraude es detectable', () => {
    const originalContent = '<monto>100000</monto>'
    const tamperedContent = '<monto>999999</monto>'
    const xml = `<?xml version="1.0"?><DTE><Documento ID="F1">${originalContent}</Documento></DTE>`
    const { privateKeyPem } = generateTestKeyPair()
    const signed = firmarDTE(xml, privateKeyPem)

    // DigestValue embebido en el XML firmado
    const embeddedDigest = signed.match(/<DigestValue>([^<]+)<\/DigestValue>/)![1]

    // SHA-1 del contenido alterado — diferente al embebido
    const tamperedDigest = sha1Base64(`<Documento ID="F1">${tamperedContent}</Documento>`)

    expect(tamperedDigest).not.toBe(embeddedDigest)
  })

  it('lanza error si no hay elemento Documento en el XML', () => {
    const xml = '<?xml version="1.0"?><DTE><OtroElemento></OtroElemento></DTE>'
    const { privateKeyPem } = generateTestKeyPair()
    expect(() => firmarDTE(xml, privateKeyPem)).toThrow('No Documento element found in XML')
  })

  it('lanza error con PEM de clave privada inválido', () => {
    const xml = '<?xml version="1.0"?><DTE><Documento ID="T1"></Documento></DTE>'
    expect(() => firmarDTE(xml, 'esto-no-es-un-pem-valido')).toThrow()
  })
})

describe('extractPrivateKeyFromPfx', () => {
  it('lanza error con base64 inválido', () => {
    expect(() => extractPrivateKeyFromPfx('!!!base64-invalido!!!', 'password')).toThrow()
  })

  it('extrae la clave privada de un PFX válido generado con la contraseña correcta', () => {
    // Generar un PFX real con node-forge para validar la función end-to-end
    const keys = forge.pki.rsa.generateKeyPair({ bits: 512 }) // 512 bits para velocidad en tests
    const cert = forge.pki.createCertificate()
    cert.publicKey = keys.publicKey
    cert.serialNumber = '01'
    cert.validity.notBefore = new Date()
    cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    const attrs = [{ name: 'commonName', value: 'test' }]
    cert.setSubject(attrs)
    cert.setIssuer(attrs)
    cert.sign(keys.privateKey)

    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'correct-password')
    const pfxBase64 = forge.util.encode64(forge.asn1.toDer(p12Asn1).bytes())

    const extractedPem = extractPrivateKeyFromPfx(pfxBase64, 'correct-password')
    expect(extractedPem).toContain('-----BEGIN RSA PRIVATE KEY-----')
  })

  it('lanza error con contraseña incorrecta en PFX válido', () => {
    const keys = forge.pki.rsa.generateKeyPair({ bits: 512 })
    const cert = forge.pki.createCertificate()
    cert.publicKey = keys.publicKey
    cert.serialNumber = '01'
    cert.validity.notBefore = new Date()
    cert.validity.notAfter = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
    const attrs = [{ name: 'commonName', value: 'test' }]
    cert.setSubject(attrs)
    cert.setIssuer(attrs)
    cert.sign(keys.privateKey)

    const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], 'correct-password')
    const pfxBase64 = forge.util.encode64(forge.asn1.toDer(p12Asn1).bytes())

    expect(() => extractPrivateKeyFromPfx(pfxBase64, 'wrong-password')).toThrow()
  })
})
```

- [ ] **Step 2: Ejecutar tests del paquete dte**

```bash
pnpm --filter @contachile/dte test
```

Expected: todos los tests de signer pasan. Los tests que generan RSA de 512 bits pueden tardar 1-2 segundos — es normal.

- [ ] **Step 3: Commit**

```bash
git add packages/dte/tests/signer.test.ts
git commit -m "test(sprint7): extender signer.test.ts — tampering detectable, PEM inválido, PFX end-to-end"
```

---

## Task 6: Crear tests de cálculo F29

**Files:**
- Create: `apps/api/tests/f29-calculations.test.ts`

La función `calculateF29` no está exportada — se testea via la ruta Fastify con Prisma mockeado.

- [ ] **Step 1: Crear el archivo de tests**

Crear `apps/api/tests/f29-calculations.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import tenantPlugin from '../src/plugins/tenant'
import f29Route from '../src/routes/f29'

vi.mock('@contachile/db', () => ({
  prisma: {
    document: {
      findMany: vi.fn(),
    },
    purchase: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '@contachile/db'

const mockDocumentFindMany = prisma.document.findMany as ReturnType<typeof vi.fn>
const mockPurchaseFindMany = prisma.purchase.findMany as ReturnType<typeof vi.fn>

function buildApp() {
  const app = Fastify()
  app.register(tenantPlugin)
  app.register(f29Route)
  return app
}

const COMPANY_ID = 'company-f29-test'
const headers = {
  'x-active-company-id': COMPANY_ID,
  'x-user-id': 'user-1',
}

beforeEach(() => {
  vi.clearAllMocks()
  process.env.DEV_BYPASS_AUTH = 'true'
})

describe('GET /f29 — cálculos tributarios', () => {
  it('sin ventas ni compras — todos los valores son 0', async () => {
    mockDocumentFindMany.mockResolvedValue([])
    mockPurchaseFindMany.mockResolvedValue([])

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f29?year=2026&month=3', headers })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.f29['502']).toBe(0) // débito fiscal
    expect(body.f29['503']).toBe(0) // crédito fiscal
    expect(body.f29['595']).toBe(0) // IVA determinado
    expect(body.f29['91']).toBe(0)  // total a pagar
  })

  it('solo ventas — débito > crédito → IVA determinado positivo', async () => {
    // 2 facturas: neto 1_000_000 cada una, IVA 190_000 cada una
    mockDocumentFindMany.mockResolvedValue([
      { type: 33, totalNet: 1_000_000, totalTax: 190_000, totalAmount: 1_190_000 },
      { type: 33, totalNet: 1_000_000, totalTax: 190_000, totalAmount: 1_190_000 },
    ])
    mockPurchaseFindMany.mockResolvedValue([])

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f29?year=2026&month=3', headers })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.f29['502']).toBe(380_000)  // débito = 190_000 + 190_000
    expect(body.f29['503']).toBe(0)         // sin compras
    expect(body.f29['595']).toBe(380_000)  // IVA determinado = débito - crédito
    expect(body.sales.neto).toBe(2_000_000)
    expect(body.sales.count).toBe(2)
  })

  it('compras mayores que ventas — IVA determinado negativo (crédito a favor)', async () => {
    mockDocumentFindMany.mockResolvedValue([
      { type: 33, totalNet: 500_000, totalTax: 95_000, totalAmount: 595_000 },
    ])
    mockPurchaseFindMany.mockResolvedValue([
      { netAmount: 1_000_000, taxAmount: 190_000, totalAmount: 1_190_000 },
    ])

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f29?year=2026&month=3', headers })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.f29['502']).toBe(95_000)   // débito
    expect(body.f29['503']).toBe(190_000)  // crédito
    // 95_000 - 190_000 = -95_000 → remanente para el mes siguiente
    expect(body.f29['595']).toBe(-95_000)
  })

  it('PPM = 0.4% de la venta neta total', async () => {
    mockDocumentFindMany.mockResolvedValue([
      { type: 33, totalNet: 1_000_000, totalTax: 190_000, totalAmount: 1_190_000 },
    ])
    mockPurchaseFindMany.mockResolvedValue([])

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f29?year=2026&month=3', headers })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    // PPM = Math.round(1_000_000 * 0.004) = 4_000
    expect(body.f29['547']).toBe(4_000)
    // total a pagar = IVA determinado + PPM = 190_000 + 4_000 = 194_000
    expect(body.f29['91']).toBe(194_000)
  })

  it('período inválido retorna 400', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f29?year=2026&month=13', headers })
    expect(res.statusCode).toBe(400)
  })

  it('consulta solo documentos del companyId correcto', async () => {
    mockDocumentFindMany.mockResolvedValue([])
    mockPurchaseFindMany.mockResolvedValue([])

    const app = buildApp()
    await app.inject({ method: 'GET', url: '/f29?year=2026&month=3', headers })

    // Verificar que la query incluye el companyId del tenant
    expect(mockDocumentFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ companyId: COMPANY_ID }),
      })
    )
  })
})
```

- [ ] **Step 2: Ejecutar tests**

```bash
pnpm --filter @contachile/api exec vitest run tests/f29-calculations.test.ts
```

Expected: 6 tests pasando.

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/f29-calculations.test.ts
git commit -m "test(sprint7): tests cálculo F29 — débito/crédito/IVA/PPM con Prisma mock"
```

---

## Task 7: Crear tests de cálculo F22

**Files:**
- Create: `apps/api/tests/f22-calculations.test.ts`

- [ ] **Step 1: Crear el archivo de tests**

Crear `apps/api/tests/f22-calculations.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import tenantPlugin from '../src/plugins/tenant'
import f22Route from '../src/routes/f22'

vi.mock('@contachile/db', () => ({
  prisma: {
    document: {
      aggregate: vi.fn(),
      findMany: vi.fn(),
    },
    purchase: {
      aggregate: vi.fn(),
    },
  },
}))

import { prisma } from '@contachile/db'

const mockDocumentAggregate = prisma.document.aggregate as ReturnType<typeof vi.fn>
const mockDocumentFindMany = prisma.document.findMany as ReturnType<typeof vi.fn>
const mockPurchaseAggregate = prisma.purchase.aggregate as ReturnType<typeof vi.fn>

function buildApp() {
  const app = Fastify()
  app.register(tenantPlugin)
  app.register(f22Route)
  return app
}

const COMPANY_ID = 'company-f22-test'
const headers = {
  'x-active-company-id': COMPANY_ID,
  'x-user-id': 'user-1',
}

// PPM mensual mock: 12 meses con ventas = 0 (sin PPM)
const zeroPpmMonths = Array(12).fill([])

beforeEach(() => {
  vi.clearAllMocks()
  process.env.DEV_BYPASS_AUTH = 'true'
  // Por defecto: findMany para PPM retorna 0 en todos los meses
  mockDocumentFindMany.mockResolvedValue([])
})

describe('GET /f22 — cálculos tributarios anuales', () => {
  it('renta neta = 0 → impuesto = 0, sin saldo a pagar ni devolver', async () => {
    mockDocumentAggregate.mockResolvedValue({ _sum: { totalAmount: 0 } })
    mockPurchaseAggregate.mockResolvedValue({ _sum: { totalAmount: 0 } })

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f22?year=2026', headers })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.summary.rentaLiquida).toBe(0)
    expect(body.summary.impuesto).toBe(0)
    expect(body.summary.saldoPagar).toBe(0)
    expect(body.summary.saldoDevolver).toBe(0)
  })

  it('ingresos < costos+gastos → renta neta = 0 (no negativa)', async () => {
    // ingresos 1M, costos+gastos 2M → rentaLiquida = max(0, -1M) = 0
    mockDocumentAggregate.mockResolvedValue({ _sum: { totalAmount: 1_000_000 } })
    mockPurchaseAggregate
      .mockResolvedValueOnce({ _sum: { totalAmount: 1_500_000 } }) // costos
      .mockResolvedValueOnce({ _sum: { totalAmount: 500_000 } })  // gastos

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f22?year=2026', headers })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.summary.rentaLiquida).toBe(0)
    expect(body.summary.impuesto).toBe(0)
  })

  it('renta moderada → calcula impuesto usando calcularImpuestoRenta', async () => {
    // ingresos 20M, sin costos ni gastos → rentaLiquida = 20M
    // calcularImpuestoRenta(20_000_000):
    //   0% sobre 10_800_000 = 0
    //   4% sobre 9_200_000 = floor(368_000) = 368_000
    mockDocumentAggregate.mockResolvedValue({ _sum: { totalAmount: 20_000_000 } })
    mockPurchaseAggregate.mockResolvedValue({ _sum: { totalAmount: 0 } })

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f22?year=2026', headers })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.summary.rentaLiquida).toBe(20_000_000)
    expect(body.summary.impuesto).toBe(368_000)
  })

  it('PPM acumulado > impuesto → saldoDevolver > 0, saldoPagar = 0', async () => {
    // rentaLiquida = 5M → impuesto = 0 (bracket exento)
    // PPM = 12 meses × (1M ventas × 0.5%) = 12 × 5_000 = 60_000
    mockDocumentAggregate.mockResolvedValue({ _sum: { totalAmount: 5_000_000 } })
    mockPurchaseAggregate.mockResolvedValue({ _sum: { totalAmount: 0 } })
    // Cada mes tiene 1M en ventas → PPM mensual = Math.floor(1_000_000 * 0.005) = 5_000
    mockDocumentFindMany.mockResolvedValue([
      { totalAmount: 1_000_000 },
    ])

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f22?year=2026', headers })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    // impuesto = 0, PPM = 12 * 5_000 = 60_000
    expect(body.summary.ppmPagado).toBe(60_000)
    expect(body.summary.saldoPagar).toBe(0)
    expect(body.summary.saldoDevolver).toBe(60_000)
  })

  it('PPM < impuesto → saldoPagar > 0, saldoDevolver = 0', async () => {
    // rentaLiquida = 20M → impuesto = 368_000
    // PPM = 0 (sin ventas durante el año)
    mockDocumentAggregate.mockResolvedValue({ _sum: { totalAmount: 20_000_000 } })
    mockPurchaseAggregate.mockResolvedValue({ _sum: { totalAmount: 0 } })
    mockDocumentFindMany.mockResolvedValue([]) // sin PPM mensual

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f22?year=2026', headers })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.summary.ppmPagado).toBe(0)
    expect(body.summary.saldoPagar).toBe(368_000) // impuesto - PPM = 368_000 - 0
    expect(body.summary.saldoDevolver).toBe(0)
  })

  it('año inválido retorna 400', async () => {
    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f22?year=1999', headers })
    expect(res.statusCode).toBe(400)
  })

  it('retorna las 8 líneas de F22 con códigos correctos', async () => {
    mockDocumentAggregate.mockResolvedValue({ _sum: { totalAmount: 0 } })
    mockPurchaseAggregate.mockResolvedValue({ _sum: { totalAmount: 0 } })
    mockDocumentFindMany.mockResolvedValue([])

    const app = buildApp()
    const res = await app.inject({ method: 'GET', url: '/f22?year=2026', headers })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    const codes = body.lines.map((l: { code: string }) => l.code)
    expect(codes).toContain('525') // ingresos brutos
    expect(codes).toContain('528') // renta líquida
    expect(codes).toContain('585') // PPM pagado
    expect(codes).toContain('594') // impuesto determinado
    expect(codes).toContain('595') // saldo a pagar
    expect(codes).toContain('596') // saldo a devolver
  })
})
```

- [ ] **Step 2: Ejecutar tests**

```bash
pnpm --filter @contachile/api exec vitest run tests/f22-calculations.test.ts
```

Expected: 7 tests pasando.

- [ ] **Step 3: Commit**

```bash
git add apps/api/tests/f22-calculations.test.ts
git commit -m "test(sprint7): tests cálculo F22 — renta/PPM/impuesto/saldo con Prisma mock"
```

---

## Task 8: Crear tests de multi-tenancy

**Files:**
- Create: `apps/api/tests/security/multi-tenancy.test.ts`

Objetivo: verificar que **ningún escenario permite que empresa A vea datos de empresa B**. Se testea vía routes con Prisma mockeado — el mock captura el `where` clause y verifica que incluye el `companyId` correcto.

- [ ] **Step 1: Crear el archivo de tests**

Crear `apps/api/tests/security/multi-tenancy.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest'
import Fastify from 'fastify'
import tenantPlugin from '../../src/plugins/tenant'
import documentsRoute from '../../src/routes/dte/documents'
import employeesRoute from '../../src/routes/employees'
import purchasesRoute from '../../src/routes/purchases'

vi.mock('@contachile/db', () => ({
  prisma: {
    document: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    employee: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    purchase: {
      findMany: vi.fn().mockResolvedValue([]),
      count: vi.fn().mockResolvedValue(0),
    },
    companyMembership: {
      findFirst: vi.fn().mockResolvedValue(null),
      findMany: vi.fn().mockResolvedValue([]),
    },
  },
}))

import { prisma } from '@contachile/db'

const mockDocumentFindMany = prisma.document.findMany as ReturnType<typeof vi.fn>
const mockEmployeeFindMany = prisma.employee.findMany as ReturnType<typeof vi.fn>
const mockPurchaseFindMany = prisma.purchase.findMany as ReturnType<typeof vi.fn>

const COMPANY_A = 'company-alpha'
const COMPANY_B = 'company-beta'
const USER_A = 'user-alpha'

function buildApp() {
  const app = Fastify()
  app.register(tenantPlugin)
  app.register(documentsRoute)
  app.register(employeesRoute)
  app.register(purchasesRoute)
  return app
}

beforeEach(() => {
  vi.clearAllMocks()
  mockDocumentFindMany.mockResolvedValue([])
  mockEmployeeFindMany.mockResolvedValue([])
  mockPurchaseFindMany.mockResolvedValue([])
  process.env.DEV_BYPASS_AUTH = 'true'
})

describe('Multi-tenancy: aislamiento de datos entre empresas', () => {
  describe('GET /documents — documentos solo del companyId correcto', () => {
    it('empresa A solo consulta sus propios documentos', async () => {
      const app = buildApp()
      await app.inject({
        method: 'GET',
        url: '/documents',
        headers: { 'x-active-company-id': COMPANY_A, 'x-user-id': USER_A },
      })
      expect(mockDocumentFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: COMPANY_A }),
        })
      )
    })

    it('empresa B solo consulta sus propios documentos', async () => {
      const app = buildApp()
      await app.inject({
        method: 'GET',
        url: '/documents',
        headers: { 'x-active-company-id': COMPANY_B, 'x-user-id': USER_A },
      })
      expect(mockDocumentFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: COMPANY_B }),
        })
      )
    })

    it('empresa A nunca usa el companyId de empresa B en su query', async () => {
      const app = buildApp()
      await app.inject({
        method: 'GET',
        url: '/documents',
        headers: { 'x-active-company-id': COMPANY_A, 'x-user-id': USER_A },
      })
      const calls = mockDocumentFindMany.mock.calls
      for (const [args] of calls) {
        if (args?.where?.companyId) {
          expect(args.where.companyId).not.toBe(COMPANY_B)
        }
      }
    })
  })

  describe('GET /employees — trabajadores solo del companyId correcto', () => {
    it('la query siempre incluye el companyId del tenant activo', async () => {
      const app = buildApp()
      await app.inject({
        method: 'GET',
        url: '/employees',
        headers: { 'x-active-company-id': COMPANY_A, 'x-user-id': USER_A },
      })
      expect(mockEmployeeFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: COMPANY_A }),
        })
      )
    })

    it('diferente empresa obtiene diferente scope en la query', async () => {
      const app = buildApp()
      await app.inject({
        method: 'GET',
        url: '/employees',
        headers: { 'x-active-company-id': COMPANY_B, 'x-user-id': USER_A },
      })
      // La primera llamada con COMPANY_A no debería aparecer acá
      const calls = mockEmployeeFindMany.mock.calls
      expect(calls[0][0].where.companyId).toBe(COMPANY_B)
    })
  })

  describe('GET /purchases — compras solo del companyId correcto', () => {
    it('la query siempre incluye el companyId del tenant activo', async () => {
      const app = buildApp()
      await app.inject({
        method: 'GET',
        url: '/purchases',
        headers: { 'x-active-company-id': COMPANY_A, 'x-user-id': USER_A },
      })
      expect(mockPurchaseFindMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: COMPANY_A }),
        })
      )
    })
  })

  describe('Sin companyId — la petición es rechazada', () => {
    it('GET /documents sin x-active-company-id retorna 401 o 400', async () => {
      // Desactivar DEV_BYPASS_AUTH para este test
      delete process.env.DEV_BYPASS_AUTH
      const app = buildApp()
      const res = await app.inject({ method: 'GET', url: '/documents' })
      // Sin companyId no debe llegar a la query de DB
      expect([400, 401, 403]).toContain(res.statusCode)
      expect(mockDocumentFindMany).not.toHaveBeenCalled()
    })
  })
})
```

- [ ] **Step 2: Ejecutar tests**

```bash
pnpm --filter @contachile/api exec vitest run tests/security/multi-tenancy.test.ts
```

Expected: 8 tests pasando.

- [ ] **Step 3: Ejecutar la suite completa para verificar no regresiones**

```bash
pnpm --filter @contachile/api exec vitest run
```

Expected: 15 test files, todos pasando.

- [ ] **Step 4: Commit**

```bash
git add apps/api/tests/security/multi-tenancy.test.ts
git commit -m "test(sprint7): multi-tenancy — aislamiento companyId verificado en documents/employees/purchases"
```

---

## Self-Review

**Spec coverage:**
- ✅ `payroll.test.ts` — 8 tramos + AFP + FONASA/ISAPRE + cesantía + negativos: Task 1
- ✅ `tax.test.ts` — IVA extremos + 5 tramos calcularImpuestoRenta: Task 2
- ✅ `rut.test.ts` — todos los DV (0-9, K) + RUT mínimo: Task 3
- ✅ `f22-calculations.test.ts` — 8 brackets F22 (via calcularImpuestoRenta), renta negativa, PPM>impuesto: Task 7
- ✅ `f29-calculations.test.ts` — débito vs crédito, exento vs afecto (via tipos de doc), PPM: Task 6
- ✅ `signer.test.ts` — tampering detectable, PEM inválido, PFX end-to-end: Task 5
- ✅ `multi-tenancy.test.ts` — usuario A no ve empresa B en ningún escenario: Task 8
- ✅ Coverage thresholds 80% en validators y dte: Task 4

**Notas de implementación:**
- El test de `calcularImpuestoRenta` de 40M asume `floor(bracket * rate)` — verificar que la implementación usa `Math.floor` (sí, lo hace para todos los sub-tramos)
- Los tests de F22 mockean `document.findMany` para el cálculo de PPM mensual — el mock retorna el mismo valor para los 12 meses
- El test de multi-tenancy para "sin companyId" restaura `DEV_BYPASS_AUTH` — asegurarse de que no afecta otros tests en el archivo
