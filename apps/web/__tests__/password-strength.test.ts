import { getPasswordStrength } from "@/lib/password-strength"

describe("getPasswordStrength", () => {
  it("retorna 'Muy corta' y score 0 para string vacío", () => {
    const r = getPasswordStrength("")
    expect(r.score).toBe(0)
    expect(r.label).toBe("Muy corta")
    expect(r.color).toBe("bg-muted-foreground/20")
  })

  it("retorna 'Débil' cuando solo cumple longitud (>=8)", () => {
    const r = getPasswordStrength("abcdefgh")
    expect(r.score).toBe(1)
    expect(r.label).toBe("Débil")
    expect(r.color).toBe("bg-destructive")
  })

  it("retorna 'Regular' con longitud + mayúscula", () => {
    const r = getPasswordStrength("Abcdefgh")
    expect(r.score).toBe(2)
    expect(r.label).toBe("Regular")
    expect(r.color).toBe("bg-ochre")
  })

  it("retorna 'Buena' con longitud + mayúscula + número", () => {
    const r = getPasswordStrength("Abcdefg1")
    expect(r.score).toBe(3)
    expect(r.label).toBe("Buena")
    expect(r.color).toBe("bg-sage")
  })

  it("retorna 'Fuerte' con todos los criterios", () => {
    const r = getPasswordStrength("Abcdefg1!")
    expect(r.score).toBe(4)
    expect(r.label).toBe("Fuerte")
    expect(r.color).toBe("bg-sage")
  })

  it("score máximo 1 (Débil) si la contraseña es corta", () => {
    const r = getPasswordStrength("A1!")
    expect(r.score).toBe(0)
  })

  it("score máximo 1 (Débil) si solo cumple longitud", () => {
    const r = getPasswordStrength("abcdefgh")
    expect(r.score).toBe(1)
  })
})
