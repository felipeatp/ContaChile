import Link from "next/link"
import { Button } from "@/components/ui/button"
import { JsonLd } from "@/components/seo/json-ld"
import { ArrowRight } from "lucide-react"
import { blogPosts } from "@/lib/blog"
import type { BlogPost } from "@/lib/blog"

export const metadata = {
  title: "Blog — Contabilidad y Tributación en Chile",
  description: "Guías prácticas sobre facturación electrónica, F29, IVA y contabilidad para pymes chilenas.",
  alternates: { canonical: "/blog" },
}

const breadcrumbSchema = {
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  itemListElement: [
    { "@type": "ListItem", position: 1, name: "Inicio", item: "https://contachile.cl" },
    { "@type": "ListItem", position: 2, name: "Blog",   item: "https://contachile.cl/blog" },
  ],
}

function AudienceBadge({ audience }: { audience: BlogPost["audience"] }) {
  const config = {
    negocio:  { label: "Para mi negocio",        className: "bg-blue-100 text-blue-700" },
    contador: { label: "Para contadores",         className: "bg-purple-100 text-purple-700" },
    ambos:    { label: "Empresas & Contadores",   className: "bg-green-100 text-green-700" },
  }
  const { label, className } = config[audience]
  return (
    <span className={`inline-block text-[0.6rem] font-semibold uppercase tracking-wide px-2 py-0.5 ${className}`}>
      {label}
    </span>
  )
}

export default function BlogIndexPage() {
  const [featured, ...rest] = blogPosts

  return (
    <>
      <JsonLd data={breadcrumbSchema} />

      <div className="flex flex-col min-h-screen">
        {/* Header */}
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
              <Link href="/precios" className="eyebrow hover:text-foreground transition-colors">Precios</Link>
              <Link href="/login"><Button variant="ghost">Iniciar sesión</Button></Link>
              <Link href="/sign-up"><Button>Probar gratis</Button></Link>
            </nav>
          </div>
        </header>

        {/* Newspaper masthead */}
        <div className="border-b bg-paper" style={{ borderBottomWidth: "3px", borderBottomStyle: "double" }}>
          <div className="container py-6 text-center">
            <h1 className="font-display text-4xl md:text-5xl font-black tracking-tightest text-foreground">
              ContaChile · Blog
            </h1>
            <p className="eyebrow mt-1 text-muted-foreground/70">
              Guías tributarias para empresas y contadores
            </p>
            {/* Decorative category nav — not interactive, all posts always shown */}
            <div className="flex justify-center gap-5 mt-4 flex-wrap" aria-hidden="true">
              {["Todo", "Facturación", "IVA & Impuestos", "Formularios SII", "Para mi negocio", "Para contadores"].map((tab, i) => (
                <span
                  key={tab}
                  className={`text-[0.7rem] font-semibold uppercase tracking-widest pb-0.5 ${
                    i === 0
                      ? "text-foreground border-b-2 border-foreground"
                      : "text-muted-foreground/60"
                  }`}
                >
                  {tab}
                </span>
              ))}
            </div>
          </div>
        </div>

        <main className="flex-1">
          <div className="container py-10">

            {/* Featured article */}
            <div className="eyebrow mb-4 text-muted-foreground/70">Artículo destacado</div>
            <Link
              href={`/blog/${featured.slug}`}
              className="group grid md:grid-cols-[3fr_2fr] border border-border overflow-hidden mb-10 hover:bg-secondary/20 transition-colors"
            >
              {/* Color block */}
              <div className="relative min-h-[180px] bg-gradient-to-br from-foreground/90 to-primary flex flex-col justify-end p-8">
                <span className="eyebrow text-white/60 mb-2">{featured.category} · {featured.readTime} min</span>
                <p className="font-display text-xl md:text-2xl font-bold text-white leading-snug tracking-tightest">
                  {featured.title}
                </p>
              </div>
              {/* Content */}
              <div className="p-8 flex flex-col justify-between bg-paper">
                <div>
                  <span className="eyebrow text-primary/80 block mb-2">{featured.category} · {featured.readTime} min</span>
                  <p className="font-display text-xl font-semibold tracking-tightest mb-3 group-hover:text-primary transition-colors leading-snug">
                    {featured.title}
                  </p>
                  <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                    {featured.excerpt}
                  </p>
                </div>
                <div className="mt-6 flex items-center gap-3 flex-wrap">
                  <AudienceBadge audience={featured.audience} />
                  <span className="text-xs text-muted-foreground/60 font-mono ml-auto flex items-center gap-1">
                    Leer artículo <ArrowRight className="h-3 w-3 group-hover:translate-x-0.5 transition-transform" />
                  </span>
                </div>
              </div>
            </Link>

            {/* Section divider */}
            <div className="flex items-center gap-4 mb-8">
              <div className="flex-1 h-px bg-border" />
              <span className="eyebrow text-muted-foreground/50">Últimos artículos</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            {/* Post grid */}
            <div className="grid gap-px bg-border border border-border md:grid-cols-2 lg:grid-cols-3">
              {rest.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="bg-paper p-7 group hover:bg-secondary/40 transition-colors flex flex-col gap-4"
                >
                  <div>
                    <span className="eyebrow text-primary/70">{post.category} · {post.readTime} min</span>
                    <h2 className="font-display text-lg font-semibold tracking-tightest mt-1.5 mb-2 group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                      {post.title}
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                      {post.excerpt}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-border/50 mt-auto">
                    <AudienceBadge audience={post.audience} />
                    <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              ))}
            </div>

          </div>
        </main>

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
