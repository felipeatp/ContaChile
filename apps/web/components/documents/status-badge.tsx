import { Badge } from "@/components/ui/badge"

interface StatusBadgeProps {
  status: string
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const variant =
    status === "ACCEPTED"
      ? "default"
      : status === "PENDING"
      ? "secondary"
      : status === "REJECTED" || status === "FAILED"
      ? "destructive"
      : "outline"

  const label =
    status === "ACCEPTED"
      ? "Aceptado"
      : status === "PENDING"
      ? "Pendiente"
      : status === "REJECTED"
      ? "Rechazado"
      : status === "FAILED"
      ? "Fallido"
      : status

  return <Badge variant={variant}>{label}</Badge>
}
