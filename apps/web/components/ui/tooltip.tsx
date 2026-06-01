"use client"

import * as React from "react"
import { cn } from "@/lib/utils"
import { HelpCircle } from "lucide-react"

interface TooltipProps {
  content: string
  children?: React.ReactNode
  className?: string
}

export function Tooltip({ content, children, className }: TooltipProps) {
  return (
    <span className={cn("relative group inline-flex items-center", className)}>
      {children ?? (
        <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/50 cursor-help" aria-hidden="true" />
      )}
      <span
        role="tooltip"
        className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-60 rounded-sm border border-border bg-paper px-2.5 py-2 text-xs text-foreground shadow-md opacity-0 pointer-events-none group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity z-50 leading-relaxed"
      >
        {content}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-border" />
      </span>
    </span>
  )
}
