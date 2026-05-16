import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * Editorial divider with optional ornament (diamond).
 *
 * <RuleOrnament /> — plain horizontal rule
 * <RuleOrnament ornament="diamond" />
 * <RuleOrnament>Sección</RuleOrnament>  (texto centrado entre dos líneas)
 */
interface RuleOrnamentProps extends React.HTMLAttributes<HTMLDivElement> {
  ornament?: "diamond" | "dot" | "none"
}

export function RuleOrnament({
  ornament = "diamond",
  children,
  className,
  ...props
}: RuleOrnamentProps) {
  const symbol =
    ornament === "diamond" ? "◇" : ornament === "dot" ? "•" : null
  return (
    <div className={cn("rule-ornament", className)} {...props}>
      {children ? (
        <span className="px-3 text-muted-foreground eyebrow">{children}</span>
      ) : symbol ? (
        <span className="px-3 text-muted-foreground/60 text-sm">{symbol}</span>
      ) : null}
    </div>
  )
}
