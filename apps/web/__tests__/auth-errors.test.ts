import { mapAuthError } from "@/lib/auth-errors"

describe("mapAuthError", () => {
  it("mapea 'Invalid email or password' a mensaje específico", () => {
    expect(mapAuthError("Invalid email or password")).toBe(
      "La contraseña es incorrecta. Verifica e intenta de nuevo."
    )
  })

  it("funciona con mayúsculas/minúsculas mixtas", () => {
    expect(mapAuthError("INVALID EMAIL OR PASSWORD")).toBe(
      "La contraseña es incorrecta. Verifica e intenta de nuevo."
    )
  })

  it("mapea 'user not found'", () => {
    expect(mapAuthError("user not found")).toBe(
      "No existe una cuenta con este email."
    )
  })

  it("mapea 'account not found'", () => {
    expect(mapAuthError("account not found")).toBe(
      "No existe una cuenta con este email."
    )
  })

  it("mapea 'email is required'", () => {
    expect(mapAuthError("email is required")).toBe("El email es obligatorio.")
  })

  it("mapea 'password is required'", () => {
    expect(mapAuthError("password is required")).toBe(
      "La contraseña es obligatoria."
    )
  })

  it("mapea 'too many attempts'", () => {
    expect(mapAuthError("too many attempts")).toBe(
      "Demasiados intentos. Espera unos minutos e intenta de nuevo."
    )
  })

  it("retorna el mensaje original si no hay mapeo", () => {
    expect(mapAuthError("Error desconocido")).toBe("Error desconocido")
  })

  it("retorna fallback para string vacío", () => {
    expect(mapAuthError("")).toBe("Error al iniciar sesión")
  })
})
