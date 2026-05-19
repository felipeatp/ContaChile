import type { Metadata } from "next"
import { Fraunces, DM_Sans, JetBrains_Mono } from "next/font/google"
import { ClerkProvider } from "@clerk/nextjs"
import { Providers } from "./providers"
import { JsonLd } from "@/components/seo/json-ld"
import "./globals.css"

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500", "600", "700", "900"],
  style: ["normal", "italic"],
  display: "swap",
})

const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  display: "swap",
})

const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  weight: ["400", "500", "600", "700"],
  display: "swap",
})

const organizationSchema = {
  "@context": "https://schema.org",
  "@type": "Organization",
  name: "ContaChile",
  url: "https://contachile.cl",
  logo: "https://contachile.cl/logo.png",
  sameAs: [
    "https://twitter.com/contachile",
    "https://linkedin.com/company/contachile",
  ],
}

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
      <html
        lang="es"
        suppressHydrationWarning
        className={`${fraunces.variable} ${dmSans.variable} ${jetBrainsMono.variable}`}
      >
        <body className="font-sans antialiased">
          <JsonLd data={organizationSchema} />
          <Providers>{children}</Providers>
        </body>
      </html>
    </ClerkProvider>
  )
}
