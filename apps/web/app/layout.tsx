import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Providers } from "./providers"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "ContaChile - DTE Dashboard",
  description: "Facturación electrónica para Chile",
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <ClerkProvider>
      <html lang="es">
        <body className={inter.className}>
          <Providers>
            <Sidebar />
            <div className="lg:pl-64">
              <Header />
              <main className="container py-6">{children}</main>
            </div>
          </Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
