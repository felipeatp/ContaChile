"use client"

import { useEffect, useRef, useState } from "react"
import { animate, useInView } from "motion/react"

/**
 * AnimatedFigure: cuenta desde 0 hasta `value` cuando entra al viewport.
 *
 * Acepta un formateador para CLP, porcentajes, etc.
 *
 * <AnimatedFigure value={1234567} format={(n) => `$ ${n.toLocaleString('es-CL')}`} />
 */
interface AnimatedFigureProps {
  value: number
  format?: (n: number) => string
  duration?: number
  className?: string
  once?: boolean
}

export function AnimatedFigure({
  value,
  format = (n) => n.toLocaleString("es-CL"),
  duration = 1.1,
  className,
  once = true,
}: AnimatedFigureProps) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once, amount: 0.5 })

  useEffect(() => {
    if (!inView || !ref.current) return
    const el = ref.current
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        el.textContent = format(Math.round(v))
      },
    })
    return () => controls.stop()
  }, [inView, value, duration, format])

  return (
    <span ref={ref} className={className}>
      {format(0)}
    </span>
  )
}
