import Link from "next/link"
import { Button } from "@/components/ui/button"
import { JsonLd } from "@/components/seo/json-ld"
import { Check, ArrowRight, Mail } from "lucide-react"

export const metadata = {
  title: "Precios — Software Contable para Chile",
  description:
    "Planes desde $0 para siempre. Facturación electrónica DTE, contabilidad y nóminas para pymes chilenas. Sin contratos de permanencia.",
  alternates: { canonical: "/precios" },
  openGraph: {
    title: "Precios ContaChile — Desde $0 para siempre",
    description:
      "Planes desde $0. DTE, contabilidad, nóminas e IA para pymes chilenas.",
    url: "https://contachile.cl/precios",
  },
}

const productSchema = {
  "@context": "https://schema.org",
  "@type": "Product",
  name: "ContaChile",
  description:
    "Software de facturación electrónica y contabilidad para empresas chilenas.",
  url: "https://contachile.cl/precios",
  brand: { "@type": "Brand", name: "ContaChile" },
  offers: [
    {
      "@type": "Offer",
      name: "Inicio",
      price: "0",
      priceCurrency: "CLP",
      availability: "https://schema.org/InStock",
      url: "https://contachile.cl/sign-up",
    },
    {
      "@type": "Offer",
      name: "Profesional",
      price: "29900",
      priceCurrency: "CLP",
      availability: "https://schema.org/InStock",
      url: "https://contachile.cl/sign-up",
    },
    {
      "@type": "Offer",
      name: "Empresa",
      price: "89900",
      priceCurrency: "CLP",
      availability: "https://schema.org/InStock",
      url: "https://contachile.cl/sign-up",
    },
  ],
}

const faqs = [
  {
    q: "¿Hay un período de prueba gratuito?",
    a: "Sí. El plan Inicio es gratis para siempre con hasta 10 documentos al mes. No se requiere tarjeta de crédito.",
  },
  {
    q: "¿Puedo cambiar de plan en cualquier momento?",
    a: "Sí, puedes subir o bajar de plan cuando quieras. Los cambios se aplican al inicio del siguiente ciclo de facturación.",
  },
  {
    q: "¿El precio incluye la firma digital SII?",
    a: "En los planes Profesional y Empresa, la firma digital está incluida. En el plan Inicio necesitas traer tu propio certificado SII.",
  },
  {
    q: "¿Están incluidos todos los tipos de DTE?",
    a: "El plan Profesional incluye todos los tipos de DTE: tipos 33, 34, 39, 41, 52, 56, 61 y más. El plan Inicio incluye solo tipos 33 y 39.",
  },
  {
    q: "¿Qué pasa si supero el límite de documentos en el plan Inicio?",
    a: "Te notificaremos cuando estés cerca del límite. Puedes subir al plan Profesional en cualquier momento para desbloquear documentos ilimitados.",
  },
]

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: faqs.map((faq) => ({
    "@type": "Question",
    name: faq.q,
    acceptedAnswer: { "@type": "Answer", text: faq.a },
  })),
}

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    {
      "@type": "ListItem",
      position: 1,
      name: "Inicio",
      item: "https://contachile.cl",
    },
    {
      "@type": "ListItem",
      position: 2,
      name: "Precios",
      item: "https://contachile.cl/precios",
    },
  ],
}

const plans = [
  {
    name: "Inicio",
    price: "0",
    displayPrice: "$0",
    period: "para siempre",
    desc: "Para probar la plataforma con datos reales.",
    features: [
      "Hasta 10 documentos / mes",
      "Tipos 33 y 39",
      "Dashboard básico",
      "Soporte por email",
    ],
    cta: "Empezar gratis",
    href: "/sign-up",
    popular: false,
  },
  {
    name: "Profesional",
    price: "29900",
    displayPrice: "$29.900",
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
    href: "/sign-up",
    popular: true,
  },
  {
    name: "Empresa",
    price: "89900",
    displayPrice: "$89.900",
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
    href: "/sign-up",
    popular: false,
  },
]

