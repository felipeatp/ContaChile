import Link from "next/link"
import { Button } from "@/components/ui/button"
import { JsonLd } from "@/components/seo/json-ld"
import { FileText, BarChart3, Users, Package, Sparkles, ArrowRight } from "lucide-react"

export const metadata = {
  title: "Funcionalidades — Software Contable para Chile",
  description: "Facturación electrónica DTE, contabilidad automatizada, nóminas, inventario y agentes IA. Todo lo que tu pyme necesita en una sola plataforma.",
  alternates: { canonical: "/features" },
}

const featureItems = [
  {
    slug: "facturacion-electronica",
    icon: FileText,
    title: "Facturación Electrónica",
    desc: "DTE, boletas y facturas directamente al SII. Firma digital incluida.",
  },
  {
    slug: "contabilidad",
    icon: BarChart3,
    title: "Contabilidad",
    desc: "Libro diario, mayor y balance. Asientos automáticos desde tus DTE.",
  },
  {
    slug: "nominas",
    icon: Users,
    title: "Nóminas y Remuneraciones",
    desc: "Liquidaciones de sueldo, AFP, Isapre y archivo PreviRed.",
  },
  {
    slug: "inventario",
    icon: Package,
    title: "Control de Inventario",
    desc: "Stock en tiempo real integrado con tu facturación.",
  },
  {
    slug: "ia",
    icon: Sparkles,
    title: "Agentes IA",
    desc: "Clasificador de transacciones, asistente F29 y consultor tributario.",
  },
]

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Inicio", item: "https://contachile.cl" },
    { "@type": "ListItem", position: 2, name: "Funcionalidades", item: "https://contachile.cl/features" },
  ],
}

export default function FeaturesPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema} />

      <div className="flex flex-col min-h-screen">
        {/* Header — same as landing */}
        <header className="sticky top-0 z-50 w-full border-b border-border bg-paper/95 backdrop-blur supports-[backdrop-filter]:bg-paper/70">
          <div className="container flex h-16 items-center justify-between">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="relative h-9 w-9 border border-foreground bg-paper flex items-center justify-center">
                <span className="font-display text-base font-black leading-none text-foreground">C</span>
                <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 bg-primary" />
              </div>
              <div className="leading-none">
                <span className="block font-display text-lg font-semibold tracking-tightest">ContaChile</span>
                <span className="block eyebrow !text-[0.55rem] !tracking-[0.2em] mt-0.5 text-muted-foreground/70">Edición Financiera</span>
              </div>
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/features" className="eyebrow hover:text-foreground transition-colors">Características</Link>
              <Link href="/#precios" className="eyebrow hover:text-foreground transition-colors">Precios</Link>
              <Link href="/login"><Button variant="ghost">Iniciar sesión</Button></Link>
              <Link href="/sign-up"><Button>Probar gratis</Button></Link>
            </nav>
          </div>
        </header>

        {/* Breadcrumb */}
        <div className="border-b border-border">
          <div className="container py-3">
            <nav className="text-xs text-muted-foreground font-mono">
              <Link href="/" className="hover:text-foreground transition-colors">Inicio</Link>
              <span className="mx-2">/</span>
              <span className="text-foreground">Funcionalidades</span>
            </nav>
          </div>
        </div>

        {/* Hero */}
        <section className="py-16 border-b border-border">
          <div className="container">
            <span className="eyebrow block mb-3">Plataforma contable completa</span>
            <h1 className="font-display text-5xl md:text-6xl font-semibold tracking-tightest max-w-3xl">
              Todo lo que tu pyme <em className="text-primary not-italic font-medium">necesita</em>.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
              Desde la emisión del primer DTE hasta el cierre del año. Una sola plataforma, sin integraciones frágiles.
            </p>
          </div>
        </section>

        {/* Feature grid */}
        <section className="py-16">
          <div className="container">
            <div className="grid gap-px bg-border border border-border md:grid-cols-2 lg:grid-cols-3">
              {featureItems.map((f) => (
                <Link
                  key={f.slug}
                  href={`/features/${f.slug}`}
                  className="bg-paper p-8 group hover:bg-secondary/40 transition-colors flex flex-col gap-4"
                >
                  <div className="flex items-start justify-between">
                    <f.icon className="h-6 w-6 text-primary opacity-70 group-hover:opacity-100 transition-opacity" />
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                  <div>
                    <h2 className="font-display text-xl font-semibold tracking-tightest mb-2">{f.title}</h2>
                    <p className="text-sm text-muted-foreground leading-relaxed">{f.desc}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="py-20 border-t border-border mt-auto">
          <div className="container text-center">
            <h2 className="font-display text-3xl font-semibold tracking-tightest mb-4">
              Empieza hoy, <em className="text-primary not-italic font-medium">sin tarjeta</em>.
            </h2>
            <Link href="/sign-up">
              <Button size="lg">
                Crear cuenta gratis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border py-8 bg-secondary/30">
          <div className="container flex flex-col md:flex-row items-center justify-between text-xs text-muted-foreground/70 font-mono">
            <p>© {new Date().getFullYear()} ContaChile · Todos los derechos reservados</p>
            <Link href="/" className="mt-2 md:mt-0 hover:text-foreground transition-colors">contachile.cl</Link>
          </div>
        </footer>
      </div>
    </>
  )
}
