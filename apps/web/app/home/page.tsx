import Script from "next/script"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  FileText,
  Shield,
  Zap,
  BarChart3,
  Check,
  ArrowRight,
  Mail,
  Building2,
} from "lucide-react"

export const metadata = {
  title: "ContaChile - Facturación Electrónica para Chile",
  description:
    "Emite DTE, boletas y facturas electrónicas directamente al SII. Automatización contable con IA para empresas chilenas.",
  alternates: {
    canonical: "/home",
  },
}

const structuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "ContaChile",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  offers: {
    "@type": "Offer",
    price: "29900",
    priceCurrency: "CLP",
    priceValidUntil: "2026-12-31",
  },
  aggregateRating: {
    "@type": "AggregateRating",
    ratingValue: "4.8",
    ratingCount: "127",
  },
  description:
    "Software de facturación electrónica para Chile. Emite DTE, boletas y facturas directamente al SII.",
  url: "https://contachile.cl",
  publisher: {
    "@type": "Organization",
    name: "ContaChile",
    logo: {
      "@type": "ImageObject",
      url: "https://contachile.cl/logo.png",
    },
  },
}

export default function HomePage() {
  return (
    <>
      <Script
        id="structured-data"
        type="application/ld+json"
        strategy="beforeInteractive"
      >
        {JSON.stringify(structuredData)}
      </Script>
      <div className="flex flex-col min-h-screen">
      {/* Navigation */}
      <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center space-x-2">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">CC</span>
            </div>
            <span className="font-bold text-xl">ContaChile</span>
          </div>
          <nav className="hidden md:flex items-center space-x-6">
            <a href="#features" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Características
            </a>
            <a href="#pricing" className="text-sm font-medium text-muted-foreground hover:text-foreground">
              Precios
            </a>
            <Link href="/login">
              <Button variant="ghost">Iniciar sesión</Button>
            </Link>
            <Link href="/sign-up">
              <Button>Probar gratis</Button>
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden py-20 lg:py-32">
        <div className="container relative z-10">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center rounded-full border px-3 py-1 text-sm font-medium mb-6">
              <span className="flex h-2 w-2 rounded-full bg-green-500 mr-2" />
              Certificación SII en proceso
            </div>
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl mb-6">
              Facturación electrónica
              <span className="text-primary"> sin complicaciones</span>
            </h1>
            <p className="text-lg text-muted-foreground mb-8 max-w-2xl mx-auto">
              Emite DTE, boletas y facturas directamente al SII desde una plataforma moderna.
              Automatiza tu contabilidad con inteligencia artificial.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/sign-up">
                <Button size="lg" className="text-lg px-8">
                  Empezar gratis
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
              <Link href="/login">
                <Button size="lg" variant="outline" className="text-lg px-8">
                  Ver demo
                </Button>
              </Link>
            </div>
          </div>
        </div>
        {/* Gradient background */}
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background" />
      </section>

      {/* Features */}
      <section id="features" className="py-20 bg-muted/50">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Todo lo que necesitas para cumplir</h2>
            <p className="text-muted-foreground max-w-2xl mx-auto">
              Desde la emisión de documentos tributarios hasta la automatización contable completa.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: FileText,
                title: "DTE al SII",
                desc: "Emite facturas, boletas, notas de crédito y más directamente al SII.",
              },
              {
                icon: Shield,
                title: "Firma digital",
                desc: "Firma tus documentos con certificado digital de forma segura.",
              },
              {
                icon: Zap,
                title: "Automatización IA",
                desc: "Agentes de IA que clasifican transacciones y preparan declaraciones.",
              },
              {
                icon: BarChart3,
                title: "Reportes en tiempo real",
                desc: "Dashboard con métricas de ventas, IVA y estado de documentos.",
              },
            ].map((feature) => (
              <Card key={feature.title} className="border-0 shadow-none bg-background">
                <CardContent className="pt-6">
                  <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                    <feature.icon className="h-5 w-5 text-primary" />
                  </div>
                  <h3 className="font-semibold mb-2">{feature.title}</h3>
                  <p className="text-sm text-muted-foreground">{feature.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Emite en 3 pasos</h2>
          </div>
          <div className="grid gap-8 md:grid-cols-3">
            {[
              {
                step: "01",
                title: "Completa el formulario",
                desc: "Ingresa los datos del receptor y los items. Calculamos el IVA automáticamente.",
              },
              {
                step: "02",
                title: "Firma y envía",
                desc: "El sistema firma digitalmente y envía al SII o vía bridge Acepta.",
              },
              {
                step: "03",
                title: "Recibe la respuesta",
                desc: "Monitoreamos el estado en tiempo real y notificamos cuando sea aceptado.",
              },
            ].map((item) => (
              <div key={item.step} className="relative">
                <div className="text-5xl font-bold text-muted/20 mb-4">{item.step}</div>
                <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                <p className="text-muted-foreground">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 bg-muted/50">
        <div className="container">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold mb-4">Precios simples</h2>
            <p className="text-muted-foreground">Sin contratos de permanencia. Cancela cuando quieras.</p>
          </div>
          <div className="grid gap-6 md:grid-cols-3 max-w-4xl mx-auto">
            {[
              {
                name: "Inicio",
                price: "$0",
                period: "para siempre",
                desc: "Perfecto para probar la plataforma",
                features: [
                  "Hasta 10 documentos/mes",
                  "Tipos 33 y 39",
                  "Dashboard básico",
                  "Soporte por email",
                ],
                cta: "Empezar gratis",
                popular: false,
              },
              {
                name: "Profesional",
                price: "$29.900",
                period: "CLP/mes",
                desc: "Para emprendedores y pymes",
                features: [
                  "Documentos ilimitados",
                  "Todos los tipos de DTE",
                  "Firma digital incluida",
                  "Reportes avanzados",
                  "API access",
                  "Soporte prioritario",
                ],
                cta: "Comenzar prueba",
                popular: true,
              },
              {
                name: "Empresa",
                price: "$89.900",
                period: "CLP/mes",
                desc: "Para empresas con alto volumen",
                features: [
                  "Todo lo de Profesional",
                  "Múltiples usuarios",
                  "Agentes IA avanzados",
                  "Integración contable",
                  "Soporte dedicado",
                  "SLA garantizado",
                ],
                cta: "Contactar ventas",
                popular: false,
              },
            ].map((plan) => (
              <Card
                key={plan.name}
                className={`flex flex-col ${plan.popular ? "border-primary shadow-lg" : ""}`}
              >
                <CardContent className="pt-6 flex-1">
                  {plan.popular && (
                    <div className="inline-block rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground mb-4">
                      Más popular
                    </div>
                  )}
                  <h3 className="text-lg font-semibold">{plan.name}</h3>
                  <div className="mt-2 mb-4">
                    <span className="text-4xl font-bold">{plan.price}</span>
                    <span className="text-muted-foreground"> / {plan.period}</span>
                  </div>
                  <p className="text-sm text-muted-foreground mb-6">{plan.desc}</p>
                  <ul className="space-y-3 mb-6">
                    {plan.features.map((f) => (
                      <li key={f} className="flex items-center text-sm">
                        <Check className="h-4 w-4 text-green-500 mr-2 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </CardContent>
                <div className="p-6 pt-0">
                  <Button className="w-full" variant={plan.popular ? "default" : "outline"}>
                    {plan.cta}
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20">
        <div className="container">
          <div className="mx-auto max-w-3xl text-center">
            <h2 className="text-3xl font-bold mb-4">¿Listo para simplificar tu facturación?</h2>
            <p className="text-muted-foreground mb-8">
              Únete a cientos de empresas chilenas que ya usan ContaChile para cumplir con el SII.
            </p>
            <Link href="/sign-up">
              <Button size="lg" className="text-lg px-8">
                Crear cuenta gratis
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12 bg-muted/30">
        <div className="container">
          <div className="grid gap-8 md:grid-cols-4">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">CC</span>
                </div>
                <span className="font-bold text-xl">ContaChile</span>
              </div>
              <p className="text-sm text-muted-foreground">
                Facturación electrónica y contabilidad automatizada para empresas chilenas.
              </p>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Producto</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <a href="#features" className="hover:text-foreground">
                    Características
                  </a>
                </li>
                <li>
                  <a href="#pricing" className="hover:text-foreground">
                    Precios
                  </a>
                </li>
                <li>
                  <span className="hover:text-foreground cursor-pointer">API</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Empresa</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <span className="hover:text-foreground cursor-pointer">Nosotros</span>
                </li>
                <li>
                  <span className="hover:text-foreground cursor-pointer">Blog</span>
                </li>
                <li>
                  <span className="hover:text-foreground cursor-pointer">Contacto</span>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-4">Legal</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li>
                  <span className="hover:text-foreground cursor-pointer">Términos</span>
                </li>
                <li>
                  <span className="hover:text-foreground cursor-pointer">Privacidad</span>
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t flex flex-col md:flex-row items-center justify-between text-sm text-muted-foreground">
            <p>© 2026 ContaChile. Todos los derechos reservados.</p>
            <div className="flex items-center space-x-4 mt-4 md:mt-0">
              <Mail className="h-4 w-4" />
              <span>hola@contachile.cl</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
    </>
  )
}
