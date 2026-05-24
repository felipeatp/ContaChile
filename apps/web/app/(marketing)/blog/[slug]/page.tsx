import { notFound } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { JsonLd } from "@/components/seo/json-ld"
import { ArrowLeft, ArrowRight } from "lucide-react"
import { getPostBySlug, getAllSlugs, blogPosts } from "@/lib/blog"

function AudienceBadge({ audience }: { audience: "negocio" | "contador" | "ambos" }) {
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

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) return {}
  return {
    title: post.title,
    description: post.description,
    alternates: { canonical: `/blog/${post.slug}` },
    openGraph: {
      title: post.title,
      description: post.description,
      url: `https://contachile.cl/blog/${post.slug}`,
      type: "article",
      publishedTime: post.date,
      modifiedTime: post.lastModified,
    },
  }
}

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }))
}

export default async function BlogPostPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const post = getPostBySlug(slug)
  if (!post) notFound()

  // Build prev/next posts for internal linking
  const currentIndex = blogPosts.findIndex((p) => p.slug === post.slug)
  const prevPost = currentIndex > 0 ? blogPosts[currentIndex - 1] : null
  const nextPost = currentIndex < blogPosts.length - 1 ? blogPosts[currentIndex + 1] : null

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.description,
    datePublished: post.date,
    dateModified: post.lastModified,
    author: { "@type": "Organization", name: "ContAI", url: "https://contachile.cl" },
    publisher: {
      "@type": "Organization",
      name: "ContAI",
      logo: { "@type": "ImageObject", url: "https://contachile.cl/logo.png" },
    },
    url: `https://contachile.cl/blog/${post.slug}`,
    mainEntityOfPage: { "@type": "WebPage", "@id": `https://contachile.cl/blog/${post.slug}` },
  }

  const breadcrumbSchema = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Inicio", item: "https://contachile.cl" },
      { "@type": "ListItem", position: 2, name: "Blog",   item: "https://contachile.cl/blog" },
      { "@type": "ListItem", position: 3, name: post.title, item: `https://contachile.cl/blog/${post.slug}` },
    ],
  }

  return (
    <>
      <JsonLd data={articleSchema} />
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
                <span className="block font-display text-lg font-semibold tracking-tightest">ContAI</span>
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
              <Link href="/blog" className="hover:text-foreground transition-colors">Blog</Link>
              <span className="mx-2">/</span>
              <span className="text-foreground line-clamp-1">{post.title}</span>
            </nav>
          </div>
        </div>

        {/* Article */}
        <article className="flex-1">
          {/* Article header */}
          <header className="border-b-2 border-foreground py-14">
            <div className="container max-w-3xl">
              <div className="flex items-center gap-3 mb-5 flex-wrap">
                <span className="eyebrow text-primary/80">{post.category}</span>
                <span className="h-px w-6 bg-border" />
                <span className="text-xs text-muted-foreground font-mono">{post.readTime} min de lectura</span>
                <span className="h-px w-6 bg-border" />
                <time className="text-xs text-muted-foreground font-mono" dateTime={post.date}>
                  {new Date(post.date).toLocaleDateString("es-CL", { year: "numeric", month: "long", day: "numeric" })}
                </time>
              </div>
              <h1 className="font-display text-4xl md:text-5xl font-black tracking-tightest leading-tight mb-5">
                {post.title}
              </h1>
              <p className="text-lg italic text-muted-foreground leading-relaxed mb-6 max-w-2xl border-l-2 border-border pl-4">
                {post.description}
              </p>
              <div className="flex items-center gap-3 flex-wrap">
                <AudienceBadge audience={post.audience} />
                <span className="text-xs text-muted-foreground/60 font-mono">ContAI · {new Date(post.date).getFullYear()}</span>
              </div>
            </div>
          </header>

          {/* Article body — safe: content sourced exclusively from static lib/blog.ts, never from user input */}
          <div className="py-16">
            {/* nosec: content is static HTML from lib/blog.ts, not user-supplied */}
            <div
              className="container max-w-3xl prose prose-slate prose-headings:font-display prose-headings:tracking-tightest prose-headings:text-foreground prose-h2:text-2xl prose-h2:mt-12 prose-h2:mb-4 prose-h2:font-bold prose-h3:text-xl prose-h3:mt-8 prose-p:text-base prose-p:leading-[1.85] prose-p:text-foreground/80 prose-strong:text-foreground prose-strong:font-semibold"
              dangerouslySetInnerHTML={{ __html: post.content }} // eslint-disable-line react/no-danger -- content is from static lib/blog.ts only
            />
          </div>

          {/* CTA box */}
          <div className="border-t border-b border-border bg-secondary/30 py-12">
            <div className="container max-w-3xl">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                <div>
                  <span className="eyebrow block mb-2">ContAI</span>
                  <p className="font-display text-2xl font-semibold tracking-tightest">
                    Automatiza tu contabilidad con IA.
                  </p>
                  <p className="text-sm text-muted-foreground mt-2">DTE, F29, nóminas e inventario en una sola plataforma.</p>
                </div>
                <Link href="/sign-up" className="shrink-0">
                  <Button size="lg">
                    Probar gratis
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* Prev / Next navigation */}
          {(prevPost || nextPost) && (
            <nav className="border-b border-border py-8" aria-label="Navegación entre artículos">
              <div className="container max-w-3xl grid grid-cols-2 gap-4">
                <div>
                  {prevPost && (
                    <Link href={`/blog/${prevPost.slug}`} className="group flex flex-col gap-1 p-4 border border-border hover:bg-secondary/40 transition-colors">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground font-mono">
                        <ArrowLeft className="h-3 w-3" /> Anterior
                      </span>
                      <span className="text-sm font-semibold font-display tracking-tightest line-clamp-2 group-hover:text-primary transition-colors">
                        {prevPost.title}
                      </span>
                    </Link>
                  )}
                </div>
                <div className="flex justify-end">
                  {nextPost && (
                    <Link href={`/blog/${nextPost.slug}`} className="group flex flex-col gap-1 p-4 border border-border hover:bg-secondary/40 transition-colors text-right w-full">
                      <span className="flex items-center justify-end gap-1 text-xs text-muted-foreground font-mono">
                        Siguiente <ArrowRight className="h-3 w-3" />
                      </span>
                      <span className="text-sm font-semibold font-display tracking-tightest line-clamp-2 group-hover:text-primary transition-colors">
                        {nextPost.title}
                      </span>
                    </Link>
                  )}
                </div>
              </div>
            </nav>
          )}
        </article>

        {/* Footer */}
        <footer className="border-t border-border py-8 bg-secondary/30">
          <div className="container flex flex-col md:flex-row items-center justify-between text-xs text-muted-foreground/70 font-mono">
            <p>© {new Date().getFullYear()} ContAI · Todos los derechos reservados</p>
            <Link href="/blog" className="mt-2 md:mt-0 hover:text-foreground transition-colors">← Volver al blog</Link>
          </div>
        </footer>
      </div>
    </>
  )
}
