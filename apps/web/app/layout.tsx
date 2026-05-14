import type { Metadata } from "next"
import { Inter } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { Sidebar } from "@/components/layout/sidebar"
import { Header } from "@/components/layout/header"
import { Providers } from "./providers"
import "./globals.css"

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: {
    default: "ContaChile - Facturación Electrónica para Chile",
    template: "%s | ContaChile",
  },
  description:
    "Emite DTE, boletas y facturas electrónicas directamente al SII. Automatización contable con IA para empresas chilenas.",
  keywords: [
    "facturación electrónica",
    "DTE Chile",
    "SII",
    "boleta electrónica",
    "factura electrónica",
    "contabilidad",
    "software contable Chile",
  ],
  authors: [{ name: "ContaChile" }],
  creator: "ContaChile",
  metadataBase: new URL("https://contachile.cl"),
  openGraph: {
    type: "website",
    locale: "es_CL",
    url: "https://contachile.cl",
    siteName: "ContaChile",
    title: "ContaChile - Facturación Electrónica para Chile",
    description:
      "Emite DTE, boletas y facturas electrónicas directamente al SII. Automatización contable con IA.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ContaChile - Facturación Electrónica para Chile",
    description:
      "Emite DTE, boletas y facturas electrónicas directamente al SII.",
  },
  robots: {
    index: true,
    follow: true,
  },
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
