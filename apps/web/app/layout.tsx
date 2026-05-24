import type { Metadata } from "next"
import { Fraunces, DM_Sans, JetBrains_Mono } from "next/font/google"
import Script from "next/script"
import { Providers } from "./providers"
import { JsonLd } from "@/components/seo/json-ld"
import { WebVitals } from "@/components/web-vitals"
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
  name: "ContAI",
  url: "https://ContAI.cl",
  logo: "https://ContAI.cl/logo.png",
  sameAs: [
    "https://twitter.com/ContAI",
    "https://linkedin.com/company/ContAI",
  ],
}

export const metadata: Metadata = {
  title: {
    default: "ContAI - Facturación Electrónica para Chile",
    template: "%s | ContAI",
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
  authors: [{ name: "ContAI" }],
  creator: "ContAI",
  metadataBase: new URL("https://ContAI.cl"),
  openGraph: {
    type: "website",
    locale: "es_CL",
    url: "https://ContAI.cl",
    siteName: "ContAI",
    title: "ContAI - Facturación Electrónica para Chile",
    description:
      "Emite DTE, boletas y facturas electrónicas directamente al SII. Automatización contable con IA.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ContAI - Facturación Electrónica para Chile",
    description:
      "Emite DTE, boletas y facturas electrónicas directamente al SII.",
  },
  robots: {
    index: true,
    follow: true,
  },
  // PWA
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "ContAI",
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="es"
      suppressHydrationWarning
      className={`${fraunces.variable} ${dmSans.variable} ${jetBrainsMono.variable}`}
    >
      <body className="font-sans antialiased">
        <Script
          src="/polyfills/esbuild-name.js"
          strategy="beforeInteractive"
        />
        <WebVitals />
        <JsonLd data={organizationSchema} />
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
