import Script from "next/script"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import {
  FileText,
  Shield,
  BarChart3,
  Check,
  ArrowRight,
  Mail,
  Sparkles,
} from "lucide-react"

export const metadata = {
  title: "ContaChile - Facturación Electrónica para Chile",
  description:
    "Emite DTE, boletas y facturas electrónicas directamente al SII. Automatización contable con IA para empresas chilenas.",
  alternates: { canonical: "/" },
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
}

const features = [
  {
    no: "01",
    icon: FileText,
    title: "DTE directo al SII",
    desc: "Facturas, boletas, notas de crédito y débito. Firma digital incluida, envío al servidor del SII en menos de un segundo.",
  },
  {
    no: "02",
    icon: Sparkles,
    title: "Agentes IA dedicados",
    desc: "Consultor tributario, clasificador de transacciones bancarias, asistente F22. Conversan con tu plan de cuentas real.",
  },
  {
    no: "03",
    icon: Shield,
    title: "Cumplimiento sin fricción",
    desc: "F29 mensual, F22 anual, PreviRed, DDJJ 1887. Alertas de vencimiento automáticas. Cierre del año en horas, no semanas.",
  },
  {
    no: "04",
    icon: BarChart3,
    title: "Reportes editoriales",
    desc: "Balance de comprobación, estado de resultados, balance general. Cifras claras, jerarquía pensada para contadores.",
  },
]

