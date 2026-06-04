export function mapAuthError(message: string): string {
  const m = message.toLowerCase()
  if (m.includes("invalid email or password"))
    return "La contraseña es incorrecta. Verifica e intenta de nuevo."
  if (m.includes("user not found") || m.includes("account not found"))
    return "No existe una cuenta con este email."
  if (m.includes("email is required")) return "El email es obligatorio."
  if (m.includes("password is required")) return "La contraseña es obligatoria."
  if (m.includes("too many attempts"))
    return "Demasiados intentos. Espera unos minutos e intenta de nuevo."
  return message || "Error al iniciar sesión"
}
