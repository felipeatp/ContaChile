import Link from "next/link"
import { Button } from "@/components/ui/button"
import { JsonLd } from "@/components/seo/json-ld"
import { ArrowRight } from "lucide-react"
import { blogPosts } from "@/lib/blog"

export const metadata = {
  title: "Blog — Contabilidad y Tributación en Chile",
  description: "Guías prácticas sobre facturación electrónica, DTE, F29, IVA y contabilidad para pymes chilenas.",
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

export default function BlogIndexPage() {
  return (
    <>
      <JsonLd data={breadcrumbSchema} />

      <div className="flex flex-col min-h-screen">
        {/* Header — identical to other marketing pages */}
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

        {/* Breadcrumb */}
        <div className="border-b border-border">
          <div className="container py-3">
            <nav className="text-xs text-muted-foreground font-mono">
              <Link href="/" className="hover:text-foreground transition-colors">Inicio</Link>
              <span className="mx-2">/</span>
              <span className="text-foreground">Blog</span>
            </nav>
          </div>
        </div>

        {/* Hero */}
        <section className="py-16 border-b border-border">
          <div className="container">
            <span className="eyebrow block mb-3">Conocimiento tributario</span>
            <h1 className="font-display text-5xl md:text-6xl font-semibold tracking-tightest max-w-2xl">
              Guías para <em className="text-primary not-italic font-medium">contadores</em> y pymes.
            </h1>
            <p className="mt-6 text-lg text-muted-foreground max-w-xl leading-relaxed">
              DTE, F29, IVA, PPM, nóminas. Todo lo que necesitas saber sobre tributación chilena, explicado con claridad.
            </p>
          </div>
        </section>

        {/* Posts grid */}
        <section className="py-16">
          <div className="container">
            <div className="grid gap-px bg-border border border-border md:grid-cols-2 lg:grid-cols-3">
              {blogPosts.map((post) => (
                <Link
                  key={post.slug}
                  href={`/blog/${post.slug}`}
                  className="bg-paper p-8 group hover:bg-secondary/40 transition-colors flex flex-col gap-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="eyebrow text-primary/70">{post.category}</span>
                    <span className="text-xs text-muted-foreground font-mono">{post.readTime} min</span>
                  </div>
                  <div className="flex-1">
                    <h2 className="font-display text-xl font-semibold tracking-tightest mb-2 group-hover:text-primary transition-colors line-clamp-2">
                      {post.title}
                    </h2>
                    <p className="text-sm text-muted-foreground leading-relaxed line-clamp-3">
                      {post.excerpt}
                    </p>
                  </div>
                  <div className="flex items-center justify-between pt-4 border-t border-border/50">
                    <time className="text-xs text-muted-foreground font-mono" dateTime={post.date}>
                      {new Date(post.date).toLocaleDateString("es-CL", { year: "numeric", month: "long", day: "numeric" })}
                    </time>
                    <ArrowRight className="h-4 w-4 text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all" />
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* Footer */}
        <footer className="border-t border-border py-8 bg-secondary/30 mt-auto">
          <div className="container flex flex-col md:flex-row items-center justify-between text-xs text-muted-foreground/70 font-mono">
            <p>© {new Date().getFullYear()} ContaChile · Todos los derechos reservados</p>
            <Link href="/" className="mt-2 md:mt-0 hover:text-foreground transition-colors">contachile.cl</Link>
          </div>
        </footer>
      </div>
    </>
  )
}
