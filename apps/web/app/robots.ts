import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/$', '/precios', '/features/', '/blog/', '/docs/', '/comparar/'],
      disallow: ['/dashboard/', '/documents/', '/emit/', '/settings/', '/api/', '/login', '/sign-up'],
    },
    sitemap: 'https://contachile.cl/sitemap.xml',
  }
}
