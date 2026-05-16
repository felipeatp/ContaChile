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
  const [displayed, setDisplayed] = useState(0)

  useEffect(() => {
    if (!inView) return
    const controls = animate(0, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => setDisplayed(v),
    })
    return () => controls.stop()
  }, [inView, value, duration])

  return (
    <span ref={ref} className={className}>
      {format(Math.round(displayed))}
    </span>
  )
}