const pricing = [
  {
    name: "Inicio",
    price: "$0",
    period: "para siempre",
    desc: "Para probar la plataforma con datos reales.",
    features: [
      "Hasta 10 documentos / mes",
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
    period: "CLP / mes",
    desc: "Para emprendedores y pymes que facturan en serio.",
    features: [
      "Documentos ilimitados",
      "Todos los tipos de DTE",
      "Firma digital incluida",
      "Conciliación bancaria + IA",
      "Libro diario y mayor",
      "F29 y F22 automatizados",
      "Soporte prioritario",
    ],
    cta: "Comenzar prueba",
    popular: true,
  },
  {
    name: "Empresa",
    price: "$89.900",
    period: "CLP / mes",
    desc: "Para empresas con volumen y equipo contable.",
    features: [
      "Todo lo de Profesional",
      "Múltiples usuarios + roles",
      "Agentes IA con tool-use",
      "API pública + webhooks",
      "Integración Fintoc",
      "SLA garantizado",
    ],
    cta: "Contactar ventas",
    popular: false,
  },
]

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
        <header className="sticky top-0 z-50 w-full border-b border-border bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/70">
          <div className="container flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="relative h-9 w-9 border border-foreground bg-paper flex items-center justify-center">
                <span className="font-display text-base font-black leading-none text-foreground">
                  C
                </span>
                <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 bg-primary" />
              </div>
              <div className="leading-none">
                <span className="block font-display text-lg font-semibold tracking-tightest">
                  ContaChile
                </span>
                <span className="block eyebrow !text-[0.55rem] !tracking-[0.2em] mt-0.5 text-muted-foreground/70">
                  Edición Financiera
                </span>
              </div>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <a
                href="#caracteristicas"
                className="eyebrow hover:text-foreground transition-colors"
              >
                Características
              </a>
              <a
                href="#precios"
                className="eyebrow hover:text-foreground transition-colors"
              >
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

        {/* HERO */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="container py-16 lg:py-24 relative z-10">
            <div className="grid lg:grid-cols-12 gap-8 lg:gap-12 items-end">
              <div className="lg:col-span-7">
                <div className="flex items-center gap-3 mb-6 flex-wrap">
                  <span className="inline-flex items-center eyebrow">
                    <span className="mr-2 flex h-1.5 w-1.5 rounded-full bg-sage animate-pulse" />
                    Certificación SII en proceso
                  </span>
                  <span className="h-px w-16 bg-foreground/20" />
                  <span className="eyebrow text-muted-foreground/70">
                    Vol. I · Ed. {new Date().getFullYear()}
                  </span>
                </div>
                <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-semibold leading-[0.95] tracking-tightest text-foreground">
                  Contabilidad chilena{" "}
                  <em className="text-primary not-italic font-medium">
                    con cabeza
                  </em>{" "}
                  editorial.
                </h1>
                <p className="mt-8 text-lg text-muted-foreground max-w-xl leading-relaxed">
                  Emite DTE al SII, lleva libro diario y mayor, declara F29 y
                  F22, gestiona remuneraciones e inventario. Una sola
                  plataforma. Sin formularios eternos. Sin tablas que se
                  desbordan.
                </p>
                <div className="mt-10 flex flex-wrap gap-3 items-center">
                  <Link href="/sign-up">
                    <Button size="lg">
                      Empezar gratis
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  </Link>
                  <Link href="/login">
                    <Button size="lg" variant="outline">
                      Ver demo
                    </Button>
                  </Link>
                  <span className="text-xs text-muted-foreground/70 ml-1">
                    Sin tarjeta · Cancela cuando quieras
                  </span>
                </div>
              </div>

              <div className="lg:col-span-5 hidden lg:block">
                <div className="relative">
                  <div className="card-editorial p-6 rotate-[1deg] shadow-[0_24px_48px_-12px_hsl(var(--ink)/0.12)]">
                    <div className="flex items-center justify-between mb-4">
                      <span className="eyebrow">IVA · Mayo 2026</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        F29 · cód. 538
                      </span>
                    </div>
                    <div className="stat-figure !text-5xl !font-bold text-primary">
                      $ 1.847.293
                    </div>
                    <div className="mt-2 h-px w-16 bg-primary" />
                    <div className="mt-4 flex items-baseline gap-2 text-xs">
                      <span className="text-sage font-medium tabular">
                        +12,3 %
                      </span>
                      <span className="text-muted-foreground">vs Abril</span>
                    </div>

                    <div className="mt-6 pt-4 border-t border-border space-y-2 text-xs">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Débito fiscal
                        </span>
                        <span className="font-mono">$ 4.221.480</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">
                          Crédito fiscal
                        </span>
                        <span className="font-mono">$ 2.374.187</span>
                      </div>
                      <div className="flex justify-between font-medium pt-1 border-t border-border/50">
                        <span>A pagar</span>
                        <span className="font-mono text-primary">
                          $ 1.847.293
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="card-editorial p-4 -mt-10 ml-12 rotate-[-2deg] max-w-[18rem] shadow-[0_16px_36px_-12px_hsl(var(--ink)/0.1)]">
                    <span className="eyebrow">Asiento automático</span>
                    <div className="mt-2 space-y-1 text-xs font-mono tabular">
                      <div className="flex justify-between text-muted-foreground">
                        <span>1103 Clientes</span>
                        <span className="text-foreground">$ 119.000</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>4100 Ventas</span>
                        <span className="text-foreground">($ 100.000)</span>
                      </div>
                      <div className="flex justify-between text-muted-foreground">
                        <span>2111 IVA Débito</span>
                        <span className="text-foreground">($ 19.000)</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="pointer-events-none absolute -bottom-12 -right-24 select-none text-[28rem] font-display font-black leading-none text-primary/[0.025] hidden lg:block">
            ¶
          </div>
        </section>

        {/* FEATURES */}
        <section
          id="caracteristicas"
          className="py-20 border-b border-border"
        >
          <div className="container">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
              <div className="max-w-xl">
                <span className="eyebrow block mb-3">
                  I · Lo que incluye
                </span>
                <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tightest">
                  Una redacción contable{" "}
                  <em className="text-primary not-italic font-medium">
                    completa
                  </em>
                  .
                </h2>
              </div>
              <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
                Lo que tu contador necesita, en la misma pantalla. Sin
                pestañas perdidas, sin Excel paralelos.
              </p>
            </div>

            <div className="grid gap-px bg-border md:grid-cols-2 lg:grid-cols-4 border border-border">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="bg-paper p-6 group transition-colors hover:bg-secondary/40"
                >
                  <div className="flex items-start justify-between mb-6">
                    <span className="font-display text-3xl font-bold text-muted-foreground/40 tracking-tightest">
                      {f.no}
                    </span>
                    <f.icon className="h-5 w-5 text-primary opacity-70 group-hover:opacity-100 transition-opacity" />
                  </div>
                  <h3 className="font-display text-lg font-semibold mb-2 tracking-tightest">
                    {f.title}
                  </h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {f.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* HOW IT WORKS */}
        <section className="py-20 border-b border-border bg-secondary/30">
          <div className="container">
            <div className="text-center mb-14">
              <span className="eyebrow block mb-3">II · Tres pasos</span>
              <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tightest max-w-2xl mx-auto">
                Del formulario al{" "}
                <em className="text-primary not-italic font-medium">
                  XML firmado
                </em>{" "}
                en segundos.
              </h2>
            </div>
            <div className="grid gap-12 md:grid-cols-3">
              {[
                {
                  step: "01",
                  title: "Completa",
                  desc: "Receptor, items, forma de pago. Calculamos el IVA. Validamos el RUT con módulo 11.",
                },
                {
                  step: "02",
                  title: "Firma",
                  desc: "Pipeline DTE: XML ISO-8859-1, firma xmldsig con tu certificado digital, envoltura EnvioDTE.",
                },
                {
                  step: "03",
                  title: "Distribuye",
                  desc: "Envío al SII (o bridge Acepta), polling de estado en BullMQ, email al receptor cuando es aceptado.",
                },
              ].map((item, i) => (
                <div key={item.step} className="relative">
                  <div className="flex items-baseline gap-4 mb-4">
                    <span className="font-display text-6xl font-black text-primary/15 leading-none">
                      {item.step}
                    </span>
                    <h3 className="font-display text-2xl font-semibold tracking-tightest">
                      {item.title}
                    </h3>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed max-w-sm">
                    {item.desc}
                  </p>
                  {i < 2 && (
                    <div className="hidden md:block absolute top-6 -right-6 text-muted-foreground/30 font-mono text-sm">
                      ⟶
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* PRICING */}
        <section id="precios" className="py-20 border-b border-border">
          <div className="container">
            <div className="text-center mb-14">
              <span className="eyebrow block mb-3">III · Suscripciones</span>
              <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tightest">
                Precios{" "}
                <em className="text-primary not-italic font-medium">
                  directos
                </em>
                .
              </h2>
              <p className="text-muted-foreground text-sm mt-3">
                Sin contratos de permanencia. Cancela cuando quieras.
              </p>
            </div>

            <div className="grid gap-px md:grid-cols-3 max-w-5xl mx-auto border border-border bg-border">
              {pricing.map((plan) => (
                <div
                  key={plan.name}
                  className={`flex flex-col bg-paper p-8 relative ${plan.popular ? "bg-secondary/40" : ""}`}
                >
                  {plan.popular && (
                    <span className="absolute top-0 right-0 bg-primary text-primary-foreground eyebrow !text-[0.55rem] px-2.5 py-1">
                      Más popular
                    </span>
                  )}
                  <h3 className="font-display text-2xl font-semibold tracking-tightest mb-1">
                    {plan.name}
                  </h3>
                  <p className="text-xs text-muted-foreground mb-5">
                    {plan.desc}
                  </p>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className="font-mono text-4xl font-bold tracking-tightest tabular">
                      {plan.price}
                    </span>
                  </div>
                  <span className="text-xs text-muted-foreground mb-6">
                    {plan.period}
                  </span>

                  <div className="h-px bg-border mb-5" />

                  <ul className="space-y-2.5 mb-8 flex-1">
                    {plan.features.map((f) => (
                      <li
                        key={f}
                        className="flex items-start text-sm text-foreground/80"
                      >
                        <Check className="h-3.5 w-3.5 text-primary mr-2 mt-1 shrink-0" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>

                  <Button
                    className="w-full"
                    variant={plan.popular ? "default" : "outline"}
                  >
                    {plan.cta}
                  </Button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 relative overflow-hidden">
          <div className="container relative z-10">
            <div className="mx-auto max-w-3xl text-center">
              <span className="eyebrow block mb-3">Próxima edición</span>
              <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tightest mb-4">
                Tu mejor mes contable{" "}
                <em className="text-primary not-italic font-medium">
                  empieza ahora
                </em>
                .
              </h2>
              <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
                Únete a cientos de pymes chilenas que ya simplificaron su
                cumplimiento tributario.
              </p>
              <Link href="/sign-up">
                <Button size="lg">
                  Crear cuenta gratis
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
          <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 select-none text-[20rem] font-display font-black leading-none text-primary/[0.03]">
            ¶
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border py-12 bg-secondary/30">
          <div className="container">
            <div className="grid gap-8 md:grid-cols-4">
              <div>
                <div className="flex items-center gap-2.5 mb-4">
                  <div className="relative h-9 w-9 border border-foreground bg-paper flex items-center justify-center">
                    <span className="font-display text-base font-black leading-none">
                      C
                    </span>
                    <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 bg-primary" />
                  </div>
                  <span className="font-display text-lg font-semibold tracking-tightest">
                    ContaChile
                  </span>
                </div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Facturación electrónica y contabilidad automatizada para
                  empresas chilenas. Hecho con cariño en Santiago.
                </p>
              </div>
              <div>
                <h4 className="eyebrow mb-4">Producto</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <a
                      href="#caracteristicas"
                      className="hover:text-foreground transition-colors"
                    >
                      Características
                    </a>
                  </li>
                  <li>
                    <a
                      href="#precios"
                      className="hover:text-foreground transition-colors"
                    >
                      Precios
                    </a>
                  </li>
                  <li>
                    <span className="hover:text-foreground cursor-pointer transition-colors">
                      API
                    </span>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="eyebrow mb-4">Empresa</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <span className="hover:text-foreground cursor-pointer transition-colors">
                      Nosotros
                    </span>
                  </li>
                  <li>
                    <span className="hover:text-foreground cursor-pointer transition-colors">
                      Blog
                    </span>
                  </li>
                  <li>
                    <span className="hover:text-foreground cursor-pointer transition-colors">
                      Contacto
                    </span>
                  </li>
                </ul>
              </div>
              <div>
                <h4 className="eyebrow mb-4">Legal</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <span className="hover:text-foreground cursor-pointer transition-colors">
                      Términos
                    </span>
                  </li>
                  <li>
                    <span className="hover:text-foreground cursor-pointer transition-colors">
                      Privacidad
                    </span>
                  </li>
                </ul>
              </div>
            </div>
            <div className="mt-10 pt-8 border-t border-border flex flex-col md:flex-row items-center justify-between text-xs text-muted-foreground/70 font-mono">
              <p>
                © {new Date().getFullYear()} ContaChile · Todos los derechos
                reservados
              </p>
              <div className="flex items-center gap-2 mt-3 md:mt-0">
                <Mail className="h-3 w-3" />
                <span>hola@contachile.cl</span>
              </div>
            </div>
          </div>
        </footer>
      </div>
    </>
  )
}
