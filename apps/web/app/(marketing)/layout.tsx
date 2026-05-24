import type { Metadata } from "next"

export const metadata: Metadata = {
  title: {
    default: "ContAI - Facturación Electrónica para Chile",
    template: "%s | ContAI",
  },
}

// Layout minimal para páginas públicas (landing, contacto, blog futuro).
// No incluye sidebar ni shell autenticado.
export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
