"use client"

import { useRutInput } from "@/lib/rut-input"
import { Input } from "@/components/ui/input"

type Props = {
  id: string
  label: string
  value: string
  onChange: (raw: string) => void
  required?: boolean
  placeholder?: string
}

export function RutField({
  id,
  label,
  value,
  onChange,
  required,
  placeholder = "12.345.678-9",
}: Props) {
  const rut = useRutInput(value, onChange)
  const showError = !!value && !rut.isValid

  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="eyebrow !text-[0.65rem] text-foreground/70">
        {label}
        {required && <span className="text-primary ml-0.5">*</span>}
      </label>
      <Input
        id={id}
        value={rut.display}
        onChange={rut.onChange}
        placeholder={placeholder}
        aria-invalid={showError}
        aria-describedby={rut.error ? `${id}-error` : undefined}
        inputMode="text"
        autoComplete="off"
      />
      {rut.error && (
        <p
          id={`${id}-error`}
          role="alert"
          className="text-xs text-rust font-mono"
        >
          {rut.error}
        </p>
      )}
    </div>
  )
}
