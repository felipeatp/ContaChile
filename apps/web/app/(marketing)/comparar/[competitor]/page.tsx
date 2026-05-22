import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { JsonLd } from "@/components/seo/json-ld"
import { Check, X, ArrowRight, Minus, Mail } from "lucide-react"
import type { Metadata } from "next"

// ─── Competitor config ────────────────────────────────────────────────────────

const competitors = {
  "vs-nubox": {
    name: "Nubox",
    metaTitle: "ContaChile vs Nubox — Alternativa moderna a Nubox Chile",
    metaDescription:
      "Compara ContaChile con Nubox. Facturación electrónica DTE, contabilidad con IA y nóminas. Alternativa chilena con enfoque en automatización.",
    headline: "ContaChile vs Nubox",
    subheadline:
      "Una comparación honesta entre dos plataformas contables chilenas.",
    competitorDesc:
      "Nubox es una plataforma contable establecida en Chile con foco en pymes y contadores.",
    contachileDesc:
      "ContaChile es una plataforma nueva con arquitectura moderna, agentes IA integrados y diseño editorial pensado para equipos contables.",
  },
  "vs-defontana": {
    name: "Defontana",
    metaTitle: "ContaChile vs Defontana — Alternativa a Defontana para Pymes",
    metaDescription:
      "Compara ContaChile con Defontana ERP. Facturación electrónica, contabilidad y nóminas sin la complejidad de un ERP.",
    headline: "ContaChile vs Defontana",
    subheadline: "¿Necesitas un ERP completo o una plataforma contable ágil?",
    competitorDesc:
      "Defontana es un ERP chileno con módulos amplios: contabilidad, ventas, compras, bodega y RRHH.",
    contachileDesc:
      "ContaChile se enfoca en lo que más necesitan las pymes: DTE, libro mayor, nóminas e IA contable, sin la curva de aprendizaje de un ERP.",
  },
  "vs-bsale": {
    name: "Bsale",
    metaTitle: "ContaChile vs Bsale — Alternativa contable a Bsale Chile",
    metaDescription:
      "Compara ContaChile con Bsale. ContaChile incluye contabilidad completa, F29/F22 y nóminas, más allá de la facturación.",
    headline: "ContaChile vs Bsale",
    subheadline: "Más allá de la facturación: contabilidad completa para tu pyme.",
    competitorDesc:
      "Bsale es una plataforma de punto de venta y facturación electrónica enfocada en el comercio.",
    contachileDesc:
      "ContaChile va más allá de la facturación: incluye libro mayor, balances, nóminas y agentes IA para análisis tributario.",
  },
} as const

type CompetitorSlug = keyof typeof competitors

// ─── Feature matrix ───────────────────────────────────────────────────────────

const comparisonRows: {
  feature: string
  contachile: boolean
  competitor: boolean | null
}[] = [
  { feature: "Facturación electrónica DTE", contachile: true,  competitor: true  },
  { feature: "Todos los tipos de DTE",      contachile: true,  competitor: true  },
  { feature: "Contabilidad (libro mayor)",  contachile: true,  competitor: true  },
  { feature: "F29 y F22 automatizados",     contachile: true,  competitor: null  },
  { feature: "Nóminas y remuneraciones",    contachile: true,  competitor: true  },
  { feature: "Control de inventario",       contachile: true,  competitor: true  },
  { feature: "Agentes IA integrados",       contachile: true,  competitor: false },
  { feature: "API pública + webhooks",      contachile: true,  competitor: null  },
  { feature: "Plan gratuito disponible",    contachile: true,  competitor: false },
  { feature: "Diseño moderno",              contachile: true,  competitor: null  },
]

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: {
  params: Promise<{ competitor: string }>
}): Promise<Metadata> {
  const { competitor } = await params
  const c = competitors[competitor as CompetitorSlug]
  if (!c) return {}
  return {
    title: c.metaTitle,
    description: c.metaDescription,
    alternates: { canonical: `/comparar/${competitor}` },
    openGraph: {
      title: c.metaTitle,
      description: c.metaDescription,
      url: `https://contachile.cl/comparar/${competitor}`,
    },
  }
}

