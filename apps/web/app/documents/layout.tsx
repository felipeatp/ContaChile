import type { Metadata } from "next"

// Todas las páginas bajo /documents son privadas — no indexar
export const metadata: Metadata = {
  title: "Documentos",
  description: "Gestiona tus documentos tributarios electrónicos en ContaChile.",
  robots: { index: false, follow: false },
}

export default function DocumentsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
