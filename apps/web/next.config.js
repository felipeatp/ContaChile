const withPWA = require('@ducanh2912/next-pwa').default

// CF dev integration only needed during `next dev` — safe to skip during Docker build
try {
  const { initOpenNextCloudflareForDev } = require("@opennextjs/cloudflare")
  initOpenNextCloudflareForDev()
} catch {
  // No-op outside Cloudflare dev context
}

/** @type {import('next').NextConfig} */

const nextConfig = {
  // Generates a self-contained Node.js server in .next/standalone/ for Docker.
  // OpenNext CF ignores this output and uses .next/server/ directly — no conflict.
  output: 'standalone',
  transpilePackages: ['@contachile/validators', '@contachile/auth'],
  poweredByHeader: false,
  async rewrites() {
    return []
  },
  async headers() {
    return [
      {
        source: '/(app)/camera',
        headers: [
          { key: 'Permissions-Policy', value: 'camera=(self)' },
        ],
      },
    ]
  },
}

module.exports = withPWA({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
})(nextConfig)
