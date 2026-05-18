import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "Autenticación",
  robots: { index: false, follow: false },
}

// Layout minimal centrado para login / sign-up. Sin sidebar.
export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-paper px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </div>
  )
}
