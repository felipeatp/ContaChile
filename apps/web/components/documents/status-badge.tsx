interface StatusBadgeProps {
  status: string
}

const TONE: Record<string, string> = {
  ACCEPTED: "bg-sage/15 text-sage",
  PENDING: "bg-ochre/15 text-ochre",
  REJECTED: "bg-destructive/10 text-destructive",
  FAILED: "bg-destructive/10 text-destructive",
}
const LABEL: Record<string, string> = {
  ACCEPTED: "Aceptado",
  PENDING: "Pendiente",
  REJECTED: "Rechazado",
  FAILED: "Fallido",
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const tone = TONE[status] ?? "bg-secondary text-foreground/70"
  const label = LABEL[status] ?? status
  return (
    <span
      className={`inline-flex items-center text-[0.6rem] uppercase tracking-eyebrow font-semibold rounded-sm px-1.5 py-0.5 ${tone}`}
    >
      {label}
    </span>
  )
}
