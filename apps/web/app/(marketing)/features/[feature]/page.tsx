import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { JsonLd } from "@/components/seo/json-ld"
import { Check, ArrowRight, Mail } from "lucide-react"

// ─────────────────────────────────────────────────────────────────────────────
// Feature config
// ─────────────────────────────────────────────────────────────────────────────

const features = {
  "facturacion-electronica": {
    title: "Facturación Electrónica",
    metaTitle: "Facturación Electrónica para Chile — DTE, Boletas y Facturas",
    metaDescription:
      "Emite DTE, boletas y facturas electrónicas directamente al SII. Firma digital incluida. Envío en menos de un segundo.",
    headline: "DTE al SII en menos de un segundo.",
    subheadline:
      "Emite facturas, boletas, notas de crédito y débito. Pipeline completo: XML ISO-8859-1, firma xmldsig, EnvioDTE, polling de estado.",
    featureList: [
      "Tipos 33 (factura), 39 (boleta), 61 (nota de crédito), 56 (nota de débito)",
      "Firma digital con tu certificado SII",
      "Envío directo al SII o vía bridge Acepta",
      "Polling automático de estado y acuse de recibo",
      "Almacenamiento en Cloudflare R2",
      "Email al receptor con el XML adjunto",
    ],
    schemaFeatureList: [
      "Emisión DTE",
      "Firma digital xmldsig",
      "Envío SII",
      "Boleta electrónica",
      "Factura electrónica",
    ],
  },
  contabilidad: {
    title: "Contabilidad",
    metaTitle:
      "Software de Contabilidad para Pymes Chilenas — Libro Mayor y Balance",
    metaDescription:
      "Libro diario, mayor general, balance de comprobación y estado de resultados. Automatización contable con IA para empresas chilenas.",
    headline: "Contabilidad automatizada sin Excel paralelos.",
    subheadline:
      "Asientos automáticos desde tus DTE. Libro diario, mayor general, balance de comprobación y estado de resultados. Todo en una sola pantalla.",
    featureList: [
      "Asientos contables automáticos desde DTE emitidos y recibidos",
      "Plan de cuentas personalizable por empresa",
      "Libro diario y mayor general en tiempo real",
      "Balance de comprobación y estado de resultados",
      "Cierre de período y apertura automática",
      "Exportación a Excel y PDF",
    ],
    schemaFeatureList: [
      "Libro diario",
      "Mayor general",
      "Balance de comprobación",
      "Estado de resultados",
      "Asientos automáticos",
    ],
  },
  nominas: {
    title: "Nóminas y Remuneraciones",
    metaTitle:
      "Software de Nóminas Chile — Liquidaciones y Cotizaciones Previsionales",
    metaDescription:
      "Liquida sueldos, calcula cotizaciones previsionales y envía a PreviRed. Cumplimiento laboral automatizado para pymes chilenas.",
    headline: "Liquidaciones de sueldo sin errores de cálculo.",
    subheadline:
      "Calcula remuneraciones, descuentos previsionales y de salud, gratificaciones e imposiciones. Genera el archivo PreviRed con un clic.",
    featureList: [
      "Liquidaciones de sueldo con todos los conceptos legales",
      "Cálculo automático AFP, Isapre/Fonasa, seguro de cesantía",
      "Gratificación legal e imponible",
      "Generación de archivo PreviRed",
      "Libro de remuneraciones electrónico",
      "DDJJ 1887 para el SII",
    ],
    schemaFeatureList: [
      "Liquidaciones de sueldo",
      "Cotizaciones previsionales",
      "PreviRed",
      "DDJJ 1887",
      "Libro de remuneraciones",
    ],
  },
  inventario: {
    title: "Control de Inventario",
    metaTitle:
      "Control de Inventario para Pymes Chile — Stock y Productos",
    metaDescription:
      "Controla tu stock en tiempo real. Entradas, salidas y ajustes de inventario integrados con tu facturación electrónica.",
    headline: "Stock en tiempo real, integrado con tu facturación.",
    subheadline:
      "Cada DTE emitido descuenta automáticamente del inventario. Alertas de stock mínimo, valorización de existencias y movimientos auditados.",
    featureList: [
      "Descuento automático de stock al emitir DTE",
      "Entradas manuales y por compras",
      "Alertas de stock mínimo configurables",
      "Valorización de existencias (FIFO, promedio ponderado)",
      "Reportes de movimientos con trazabilidad completa",
      "Integración con libro de compras y ventas",
    ],
    schemaFeatureList: [
      "Control de stock",
      "Inventario en tiempo real",
      "Descuento automático por DTE",
      "Valorización FIFO",
    ],
  },
  ia: {
    title: "Agentes IA",
    metaTitle:
      "Automatización Contable con IA — Agentes para Pymes Chilenas",
    metaDescription:
      "Clasificador de transacciones bancarias, asistente F29 y consultor tributario con IA. Automatiza la contabilidad de tu empresa.",
    headline: "Tu equipo contable potenciado con IA.",
    subheadline:
      "Agentes especializados que entienden tu plan de cuentas real. Clasifican transacciones, preparan el F29 mensual y responden tus dudas tributarias.",
    featureList: [
      "Clasificador automático de transacciones bancarias",
      "Asistente F29 con cálculo de IVA y PPM",
      "Consultor tributario RAG con normativa SII actualizada",
      "Auditor de inconsistencias contables",
      "OCR para facturas de proveedores",
      "Contexto completo de tu empresa en cada consulta",
    ],
    schemaFeatureList: [
      "Clasificador de transacciones IA",
      "Asistente F29",
      "Consultor tributario IA",
      "OCR facturas",
    ],
  },
}

