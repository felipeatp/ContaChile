export interface PasswordStrengthResult {
  score: number
  label: string
  color: string
}

export function getPasswordStrength(password: string): PasswordStrengthResult {
  const hasLength = password.length >= 8
  const hasUpper = /[A-Z]/.test(password)
  const hasNumber = /[0-9]/.test(password)
  const hasSymbol = /[^A-Za-z0-9]/.test(password)

  // Si no cumple longitud mínima, score máximo es 1 (Débil)
  let score = 0
  if (hasLength) score++
  if (hasLength && hasUpper) score++
  if (hasLength && hasNumber) score++
  if (hasLength && hasSymbol) score++

  const labels = ["Muy corta", "Débil", "Regular", "Buena", "Fuerte"]
  const colors = [
    "bg-muted-foreground/20",
    "bg-destructive",
    "bg-ochre",
    "bg-sage",
    "bg-sage",
  ]

  return { score, label: labels[score], color: colors[score] }
}
