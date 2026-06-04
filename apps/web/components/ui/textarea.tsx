import * as React from "react"
import { cn } from "@/lib/utils"
import { useFieldContext } from "./field"

export interface TextareaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, "aria-describedby": ariaDescribedBy, "aria-invalid": ariaInvalid, ...props }, ref) => {
    const field = useFieldContext()
    const mergedDescribedBy = [field.errorId, ariaDescribedBy].filter(Boolean).join(" ") || undefined
    const mergedInvalid = ariaInvalid ?? (field.hasError ? "true" : undefined)

    return (
      <textarea
        className={cn(
          "flex min-h-[80px] w-full rounded-sm border border-input bg-card px-3 py-2 text-sm",
          "transition-colors resize-y",
          "placeholder:text-muted-foreground/60",
          "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
          className
        )}
        ref={ref}
        aria-describedby={mergedDescribedBy}
        aria-invalid={mergedInvalid}
        {...props}
      />
    )
  }
)
Textarea.displayName = "Textarea"

export { Textarea }