export default function PreciosPage() {
  return (
    <>
      <JsonLd data={productSchema} />
      <JsonLd data={faqSchema} />
      <JsonLd data={breadcrumbSchema} />

      <div className="flex flex-col min-h-screen">
        {/* HEADER */}
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
              <Link
                href="/#caracteristicas"
                className="eyebrow hover:text-foreground transition-colors"
              >
                Características
              </Link>
              <Link
                href="/precios"
                className="eyebrow text-foreground transition-colors"
              >
                Precios
              </Link>
              <Link href="/login">
                <Button variant="ghost">Iniciar sesión</Button>
              </Link>
              <Link href="/sign-up">
                <Button>Probar gratis</Button>
              </Link>
            </nav>
          </div>
        </header>

        {/* BREADCRUMB */}
        <div className="border-b border-border bg-secondary/20">
          <div className="container py-3">
            <nav className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
              <Link href="/" className="hover:text-foreground transition-colors">
                Inicio
              </Link>
              <span className="text-muted-foreground/40">/</span>
              <span className="text-foreground">Precios</span>
            </nav>
          </div>
        </div>

        {/* HERO */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="container py-16 lg:py-24 relative z-10">
            <div className="max-w-3xl">
              <div className="flex items-center gap-3 mb-6 flex-wrap">
                <span className="inline-flex items-center eyebrow">
                  <span className="mr-2 flex h-1.5 w-1.5 rounded-full bg-sage animate-pulse" />
                  III · Suscripciones
                </span>
                <span className="h-px w-16 bg-foreground/20" />
                <span className="eyebrow text-muted-foreground/70">
                  Sin permanencia · Cancela cuando quieras
                </span>
              </div>
              <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-semibold leading-[0.95] tracking-tightest text-foreground">
                Precios{" "}
                <em className="text-primary not-italic font-medium">
                  directos.
                </em>
              </h1>
              <p className="mt-8 text-lg text-muted-foreground max-w-xl leading-relaxed">
                Desde $0 para siempre. Elige el plan que calza con tu volumen
                de documentos y crece sin fricción cuando lo necesites.
              </p>
            </div>
          </div>
          <div className="pointer-events-none absolute -bottom-12 -right-24 select-none text-[28rem] font-display font-black leading-none text-primary/[0.025] hidden lg:block">
            ¶
          </div>
        </section>

        {/* PRICING GRID */}
        <section className="py-20 border-b border-border">
          <div className="container">
            <div className="grid gap-px md:grid-cols-3 max-w-5xl mx-auto border border-border bg-border">
              {plans.map((plan) => (
                <div
                  key={plan.name}
                  className={`flex flex-col bg-paper p-8 relative ${
                    plan.popular ? "bg-secondary/40" : ""
                  }`}
                >
                  {plan.popular && (
                    <span className="absolute top-0 right-0 bg-primary text-primary-foreground eyebrow !text-[0.55rem] px-2.5 py-1">
                      Más popular
                    </span>
                  )}
                  <h2 className="font-display text-2xl font-semibold tracking-tightest mb-1">
                    {plan.name}
                  </h2>
                  <p className="text-xs text-muted-foreground mb-5">
                    {plan.desc}
                  </p>
                  <div className="flex items-baseline gap-1.5 mb-2">
                    <span className="font-mono text-4xl font-bold tracking-tightest tabular">
                      {plan.displayPrice}
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

                  <Link href={plan.href}>
                    <Button
                      className="w-full"
                      variant={plan.popular ? "default" : "outline"}
                    >
                      {plan.cta}
                    </Button>
                  </Link>
                </div>
              ))}
            </div>

            <p className="text-center text-xs text-muted-foreground/70 font-mono mt-6">
              Todos los precios en CLP · IVA incluido · Sin contratos de permanencia
            </p>
          </div>
        </section>

        {/* FAQ */}
        <section className="py-20 border-b border-border bg-secondary/30">
          <div className="container">
            <div className="max-w-3xl mx-auto">
              <div className="mb-12">
                <span className="eyebrow block mb-3">IV · Dudas comunes</span>
                <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tightest">
                  Preguntas{" "}
                  <em className="text-primary not-italic font-medium">
                    frecuentes
                  </em>
                  .
                </h2>
              </div>

              <dl className="divide-y divide-border">
                {faqs.map((faq) => (
                  <div key={faq.q} className="py-5">
                    <dt className="font-display text-base font-semibold tracking-tightest mb-2">
                      {faq.q}
                    </dt>
                    <dd className="text-sm text-muted-foreground leading-relaxed">
                      {faq.a}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-24 relative overflow-hidden">
          <div className="container relative z-10">
            <div className="mx-auto max-w-3xl text-center">
              <span className="eyebrow block mb-3">Próxima edición</span>
              <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tightest mb-4">
                Empieza hoy,{" "}
                <em className="text-primary not-italic font-medium">
                  sin tarjeta
                </em>
                .
              </h2>
              <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
                El plan Inicio es gratis para siempre. Cuando tu negocio crezca,
                subir de plan toma un clic.
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

        {/* FOOTER */}
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
                    <Link
                      href="/#caracteristicas"
                      className="hover:text-foreground transition-colors"
                    >
                      Características
                    </Link>
                  </li>
                  <li>
                    <Link
                      href="/precios"
                      className="hover:text-foreground transition-colors"
                    >
                      Precios
                    </Link>
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
