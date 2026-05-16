import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Stat editorial card.
 *
 * Layout:
 *   ┌─────────────────────────────┐
 *   │ EYEBROW LABEL ↗ (icon)      │  ← uppercase eyebrow + opt icon
 *   │                              │
 *   │  $ 1.234.567                 │  ← stat-figure (mono tabular)
 *   │  ─────────                   │  ← optional underline accent
 *   │  +12,3% vs mes anterior      │  ← optional caption
 *   └─────────────────────────────┘
 *
 * Usage:
 *   <Stat label="Emitidos hoy" value={42} tone="default" />
 *   <Stat label="IVA del mes" value="$1.234.567" tone="accent" delta="+12,3%" />
 */

export type StatTone = "default" | "accent" | "positive" | "negative" | "warning"

const toneStyles: Record<StatTone, string> = {
  default: "text-foreground",
  accent: "text-primary",
  positive: "text-sage",
  negative: "text-rust",
  warning: "text-ochre",
}

const accentBarStyles: Record<StatTone, string> = {
  default: "bg-foreground/15",
  accent: "bg-primary",
  positive: "bg-sage",
  negative: "bg-rust",
  warning: "bg-ochre",
}

interface StatProps extends React.HTMLAttributes<HTMLDivElement> {
  label: string
  value: React.ReactNode
  tone?: StatTone
  caption?: React.ReactNode
  delta?: React.ReactNode
  icon?: React.ReactNode
  /** if true, render the small accent bar under the figure */
  underline?: boolean
}

export const Stat = React.forwardRef<HTMLDivElement, StatProps>(
  ({ label, value, tone = "default", caption, delta, icon, underline = true, className, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "card-editorial p-5 group relative overflow-hidden",
          className
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <span className="eyebrow">{label}</span>
          {icon && (
            <span className="text-muted-foreground/70 transition-colors group-hover:text-foreground">
              {icon}
            </span>
          )}
        </div>
        <div className={cn("stat-figure", toneStyles[tone])}>
          {value}
        </div>
        {underline && (
          <div className={cn("mt-3 h-px w-10 transition-all duration-300 group-hover:w-20", accentBarStyles[tone])} />
        )}
        {(caption || delta) && (
          <div className="mt-3 flex items-baseline gap-2 text-xs">
            {delta && (
              <span className={cn("font-medium tabular", toneStyles[tone])}>
                {delta}
              </span>
            )}
            {caption && (
              <span className="text-muted-foreground">{caption}</span>
            )}
          </div>
        )}
      </div>
    )
  }
)
Stat.displayName = "Stat"