type FeatureSlug = keyof typeof features

// ─────────────────────────────────────────────────────────────────────────────
// Static params & metadata
// ─────────────────────────────────────────────────────────────────────────────

export function generateStaticParams() {
  return Object.keys(features).map((feature) => ({ feature }))
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ feature: string }>
}) {
  const { feature } = await params
  const f = features[feature as FeatureSlug]
  if (!f) return {}
  return {
    title: f.metaTitle,
    description: f.metaDescription,
    alternates: { canonical: `/features/${feature}` },
    openGraph: {
      title: f.metaTitle,
      description: f.metaDescription,
      url: `https://contachile.cl/features/${feature}`,
    },
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Page component
// ─────────────────────────────────────────────────────────────────────────────

export default async function FeaturePage({
  params,
}: {
  params: Promise<{ feature: string }>
}) {
  const { feature } = await params
  const f = features[feature as FeatureSlug]
  if (!f) notFound()

  const slug = feature

  const softwareApplicationSchema = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: `ContAI — ${f.title}`,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: `https://contachile.cl/features/${slug}`,
    description: f.metaDescription,
    featureList: f.schemaFeatureList.join(", "),
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
        name: "Funcionalidades",
        item: "https://contachile.cl/features",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: f.title,
        item: `https://contachile.cl/features/${slug}`,
      },
    ],
  }

  return (
    <>
      <JsonLd data={softwareApplicationSchema} />
      <JsonLd data={breadcrumbSchema} />

      <div className="flex flex-col min-h-screen">
        {/* ── Header ─────────────────────────────────────────────────────────── */}
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
                  ContAI
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
                href="/#precios"
                className="eyebrow hover:text-foreground transition-colors"
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

        {/* ── Breadcrumb ─────────────────────────────────────────────────────── */}
        <div className="border-b border-border bg-secondary/30">
          <div className="container py-3">
            <nav
              aria-label="Breadcrumb"
              className="flex items-center gap-2 text-xs text-muted-foreground font-mono"
            >
              <Link href="/" className="hover:text-foreground transition-colors">
                Inicio
              </Link>
              <span className="text-border">/</span>
              <Link
                href="/features"
                className="hover:text-foreground transition-colors"
              >
                Funcionalidades
              </Link>
              <span className="text-border">/</span>
              <span className="text-foreground">{f.title}</span>
            </nav>
          </div>
        </div>

        {/* ── Hero ───────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="container py-16 lg:py-24 relative z-10">
            <div className="max-w-3xl">
              <span className="eyebrow block mb-6">
                <span className="mr-2 flex-inline">¶</span>
                {f.title}
              </span>
              <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-semibold leading-[0.95] tracking-tightest text-foreground">
                {f.headline.includes(".") ? (
                  <>
                    {f.headline.slice(0, f.headline.lastIndexOf(" ") + 1)}
                    <em className="text-primary not-italic font-medium">
                      {f.headline.slice(f.headline.lastIndexOf(" ") + 1)}
                    </em>
                  </>
                ) : (
                  f.headline
                )}
              </h1>
              <p className="mt-8 text-lg text-muted-foreground max-w-2xl leading-relaxed">
                {f.subheadline}
              </p>
              <div className="mt-10 flex flex-wrap gap-3 items-center">
                <Link href="/sign-up">
                  <Button size="lg">
                    Probar gratis
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
          </div>

          {/* Decorative pilcrow */}
          <div className="pointer-events-none absolute -bottom-12 -right-24 select-none text-[28rem] font-display font-black leading-none text-primary/[0.025] hidden lg:block">
            ¶
          </div>
        </section>

        {/* ── Feature list ───────────────────────────────────────────────────── */}
        <section className="py-20 border-b border-border">
          <div className="container">
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
              <div className="max-w-xl">
                <span className="eyebrow block mb-3">I · Lo que incluye</span>
                <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tightest">
                  Todo lo que necesitas{" "}
                  <em className="text-primary not-italic font-medium">
                    incluido
                  </em>
                  .
                </h2>
              </div>
              <p className="text-muted-foreground max-w-md text-sm leading-relaxed">
                Sin módulos separados, sin cargos extra. {f.title} viene
                completo desde el primer plan.
              </p>
            </div>

            <div className="grid gap-px bg-border md:grid-cols-2 lg:grid-cols-3 border border-border">
              {f.featureList.map((item, i) => (
                <div
                  key={item}
                  className="bg-paper p-6 group transition-colors hover:bg-secondary/40 flex items-start gap-4"
                >
                  <div className="shrink-0 flex items-start gap-3">
                    <span className="font-display text-2xl font-bold text-muted-foreground/30 tracking-tightest leading-none mt-0.5 w-6 text-right">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div className="flex items-start gap-3">
                    <Check className="h-4 w-4 text-primary shrink-0 mt-0.5 group-hover:scale-110 transition-transform" />
                    <span className="text-sm text-foreground/80 leading-relaxed">
                      {item}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── CTA ────────────────────────────────────────────────────────────── */}
        <section className="py-24 relative overflow-hidden">
          <div className="container relative z-10">
            <div className="mx-auto max-w-3xl text-center">
              <span className="eyebrow block mb-3">Próxima edición</span>
              <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tightest mb-4">
                Empieza con{" "}
                <em className="text-primary not-italic font-medium">
                  {f.title.toLowerCase()}
                </em>{" "}
                hoy mismo.
              </h2>
              <p className="text-muted-foreground mb-8 max-w-2xl mx-auto">
                Únete a cientos de pymes chilenas que ya simplificaron su
                cumplimiento tributario. Sin tarjeta de crédito.
              </p>
              <div className="flex flex-wrap gap-3 justify-center">
                <Link href="/sign-up">
                  <Button size="lg">
                    Crear cuenta gratis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/#precios">
                  <Button size="lg" variant="outline">
                    Ver precios
                  </Button>
                </Link>
              </div>
            </div>
          </div>
          <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 select-none text-[20rem] font-display font-black leading-none text-primary/[0.03]">
            ¶
          </div>
        </section>

        {/* ── Footer ─────────────────────────────────────────────────────────── */}
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
                    ContAI
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
                      href="/#precios"
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
                <h4 className="eyebrow mb-4">Funcionalidades</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  {Object.entries(features).map(([key, val]) => (
                    <li key={key}>
                      <Link
                        href={`/features/${key}`}
                        className="hover:text-foreground transition-colors"
                      >
                        {val.title}
                      </Link>
                    </li>
                  ))}
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
                &copy; {new Date().getFullYear()} ContAI · Todos los derechos
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
