import { MetadataRoute } from 'next'
import { blogPosts } from '@/lib/blog'

export default function sitemap(): MetadataRoute.Sitemap {
  const base = 'https://contachile.cl'

  const staticPages: MetadataRoute.Sitemap = [
    { url: base,                                       lastModified: new Date('2026-05-19'), changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${base}/precios`,                          lastModified: new Date('2026-05-19'), changeFrequency: 'monthly', priority: 0.9 },
    { url: `${base}/features`,                         lastModified: new Date('2026-05-19'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/features/facturacion-electronica`, lastModified: new Date('2026-05-19'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/features/contabilidad`,            lastModified: new Date('2026-05-19'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/features/nominas`,                 lastModified: new Date('2026-05-19'), changeFrequency: 'monthly', priority: 0.8 },
    { url: `${base}/features/inventario`,              lastModified: new Date('2026-05-19'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/features/ia`,                      lastModified: new Date('2026-05-19'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/comparar/vs-nubox`,                lastModified: new Date('2026-05-19'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/comparar/vs-defontana`,            lastModified: new Date('2026-05-19'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/comparar/vs-bsale`,                lastModified: new Date('2026-05-19'), changeFrequency: 'monthly', priority: 0.7 },
    { url: `${base}/blog`,                             lastModified: new Date('2026-05-19'), changeFrequency: 'weekly',  priority: 0.7 },
  ]

  const blogPages: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${base}/blog/${post.slug}`,
    lastModified: new Date(post.lastModified),
    changeFrequency: 'monthly',
    priority: 0.6,
  }))

  return [...staticPages, ...blogPages]
}