export function generateStaticParams() {
  return Object.keys(competitors).map((competitor) => ({ competitor }))
}

// ─── Cell icon ────────────────────────────────────────────────────────────────

function FeatureCell({ value }: { value: boolean | null }) {
  if (value === true)
    return (
      <span className="inline-flex items-center justify-center">
        <Check className="h-4 w-4 text-sage" aria-label="Incluido" />
      </span>
    )
  if (value === false)
    return (
      <span className="inline-flex items-center justify-center">
        <X className="h-4 w-4 text-muted-foreground/40" aria-label="No incluido" />
      </span>
    )
  return (
    <span className="inline-flex items-center justify-center">
      <Minus className="h-4 w-4 text-muted-foreground/40" aria-label="Parcial o variable" />
    </span>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CompetitorPage({
  params,
}: {
  params: Promise<{ competitor: string }>
}) {
  const { competitor } = await params
  const slug = competitor as CompetitorSlug
  const c = competitors[slug]
  if (!c) notFound()

  // ── Structured data ─────────────────────────────────────────────────────────

  const itemListSchema = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `ContaChile vs ${c.name}`,
    itemListElement: [
      {
        "@type": "ListItem",
        position: 1,
        item: {
          "@type": "Product",
          name: "ContaChile",
          url: "https://contachile.cl",
          description:
            "Software de facturación electrónica y contabilidad para empresas chilenas.",
        },
      },
      {
        "@type": "ListItem",
        position: 2,
        item: {
          "@type": "Product",
          name: c.name,
          description: c.competitorDesc,
        },
      },
    ],
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
        name: "Comparar",
        item: "https://contachile.cl/comparar",
      },
      {
        "@type": "ListItem",
        position: 3,
        name: `ContaChile vs ${c.name}`,
        item: `https://contachile.cl/comparar/${slug}`,
      },
    ],
  }

  return (
    <>
      <JsonLd data={itemListSchema} />
      <JsonLd data={breadcrumbSchema} />

      <div className="flex flex-col min-h-screen">

        {/* ── Sticky header ─────────────────────────────────────────────────── */}
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
              <Link href="/#caracteristicas" className="eyebrow hover:text-foreground transition-colors">
                Características
              </Link>
              <Link href="/#precios" className="eyebrow hover:text-foreground transition-colors">
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

        {/* ── Breadcrumb ────────────────────────────────────────────────────── */}
        <div className="border-b border-border bg-secondary/20">
          <div className="container py-3">
            <nav aria-label="Breadcrumb">
              <ol className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                <li>
                  <Link href="/" className="hover:text-foreground transition-colors">
                    Inicio
                  </Link>
                </li>
                <li aria-hidden="true" className="text-border">/</li>
                <li>
                  <Link href="/comparar" className="hover:text-foreground transition-colors">
                    Comparar
                  </Link>
                </li>
                <li aria-hidden="true" className="text-border">/</li>
                <li className="text-foreground font-medium" aria-current="page">
                  ContaChile vs {c.name}
                </li>
              </ol>
            </nav>
          </div>
        </div>

        {/* ── Hero ──────────────────────────────────────────────────────────── */}
        <section className="relative overflow-hidden border-b border-border">
          <div className="container py-14 lg:py-20 relative z-10">
            <div className="max-w-3xl">
              <span className="eyebrow block mb-4">Comparativa</span>
              <h1 className="font-display text-5xl md:text-6xl lg:text-7xl font-semibold leading-[0.92] tracking-tightest text-foreground">
                {c.headline}
              </h1>
              <p className="mt-6 text-lg text-muted-foreground max-w-2xl leading-relaxed">
                {c.subheadline}
              </p>

              {/* Ornamental rule */}
              <div className="mt-8 flex items-center gap-4">
                <div className="h-px w-12 bg-primary/40" />
                <span className="eyebrow text-primary/60">vs</span>
                <div className="h-px flex-1 max-w-[6rem] bg-border" />
              </div>
            </div>
          </div>

          {/* Background pilcrow motif */}
          <div className="pointer-events-none absolute -bottom-8 -right-16 select-none text-[22rem] font-display font-black leading-none text-primary/[0.028] hidden lg:block">
            ¶
          </div>
        </section>

        {/* ── Platform cards ────────────────────────────────────────────────── */}
        <section className="py-16 border-b border-border">
          <div className="container">
            <span className="eyebrow block mb-8">I · Sobre cada plataforma</span>

            <div className="grid md:grid-cols-2 gap-px bg-border border border-border">
              {/* ContaChile card */}
              <div className="bg-paper p-8 relative group">
                {/* Subtle primary accent stripe on left edge */}
                <div className="absolute left-0 top-8 bottom-8 w-0.5 bg-primary" />
                <div className="pl-5">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="relative h-10 w-10 border border-foreground bg-paper flex items-center justify-center">
                      <span className="font-display text-lg font-black leading-none text-foreground">
                        C
                      </span>
                      <span className="absolute -bottom-0.5 -right-0.5 h-1.5 w-1.5 bg-primary" />
                    </div>
                    <div>
                      <span className="block font-display text-xl font-semibold tracking-tightest">
                        ContaChile
                      </span>
                      <span className="eyebrow !text-[0.55rem]">Esta plataforma</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {c.contachileDesc}
                  </p>
                  <div className="mt-6">
                    <Link href="/sign-up">
                      <Button size="sm">
                        Prueba gratis
                        <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>

              {/* Competitor card */}
              <div className="bg-paper p-8 relative">
                <div className="absolute left-0 top-8 bottom-8 w-0.5 bg-border" />
                <div className="pl-5">
                  <div className="flex items-center gap-3 mb-5">
                    <div className="h-10 w-10 border border-border bg-secondary/40 flex items-center justify-center">
                      <span className="font-display text-lg font-semibold leading-none text-muted-foreground">
                        {c.name.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <span className="block font-display text-xl font-semibold tracking-tightest">
                        {c.name}
                      </span>
                      <span className="eyebrow !text-[0.55rem]">Alternativa</span>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {c.competitorDesc}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Comparison table ──────────────────────────────────────────────── */}
        <section className="py-16 border-b border-border bg-secondary/20">
          <div className="container">
            <span className="eyebrow block mb-8">II · Tabla comparativa</span>

            <div className="border border-border overflow-hidden">
              {/* Table header */}
              <div className="grid grid-cols-[1fr_auto_auto] md:grid-cols-[1fr_160px_160px] border-b border-border bg-paper">
                <div className="px-5 py-4 flex items-end">
                  <span className="eyebrow">Característica</span>
                </div>
                {/* ContaChile column — blue accent bg */}
                <div className="px-5 py-4 border-l border-border bg-primary/[0.06] flex flex-col items-center justify-end gap-1 text-center">
                  <div className="relative h-6 w-6 border border-foreground/30 bg-paper flex items-center justify-center mb-1">
                    <span className="font-display text-xs font-black leading-none">C</span>
                    <span className="absolute -bottom-0.5 -right-0.5 h-1 w-1 bg-primary" />
                  </div>
                  <span className="eyebrow !text-[0.6rem] text-foreground">ContaChile</span>
                </div>
                {/* Competitor column */}
                <div className="px-5 py-4 border-l border-border flex flex-col items-center justify-end gap-1 text-center">
                  <div className="h-6 w-6 border border-border bg-secondary/40 flex items-center justify-center mb-1">
                    <span className="font-display text-xs font-semibold leading-none text-muted-foreground">
                      {c.name.charAt(0)}
                    </span>
                  </div>
                  <span className="eyebrow !text-[0.6rem]">{c.name}</span>
                </div>
              </div>

              {/* Table rows */}
              {comparisonRows.map((row, i) => (
                <div
                  key={row.feature}
                  className={`grid grid-cols-[1fr_auto_auto] md:grid-cols-[1fr_160px_160px] border-b border-border/60 last:border-b-0 transition-colors hover:bg-paper/60 ${
                    i % 2 === 0 ? "bg-paper" : "bg-secondary/10"
                  }`}
                >
                  <div className="px-5 py-3.5 flex items-center">
                    <span className="text-sm text-foreground/80">{row.feature}</span>
                  </div>
                  <div className="px-5 py-3.5 border-l border-border/60 bg-primary/[0.04] flex items-center justify-center">
                    <FeatureCell value={row.contachile} />
                  </div>
                  <div className="px-5 py-3.5 border-l border-border/60 flex items-center justify-center">
                    <FeatureCell value={row.competitor} />
                  </div>
                </div>
              ))}
            </div>

            {/* Legend */}
            <div className="mt-5 flex items-center gap-5 flex-wrap">
              <div className="flex items-center gap-1.5">
                <Check className="h-3.5 w-3.5 text-sage" />
                <span className="text-xs text-muted-foreground">Incluido</span>
              </div>
              <div className="flex items-center gap-1.5">
                <X className="h-3.5 w-3.5 text-muted-foreground/40" />
                <span className="text-xs text-muted-foreground">No incluido</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Minus className="h-3.5 w-3.5 text-muted-foreground/40" />
                <span className="text-xs text-muted-foreground">Parcial o variable según plan</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── CTA ───────────────────────────────────────────────────────────── */}
        <section className="py-24 relative overflow-hidden">
          <div className="container relative z-10">
            <div className="mx-auto max-w-2xl text-center">
              <span className="eyebrow block mb-3">¿Listo para cambiar?</span>
              <h2 className="font-display text-4xl md:text-5xl font-semibold tracking-tightest mb-4">
                Prueba ContaChile{" "}
                <em className="text-primary not-italic font-medium">gratis</em>.
              </h2>
              <p className="text-muted-foreground mb-8 max-w-xl mx-auto leading-relaxed">
                Sin tarjeta de crédito. Sin contrato. Configura tu primera empresa
                y emite tu primer DTE en menos de diez minutos.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link href="/sign-up">
                  <Button size="lg">
                    Crear cuenta gratis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/login">
                  <Button size="lg" variant="outline">
                    Ver demo
                  </Button>
                </Link>
              </div>
              <p className="mt-5 text-xs text-muted-foreground/60 font-mono">
                Certificación SII en proceso · Plan gratuito incluye 10 DTE/mes
              </p>
            </div>
          </div>

          {/* Background decorative ¶ */}
          <div className="pointer-events-none absolute -top-10 left-1/2 -translate-x-1/2 select-none text-[20rem] font-display font-black leading-none text-primary/[0.03]">
            ¶
          </div>
        </section>

        {/* ── Footer ────────────────────────────────────────────────────────── */}
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
                    <Link href="/#caracteristicas" className="hover:text-foreground transition-colors">
                      Características
                    </Link>
                  </li>
                  <li>
                    <Link href="/#precios" className="hover:text-foreground transition-colors">
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
                <h4 className="eyebrow mb-4">Comparar</h4>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li>
                    <Link href="/comparar/vs-nubox" className="hover:text-foreground transition-colors">
                      vs Nubox
                    </Link>
                  </li>
                  <li>
                    <Link href="/comparar/vs-defontana" className="hover:text-foreground transition-colors">
                      vs Defontana
                    </Link>
                  </li>
                  <li>
                    <Link href="/comparar/vs-bsale" className="hover:text-foreground transition-colors">
                      vs Bsale
                    </Link>
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
              <p>© {new Date().getFullYear()} ContaChile · Todos los derechos reservados</p>
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
