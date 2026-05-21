/** @type {import('next').NextConfig} */
const withPWA = require('@ducanh2912/next-pwa').default

const nextConfig = {
  transpilePackages: ['@contachile/validators', '@contachile/auth'],
  poweredByHeader: false,
  async rewrites() {
    return []
  },
}

module.exports = withPWA({
  dest: 'public',
  cacheOnFrontEndNav: true,
  aggressiveFrontEndNavCaching: false,
  reloadOnOnline: true,
  disable: process.env.NODE_ENV === 'development',
})(nextConfig)
