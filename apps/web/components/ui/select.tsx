import * as React from "react"
import { cn } from "@/lib/utils"

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {}

/**
 * Editorial select with custom caret.
 *
 * <Select value={...} onChange={...}>
 *   <option value="A">A</option>
 *   ...
 * </Select>
 */
const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, children, ...props }, ref) => {
    return (
      <select
        className={cn(
          "flex h-10 w-full appearance-none rounded-sm border border-input bg-card pl-3 pr-9 py-2 text-sm",
          "transition-colors cursor-pointer",
          "focus-visible:outline-none focus-visible:border-primary focus-visible:ring-1 focus-visible:ring-primary/30",
          "disabled:cursor-not-allowed disabled:opacity-50",
          // Custom caret arrow using CSS background-image
          "bg-[length:14px_14px] bg-[right_0.7rem_center] bg-no-repeat",
          "bg-[url(\"data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'/%3e%3c/svg%3e\")]",
          className
        )}
        ref={ref}
        {...props}
      >
        {children}
      </select>
    )
  }
)
Select.displayName = "Select"

export { Select }
