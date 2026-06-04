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

/* ── Field context for aria-describedby wiring ── */

interface FieldContextValue {
  errorId?: string
  hasError?: boolean
}

const FieldContext = React.createContext<FieldContextValue>({})

export function useFieldContext(): FieldContextValue {
  return React.useContext(FieldContext)
}

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
  const id = React.useId()
  const errorId = error ? `${id}-error` : undefined

  return (
    <FieldContext.Provider value={{ errorId, hasError: !!error }}>
      <div className={cn("space-y-0", className)}>
        {label && (
          <Label hint={hint} required={required}>
            {label}
          </Label>
        )}
        {children}
        {error && (
          <p id={errorId} className="mt-1.5 text-xs text-destructive" role="alert">
            {error}
          </p>
        )}
      </div>
    </FieldContext.Provider>
  )
}
