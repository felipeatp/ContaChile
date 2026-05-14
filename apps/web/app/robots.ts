import { MetadataRoute } from 'next'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: ['/home', '/login', '/sign-up'],
      disallow: ['/dashboard', '/documents', '/emit', '/settings', '/api'],
    },
    sitemap: 'https://contachile.cl/sitemap.xml',
  }
}
