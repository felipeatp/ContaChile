import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Editorial label component.
 *
 * <Label htmlFor="rut">RUT</Label>
 * <Input id="rut" ... />
 */
interface LabelProps extends React.LabelHTMLAttributes<HTMLLabelElement> {
  hint?: React.ReactNode
  required?: boolean
}

export const Label = React.forwardRef<HTMLLabelElement, LabelProps>(
  ({ className, children, hint, required, ...props }, ref) => (
    <label
      ref={ref}
      className={cn(
        "flex items-baseline justify-between mb-1.5 text-[0.65rem] font-semibold uppercase tracking-eyebrow text-foreground/70",
        className
      )}
      {...props}
    >
      <span>
        {children}
        {required && <span className="text-primary ml-0.5">*</span>}
      </span>
      {hint && (
        <span className="!normal-case !tracking-normal !text-muted-foreground/60 !font-normal text-[0.7rem]">
          {hint}
        </span>
      )}
    </label>
  )
)
Label.displayName = "Label"

/**
 * Field wraps a label + input + optional error/hint in editorial style.
 *
 * <Field label="RUT" required hint="módulo 11">
 *   <Input ... />
 * </Field>
 */
interface FieldProps {
  label?: React.ReactNode
  hint?: React.ReactNode
  error?: React.ReactNode
  required?: boolean
  className?: string
  children: React.ReactNode
}

export function Field({
  label,
  hint,
  error,
  required,
  className,
  children,
}: FieldProps) {
  return (
    <div className={cn("space-y-0", className)}>
      {label && (
        <Label hint={hint} required={required}>
          {label}
        </Label>
      )}
      {children}
      {error && (
        <p className="mt-1.5 text-xs text-destructive">{error}</p>
      )}
    </div>
  )
}
