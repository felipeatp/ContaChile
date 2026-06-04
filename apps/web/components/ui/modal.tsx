"use client"

import * as React from "react"
import { X } from "lucide-react"
import { AnimatePresence, motion } from "motion/react"
import { cn } from "@/lib/utils"

/**
 * Modal editorial reusable. Reemplaza los modals inline con backdrop
 * negro + card central por una versión consistente con el lenguaje
 * editorial (paper, border-only, animación motion).
 *
 * Uso:
 *   <Modal open={open} onClose={() => setOpen(false)} title="Nuevo asiento" eyebrow="Sección · Diario">
 *     <body content />
 *   </Modal>
 *
 * Props:
 *   - eyebrow: small-caps overhead (opcional)
 *   - title: serif display (opcional)
 *   - description: subtítulo bajo title (opcional)
 *   - size: ancho máximo. default md=42rem
 *   - onClose: cerrar con ESC o click fuera
 */

type ModalSize = "sm" | "md" | "lg" | "xl"

const sizeMap: Record<ModalSize, string> = {
  sm: "max-w-md",
  md: "max-w-2xl",
  lg: "max-w-3xl",
  xl: "max-w-5xl",
}

interface ModalProps {
  open: boolean
  onClose: () => void
  eyebrow?: React.ReactNode
  title?: React.ReactNode
  description?: React.ReactNode
  size?: ModalSize
  /** Mostrar el footer separado del scroll */
  footer?: React.ReactNode
  /** Padding del body. Default px-5 py-5. Pasar "0" para anular. */
  bodyClassName?: string
  /** Permite cerrar con backdrop click */
  dismissOnBackdrop?: boolean
  children: React.ReactNode
}

function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const selectors = [
    'a[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ]
  return Array.from(
    container.querySelectorAll<HTMLElement>(selectors.join(","))
  ).filter((el) => !el.hasAttribute("disabled") && el.offsetParent !== null)
}

export function Modal({
  open,
  onClose,
  eyebrow,
  title,
  description,
  size = "md",
  footer,
  bodyClassName,
  dismissOnBackdrop = true,
  children,
}: ModalProps) {
  const panelRef = React.useRef<HTMLDivElement>(null)
  const previousFocusRef = React.useRef<HTMLElement | null>(null)

  // ESC para cerrar + body scroll lock + focus management
  React.useEffect(() => {
    if (!open) return

    // Guardar foco previo
    previousFocusRef.current = document.activeElement as HTMLElement

    // Lock body scroll
    const prev = document.body.style.overflow
    document.body.style.overflow = "hidden"

    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose()
        return
      }
      if (e.key !== "Tab" || !panelRef.current) return

      const focusables = getFocusableElements(panelRef.current)
      if (focusables.length === 0) {
        e.preventDefault()
        return
      }

      const first = focusables[0]
      const last = focusables[focusables.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener("keydown", onKey)

    // Mover foco al primer elemento focusable o al panel
    requestAnimationFrame(() => {
      if (panelRef.current) {
        const focusables = getFocusableElements(panelRef.current)
        if (focusables.length > 0) {
          focusables[0].focus()
        } else {
          panelRef.current.focus()
        }
      }
    })

    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = prev
      // Restaurar foco
      previousFocusRef.current?.focus()
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="modal-portal"
          className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-[5vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-ink/55 backdrop-blur-[2px]"
            onClick={dismissOnBackdrop ? onClose : undefined}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          />

          {/* Panel */}
          <motion.div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            tabIndex={-1}
            className={cn(
              "relative w-full rounded-sm border border-border bg-paper",
              "shadow-[0_32px_80px_-16px_hsl(var(--ink)/0.4)]",
              "max-h-[90vh] flex flex-col outline-none",
              sizeMap[size]
            )}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {/* Header */}
            {(eyebrow || title || description) && (
              <header className="border-b border-border px-5 pt-5 pb-4 flex items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  {eyebrow && (
                    <div className="eyebrow !text-[0.6rem] mb-1.5">{eyebrow}</div>
                  )}
                  {title && (
                    <h2 className="font-display text-xl md:text-2xl font-semibold leading-tight tracking-tightest">
                      {title}
                    </h2>
                  )}
                  {description && (
                    <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                      {description}
                    </p>
                  )}
                </div>
                <button
                  onClick={onClose}
                  className="h-8 w-8 inline-flex items-center justify-center rounded-sm text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors shrink-0 -mt-1 -mr-1"
                  aria-label="Cerrar"
                >
                  <X className="h-4 w-4" />
                </button>
              </header>
            )}

            {/* Body */}
            <div
              className={cn(
                "flex-1 overflow-y-auto",
                bodyClassName ?? "px-5 py-5"
              )}
            >
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="border-t border-border bg-card/40 px-5 py-4">
                {footer}
              </div>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
