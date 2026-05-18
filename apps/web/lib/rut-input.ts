"use client"

import { useCallback } from "react"
import { validateRUT, formatRUT } from "@contachile/validators"

export type RutInputResult = {
  /** value formateado para mostrar en el input (ej "12.345.678-5") */
  display: string
  /** value crudo solo dígitos+DV mayúscula (para enviar al backend) */
  raw: string
  /** true si validateRUT pasa */
  isValid: boolean
  /** mensaje de error legible, o null */
  error: string | null
  /** handler para onChange del <input>: extrae caracteres válidos */
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
}

/**
 * Hook para inputs de RUT chileno.
 * - El componente consumidor debe llamar onChange con el valor crudo.
 * - Mascarea con dots y dash al mostrar (display).
 * - isValid usa módulo 11 (validateRUT del package validators).
 */
export function useRutInput(
  value: string,
  setValue: (raw: string) => void
): RutInputResult {
  const raw = (value || "").replace(/[^0-9kK]/g, "").toUpperCase()
  const display = raw.length < 2 ? raw : formatRUT(raw)
  const isValid = raw ? validateRUT(raw) : false
  const error = (() => {
    if (!raw) return null
    if (raw.length < 8) return "RUT incompleto"
    if (!isValid) return "Dígito verificador inválido"
    return null
  })()

  const onChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const clean = e.target.value.replace(/[^0-9kK]/g, "").toUpperCase()
      setValue(clean)
    },
    [setValue]
  )

  return { display, raw, isValid, error, onChange }
}
