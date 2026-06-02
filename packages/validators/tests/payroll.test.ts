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
    it('Tramo 4 (13.5%): bruto 4.5M — baseInUtm en rango 50-70', () => {
      const r = calcularLiquidacion({
        baseSalary: 4_500_000,
        afp: 'HABITAT',
        healthPlan: 'FONASA',
        contractType: 'INDEFINIDO',
        utmValue: 67_000,
      })
      // afp=507_150, salud=315_000, cesantia=27_000
      // baseImponible=3_650_850; baseInUtm=54.4903 → tramo 4
      // taxInUtm = 54.4903 * 0.135 - 4.49 = 2.8656... → round(2.8656 * 67_000) = 192_035
      expect(r.afp).toBe(507_150)
      expect(r.salud).toBe(315_000)
      expect(r.cesantia).toBe(27_000)
      expect(r.baseImponible).toBe(3_650_850)
      expect(r.impuesto).toBe(192_035)
      expect(r.liquido).toBe(3_458_815)
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
      // afp=676_200, salud=420_000, cesantia=36_000
      // baseImponible=4_867_800; baseInUtm=72.6537 → tramo 5
      // taxInUtm = 72.6537 * 0.23 - 11.14 = 5.5681... → round(5.5681 * 67_000) = 373_214
      expect(r.afp).toBe(676_200)
      expect(r.salud).toBe(420_000)
      expect(r.cesantia).toBe(36_000)
      expect(r.baseImponible).toBe(4_867_800)
      expect(r.impuesto).toBe(373_214)
      expect(r.liquido).toBe(4_494_586)
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
