import type { Metadata } from "next"
import { InstallBanner } from "@/components/layout/install-banner"

export const metadata: Metadata = {
  title: "Autenticación",
  robots: { index: false, follow: false },
}

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col bg-paper">
      <InstallBanner />
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">{children}</div>
      </div>
    </div>
  )
}
